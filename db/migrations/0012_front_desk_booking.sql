-- CamiConnect — front desk staff-assisted booking (FD-001, PR 7)
--
-- Run after 0011_front_desk_reschedule_cancel.sql, in the hosted Supabase
-- project's SQL editor. This file only adds a function, so it can run in one
-- go.
--
-- Front desk staff book appointments for walk-in and phone-in patients
-- (SPEC-frontdesk §7). The staff member checks availability with the patient,
-- so the appointment is created already confirmed, with booking_source
-- front_desk. The patient owns the appointment (patient_id) and the staff
-- member is recorded separately as its creator and confirmer.
--
-- The slot is re-checked exactly as in cammi_connect_book_appointment (0007).
-- If it overlaps another slot-holding appointment,
-- appointments_no_active_overlap raises SQLSTATE 23P01 and the whole
-- transaction rolls back. The AI guard trigger is unaffected: it only refuses
-- confirmed rows with booking_source ai_chatbot.
--
-- Walk-in patients are plain profiles rows (role patient, auth_user_id null)
-- inserted by the server with the service-role client; no function is needed.
--
-- The staff profile id must come from the authenticated front desk session;
-- the calling server code enforces the role (ADR-0003). Execute is revoked
-- from public, anon, and authenticated and granted to service_role only.

-- Raises P0001 with message invalid_patient, inactive_doctor,
-- specialty_mismatch, past, outside_hours, or blocked. A taken slot raises
-- 23P01.
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

  if exists (
    select 1
    from public.schedule_exceptions as exceptions
    where exceptions.doctor_id = p_doctor_id
      and exceptions.start_datetime < p_scheduled_at + make_interval(mins => v_duration)
      and exceptions.end_datetime > p_scheduled_at
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

notify pgrst, 'reload schema';
