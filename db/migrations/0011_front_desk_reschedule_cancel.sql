-- CamiConnect — front desk reschedule and cancel (FD-001, PR 6)
--
-- Run after 0010_front_desk_attendance.sql, in the hosted Supabase project's
-- SQL editor. This file only adds functions, so it can run in one go.
--
-- Front desk staff reschedule or cancel a pending or confirmed appointment
-- with a required reason (SPEC-frontdesk §9). Each function runs in one
-- transaction: it locks the appointment, checks its status, updates it, and
-- writes the append-only audit entry with the staff member and the previous
-- and new values. The rules match canFrontDeskCancel and
-- canFrontDeskReschedule in src/lib/front-desk/decisions.ts.
--
-- A reschedule keeps the doctor and the status (SPEC-frontdesk §11). The new
-- time must be a real slot, checked the same way as
-- cammi_connect_book_appointment. If it overlaps another slot-holding
-- appointment, appointments_no_active_overlap raises SQLSTATE 23P01 and the
-- whole transaction rolls back.
--
-- The staff profile id must come from the authenticated front desk session;
-- the calling server code enforces the role (ADR-0003). Execute is revoked
-- from public, anon, and authenticated and granted to service_role only.

-- ---------------------------------------------------------------------------
-- Reschedule
-- ---------------------------------------------------------------------------

-- Raises P0001 with message reason_required, not_found, not_reschedulable,
-- unchanged, inactive_doctor, past, outside_hours, or blocked. A taken slot
-- raises 23P01.
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

  if exists (
    select 1
    from public.schedule_exceptions as exceptions
    where exceptions.doctor_id = v_appointment.doctor_id
      and exceptions.start_datetime < p_scheduled_at + make_interval(mins => v_duration)
      and exceptions.end_datetime > p_scheduled_at
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
-- Cancel
-- ---------------------------------------------------------------------------

-- Raises P0001 with message reason_required, not_found, or not_cancellable.
-- Cancelled rows are kept; they free the doctor's slot because cancelled is
-- not a slot-holding status.
create or replace function public.cammi_connect_cancel_appointment(
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
  v_appointment public.appointments%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_cancelled_at timestamptz := now();
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
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancellation_reason = v_reason,
      cancelled_by_role = 'front_desk'
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values, reason
  )
  values (
    p_appointment_id, p_staff_id, 'cancelled', v_appointment.status, 'cancelled',
    jsonb_build_object(
      'cancelled_at', v_cancelled_at,
      'scheduled_at', v_appointment.scheduled_at
    ),
    v_reason
  );
end;
$$;

revoke all on function public.cammi_connect_cancel_appointment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_cancel_appointment(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
