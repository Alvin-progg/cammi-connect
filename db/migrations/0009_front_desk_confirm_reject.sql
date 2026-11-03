-- CamiConnect — front desk confirm and reject (FD-001, PR 4)
--
-- Run after 0008_front_desk_role.sql, in the hosted Supabase project's SQL
-- editor. This file only adds functions, so it can run in one go.
--
-- Confirmation and rejection are controlled backend operations
-- (SPEC-frontdesk §6, §13). Each function runs in one transaction: it locks
-- the appointment, re-checks that it is still pending, updates it, and writes
-- the append-only audit entry. The staff profile id must come from the
-- authenticated front desk session; the calling server code enforces the
-- role (ADR-0003: authorization lives in the server layer).
--
-- Concurrent confirmations cannot double-book a doctor: a pending request
-- already holds its slot under appointments_no_active_overlap, and the row
-- lock makes a second confirm (or a confirm racing a reject) see the new
-- status and fail with not_pending.
--
-- Security model is unchanged: execute is revoked from public, anon, and
-- authenticated and granted to service_role only.

-- ---------------------------------------------------------------------------
-- Confirm
-- ---------------------------------------------------------------------------

-- Raises P0001 with message not_found, not_pending, inactive_doctor, past,
-- outside_hours, or blocked.
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

  if exists (
    select 1
    from public.schedule_exceptions as exceptions
    where exceptions.doctor_id = v_appointment.doctor_id
      and exceptions.start_datetime < v_appointment.scheduled_end_at
      and exceptions.end_datetime > v_appointment.scheduled_at
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
-- Reject
-- ---------------------------------------------------------------------------

-- Raises P0001 with message not_found, not_pending, or reason_required.
-- Rejected rows are kept; they free the doctor's slot because rejected is not
-- a slot-holding status.
create or replace function public.cammi_connect_reject_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.appointment_status;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select status
  into v_status
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_status <> 'requested' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'rejected',
      rejection_reason = v_reason
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    reason
  )
  values (
    p_appointment_id, p_staff_id, 'rejected', 'requested', 'rejected', v_reason
  );
end;
$$;

revoke all on function public.cammi_connect_reject_appointment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_reject_appointment(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
