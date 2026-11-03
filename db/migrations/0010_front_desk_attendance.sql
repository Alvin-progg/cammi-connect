-- CamiConnect — front desk attendance (FD-001, PR 5)
--
-- Run after 0009_front_desk_confirm_reject.sql, in the hosted Supabase
-- project's SQL editor. This file only adds a function, so it can run in one
-- go.
--
-- Front desk staff record attendance on confirmed appointments
-- (SPEC-frontdesk §8): checked_in, completed, or no_show. The function runs in
-- one transaction: it locks the appointment, checks the transition, updates
-- the status, and writes the append-only audit entry with the staff member.
-- The audit row's created_at is the recorded timestamp.
--
-- The allowed transitions match canTransition in
-- src/lib/appointments/transitions.ts:
--   confirmed  -> checked_in, completed, no_show
--   checked_in -> completed
-- Attendance can only be recorded from the appointment's Manila calendar day
-- onward (FD-001 PR 5 decision).
--
-- The staff profile id must come from the authenticated front desk session;
-- the calling server code enforces the role (ADR-0003). Execute is revoked
-- from public, anon, and authenticated and granted to service_role only.

-- Raises P0001 with message not_found, invalid_status, invalid_transition, or
-- not_yet.
create or replace function public.cammi_connect_record_attendance(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_recorded_at timestamptz := now();
begin
  if p_status is null
    or p_status not in ('checked_in', 'completed', 'no_show') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not (
    (v_appointment.status = 'confirmed'
      and p_status in ('checked_in', 'completed', 'no_show'))
    or (v_appointment.status = 'checked_in' and p_status = 'completed')
  ) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if (v_appointment.scheduled_at at time zone 'Asia/Manila')::date
    > (v_recorded_at at time zone 'Asia/Manila')::date then
    raise exception 'not_yet' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = p_status
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    p_appointment_id, p_staff_id, p_status::text, v_appointment.status, p_status,
    jsonb_build_object(
      'recorded_at', v_recorded_at,
      'scheduled_at', v_appointment.scheduled_at
    )
  );
end;
$$;

revoke all on function public.cammi_connect_record_attendance(
  uuid, uuid, public.appointment_status
) from public, anon, authenticated;
grant execute on function public.cammi_connect_record_attendance(
  uuid, uuid, public.appointment_status
) to service_role;

notify pgrst, 'reload schema';
