-- CamiConnect — schedule exceptions and appointment protection (ADM-06)
--
-- Run after 0019_schedule_exception_holiday.sql (which must run on its own
-- first), in the hosted Supabase project's SQL editor. This file can run in
-- one go.
--
-- Double booking is already refused by appointments_no_active_overlap
-- (0002/0007). This migration adds:
--
--   * hospital-wide holidays: a schedule_exceptions row with doctor_id null
--     and exception_type 'holiday' applies to every doctor. A check keeps the
--     two together.
--   * cammi_connect_exception_blocks, the one place that decides whether a
--     doctor's exception or a holiday covers a time range. The four
--     booking-path functions are redefined to call it; apart from that check
--     their bodies are copied unchanged from 0007, 0009, 0011, and 0012.
--   * audited add and remove functions. Every exception change goes through
--     them and writes schedule_exception.create or schedule_exception.delete
--     to audit_logs in the same transaction.
--
-- Per spec-admin D6, adding an exception that covers a requested, confirmed,
-- or checked-in appointment is refused (has_appointments). Nothing is moved
-- or cancelled; the front desk reschedules or cancels first. The add function
-- locks the doctor's row (every doctor's row for a holiday); the booking
-- functions lock the same row, so a booking cannot land between the check
-- and the commit.
--
-- Authorization follows ADR-0003: the functions re-check that
-- p_actor_profile_id is an active admin, or the active doctor whose
-- exception this is. Holidays are admin only. They raise P0001 with
-- invalid_type, not_authorized, not_found, or has_appointments. Execute is
-- revoked from public, anon, and authenticated and granted to service_role
-- only.

-- ---------------------------------------------------------------------------
-- Hospital-wide holidays
-- ---------------------------------------------------------------------------

alter table public.schedule_exceptions
  alter column doctor_id drop not null;

alter table public.schedule_exceptions
  drop constraint if exists schedule_exceptions_holiday_scope;

alter table public.schedule_exceptions
  add constraint schedule_exceptions_holiday_scope
  check ((doctor_id is null) = (exception_type = 'holiday'));

create index if not exists schedule_exceptions_holiday_range_idx
  on public.schedule_exceptions (start_datetime)
  where doctor_id is null;

comment on table public.schedule_exceptions is
  'Date/time intervals where a doctor is unavailable; doctor_id null with type holiday applies to every doctor. Exceptions only remove availability; temporary added hours are effective-dated schedule periods. Changes go through cammi_connect_add_schedule_exception / cammi_connect_remove_schedule_exception (0020).';

-- ---------------------------------------------------------------------------
-- Does an exception cover this range?
-- ---------------------------------------------------------------------------

-- True when one of the doctor's exceptions, or a hospital holiday, overlaps
-- [p_start, p_end). Mirrors intervalsOverlap in src/lib/schedules/availability.ts.
create or replace function public.cammi_connect_exception_blocks(
  p_doctor_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_exceptions as exceptions
    where (exceptions.doctor_id = p_doctor_id or exceptions.doctor_id is null)
      and exceptions.start_datetime < p_end
      and exceptions.end_datetime > p_start
  );
$$;

revoke all on function public.cammi_connect_exception_blocks(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_exception_blocks(uuid, timestamptz, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_book_appointment (body from 0007)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_book_appointment(
  p_doctor_id uuid,
  p_patient_id uuid,
  p_scheduled_at timestamptz,
  p_reason text,
  p_booking_source public.booking_source,
  p_created_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_local timestamp := p_scheduled_at at time zone 'Asia/Manila';
  v_local_date date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_scheduled_at at time zone 'Asia/Manila')::time;
  v_duration integer;
  v_appointment_id uuid;
begin
  -- Serializes concurrent bookings for this doctor.
  perform 1
  from public.doctors
  where id = p_doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The slot must start on the period's grid and end inside the period.
  -- Minutes are compared as numbers so a slot cannot wrap past midnight.
  select schedules.slot_duration_minutes
  into v_duration
  from public.doctor_schedules as schedules
  where schedules.doctor_id = p_doctor_id
    and schedules.is_active
    and schedules.day_of_week = extract(dow from v_local)
    and schedules.effective_from <= v_local_date
    and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
    and v_local_time >= schedules.start_time
    and extract(epoch from v_local_time) / 60 + schedules.slot_duration_minutes
      <= extract(epoch from schedules.end_time) / 60
    and mod(
      extract(epoch from (v_local_time - schedules.start_time))::integer,
      schedules.slot_duration_minutes * 60
    ) = 0
  limit 1;

  if v_duration is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if public.cammi_connect_exception_blocks(
    p_doctor_id,
    p_scheduled_at,
    p_scheduled_at + make_interval(mins => v_duration)
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    doctor_id, patient_id, scheduled_at, duration_minutes, status, reason,
    booking_source, created_by_profile_id
  )
  values (
    p_doctor_id, p_patient_id, p_scheduled_at, v_duration, 'requested',
    nullif(btrim(coalesce(p_reason, '')), ''),
    p_booking_source, p_created_by
  )
  returning id into v_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    v_appointment_id, p_created_by, 'created', null, 'requested',
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'booking_source', p_booking_source
    )
  );

  return v_appointment_id;
end;
$$;

revoke all on function public.cammi_connect_book_appointment(
  uuid, uuid, timestamptz, text, public.booking_source, uuid
) from public, anon, authenticated;
grant execute on function public.cammi_connect_book_appointment(
  uuid, uuid, timestamptz, text, public.booking_source, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_confirm_appointment (body from 0009)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_confirm_appointment(
  p_appointment_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_local timestamp;
  v_local_date date;
  v_local_time time;
  v_confirmed_at timestamptz := now();
begin
  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_appointment.status <> 'requested' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  -- Same lock as cammi_connect_book_appointment, so a confirmation and a
  -- booking for this doctor never interleave.
  perform 1
  from public.doctors
  where id = v_appointment.doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if v_appointment.scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The appointment must still fit inside one of the doctor's active
  -- consultation periods. Unlike booking, the slot grid is not re-checked:
  -- the period's slot length may have changed since the request was made.
  v_local := v_appointment.scheduled_at at time zone 'Asia/Manila';
  v_local_date := v_local::date;
  v_local_time := v_local::time;

  if not exists (
    select 1
    from public.doctor_schedules as schedules
    where schedules.doctor_id = v_appointment.doctor_id
      and schedules.is_active
      and schedules.day_of_week = extract(dow from v_local)
      and schedules.effective_from <= v_local_date
      and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
      and v_local_time >= schedules.start_time
      and extract(epoch from v_local_time) / 60 + v_appointment.duration_minutes
        <= extract(epoch from schedules.end_time) / 60
  ) then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if public.cammi_connect_exception_blocks(
    v_appointment.doctor_id,
    v_appointment.scheduled_at,
    v_appointment.scheduled_end_at
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'confirmed',
      confirmed_by_profile_id = p_staff_id,
      confirmed_at = v_confirmed_at
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    p_appointment_id, p_staff_id, 'confirmed', 'requested', 'confirmed',
    jsonb_build_object(
      'confirmed_at', v_confirmed_at,
      'scheduled_at', v_appointment.scheduled_at
    )
  );
end;
$$;

revoke all on function public.cammi_connect_confirm_appointment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_confirm_appointment(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_reschedule_appointment (body from 0011)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_reschedule_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_scheduled_at timestamptz,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_local timestamp := p_scheduled_at at time zone 'Asia/Manila';
  v_local_date date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_scheduled_at at time zone 'Asia/Manila')::time;
  v_duration integer;
begin
  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_appointment.status not in ('requested', 'confirmed') then
    raise exception 'not_reschedulable' using errcode = 'P0001';
  end if;

  if p_scheduled_at is null or p_scheduled_at = v_appointment.scheduled_at then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  -- Same lock as cammi_connect_book_appointment, so a reschedule and a
  -- booking for this doctor never interleave.
  perform 1
  from public.doctors
  where id = v_appointment.doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The new slot must start on a period's grid and end inside the period,
  -- exactly as for a booking. The period's slot length becomes the duration.
  select schedules.slot_duration_minutes
  into v_duration
  from public.doctor_schedules as schedules
  where schedules.doctor_id = v_appointment.doctor_id
    and schedules.is_active
    and schedules.day_of_week = extract(dow from v_local)
    and schedules.effective_from <= v_local_date
    and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
    and v_local_time >= schedules.start_time
    and extract(epoch from v_local_time) / 60 + schedules.slot_duration_minutes
      <= extract(epoch from schedules.end_time) / 60
    and mod(
      extract(epoch from (v_local_time - schedules.start_time))::integer,
      schedules.slot_duration_minutes * 60
    ) = 0
  limit 1;

  if v_duration is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if public.cammi_connect_exception_blocks(
    v_appointment.doctor_id,
    p_scheduled_at,
    p_scheduled_at + make_interval(mins => v_duration)
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  update public.appointments
  set scheduled_at = p_scheduled_at,
      duration_minutes = v_duration,
      rescheduled_from_at = v_appointment.scheduled_at
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    previous_values, new_values, reason
  )
  values (
    p_appointment_id, p_staff_id, 'rescheduled',
    v_appointment.status, v_appointment.status,
    jsonb_build_object(
      'scheduled_at', v_appointment.scheduled_at,
      'duration_minutes', v_appointment.duration_minutes
    ),
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'duration_minutes', v_duration
    ),
    v_reason
  );
end;
$$;

revoke all on function public.cammi_connect_reschedule_appointment(
  uuid, uuid, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.cammi_connect_reschedule_appointment(
  uuid, uuid, timestamptz, text
) to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_front_desk_book_appointment (body from 0012)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_front_desk_book_appointment(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_specialty_id uuid,
  p_scheduled_at timestamptz,
  p_reason text,
  p_staff_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_local timestamp := p_scheduled_at at time zone 'Asia/Manila';
  v_local_date date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_scheduled_at at time zone 'Asia/Manila')::time;
  v_duration integer;
  v_confirmed_at timestamptz := now();
  v_appointment_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_patient_id and role = 'patient'
  ) then
    raise exception 'invalid_patient' using errcode = 'P0001';
  end if;

  -- Same lock as cammi_connect_book_appointment, so bookings for this doctor
  -- never interleave.
  perform 1
  from public.doctors
  where id = p_doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if p_specialty_id is not null and not exists (
    select 1
    from public.doctor_specialties
    where doctor_id = p_doctor_id and specialty_id = p_specialty_id
  ) then
    raise exception 'specialty_mismatch' using errcode = 'P0001';
  end if;

  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The slot must start on a period's grid and end inside the period.
  -- Minutes are compared as numbers so a slot cannot wrap past midnight.
  select schedules.slot_duration_minutes
  into v_duration
  from public.doctor_schedules as schedules
  where schedules.doctor_id = p_doctor_id
    and schedules.is_active
    and schedules.day_of_week = extract(dow from v_local)
    and schedules.effective_from <= v_local_date
    and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
    and v_local_time >= schedules.start_time
    and extract(epoch from v_local_time) / 60 + schedules.slot_duration_minutes
      <= extract(epoch from schedules.end_time) / 60
    and mod(
      extract(epoch from (v_local_time - schedules.start_time))::integer,
      schedules.slot_duration_minutes * 60
    ) = 0
  limit 1;

  if v_duration is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if public.cammi_connect_exception_blocks(
    p_doctor_id,
    p_scheduled_at,
    p_scheduled_at + make_interval(mins => v_duration)
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    doctor_id, patient_id, specialty_id, scheduled_at, duration_minutes, status,
    reason, booking_source, created_by_profile_id, confirmed_by_profile_id,
    confirmed_at
  )
  values (
    p_doctor_id, p_patient_id, p_specialty_id, p_scheduled_at, v_duration,
    'confirmed', nullif(btrim(coalesce(p_reason, '')), ''), 'front_desk',
    p_staff_id, p_staff_id, v_confirmed_at
  )
  returning id into v_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    v_appointment_id, p_staff_id, 'created', null, 'confirmed',
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'booking_source', 'front_desk',
      'patient_id', p_patient_id,
      'specialty_id', p_specialty_id,
      'confirmed_at', v_confirmed_at
    )
  );

  return v_appointment_id;
end;
$$;

revoke all on function public.cammi_connect_front_desk_book_appointment(
  uuid, uuid, uuid, timestamptz, text, uuid
) from public, anon, authenticated;
grant execute on function public.cammi_connect_front_desk_book_appointment(
  uuid, uuid, uuid, timestamptz, text, uuid
) to service_role;


-- ---------------------------------------------------------------------------
-- Add an exception
-- ---------------------------------------------------------------------------

-- p_doctor_id null adds a hospital holiday (admin only). Returns the new id.
create or replace function public.cammi_connect_add_schedule_exception(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_exception_type public.schedule_exception_type,
  p_start timestamptz,
  p_end timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_saved public.schedule_exceptions;
begin
  if (p_doctor_id is null) <> (p_exception_type = 'holiday') then
    raise exception 'invalid_type' using errcode = 'P0001';
  end if;

  -- An active admin may add any exception; an active doctor only their own.
  perform 1
  from public.profiles
  where id = p_actor_profile_id
    and is_active
    and (
      role = 'admin'
      or (role = 'doctor' and p_doctor_id is not null and id = p_doctor_id)
    );
  if not found then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;

  if p_doctor_id is null then
    -- A holiday affects every doctor, so hold every doctor's booking lock.
    perform 1
    from public.doctors
    order by id
    for update;
  else
    perform 1
    from public.doctors
    where id = p_doctor_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.appointments
    where (p_doctor_id is null or appointments.doctor_id = p_doctor_id)
      and appointments.status in ('requested', 'confirmed', 'checked_in')
      and appointments.scheduled_at < p_end
      and appointments.scheduled_end_at > p_start
  ) then
    raise exception 'has_appointments' using errcode = 'P0001';
  end if;

  insert into public.schedule_exceptions (
    doctor_id, start_datetime, end_datetime, exception_type, reason
  ) values (
    p_doctor_id, p_start, p_end, p_exception_type, p_reason
  )
  returning * into v_saved;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, new_values
  ) values (
    p_actor_profile_id, 'schedule_exception.create', 'schedule_exception', v_saved.id::text,
    jsonb_build_object(
      'doctor_id', v_saved.doctor_id,
      'exception_type', v_saved.exception_type,
      'start_datetime', v_saved.start_datetime,
      'end_datetime', v_saved.end_datetime,
      'reason', v_saved.reason
    )
  );

  return v_saved.id;
end;
$$;

revoke all on function public.cammi_connect_add_schedule_exception(
  uuid, uuid, public.schedule_exception_type, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.cammi_connect_add_schedule_exception(
  uuid, uuid, public.schedule_exception_type, timestamptz, timestamptz, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Remove an exception
-- ---------------------------------------------------------------------------

-- Removes the doctor's own exception, or a holiday when p_doctor_id is null
-- (admin only). Removing only adds availability, so no lock is needed. The
-- audit row keeps the removed values.
create or replace function public.cammi_connect_remove_schedule_exception(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_exception_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_removed public.schedule_exceptions;
begin
  perform 1
  from public.profiles
  where id = p_actor_profile_id
    and is_active
    and (
      role = 'admin'
      or (role = 'doctor' and p_doctor_id is not null and id = p_doctor_id)
    );
  if not found then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;

  delete from public.schedule_exceptions
  where id = p_exception_id
    and doctor_id is not distinct from p_doctor_id
  returning * into v_removed;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, previous_values
  ) values (
    p_actor_profile_id, 'schedule_exception.delete', 'schedule_exception', v_removed.id::text,
    jsonb_build_object(
      'doctor_id', v_removed.doctor_id,
      'exception_type', v_removed.exception_type,
      'start_datetime', v_removed.start_datetime,
      'end_datetime', v_removed.end_datetime,
      'reason', v_removed.reason
    )
  );
end;
$$;

revoke all on function public.cammi_connect_remove_schedule_exception(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_remove_schedule_exception(uuid, uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
