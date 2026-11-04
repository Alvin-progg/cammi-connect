-- CamiConnect — audited weekly schedule saves (ADM-05)
--
-- Run after 0017_admin_doctors.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
-- doctor_schedules (0002/0003) already holds recurring weekly periods with
-- effective dates, and doctor_schedules_no_active_overlap already rejects
-- overlapping active periods. This migration adds one function that every
-- schedule period save goes through, for doctors editing their own hours and
-- for admins:
--
--   * it refuses an edit that would move an upcoming requested, confirmed, or
--     checked-in appointment outside the doctor's hours (spec-admin ADM-05,
--     D6). Nothing is moved; the front desk reschedules or cancels first, or
--     the old period is end-dated and a new one added. An appointment that
--     was already outside the hours before the edit (legacy data) does not
--     block it.
--   * it writes schedule.create, schedule.update, or schedule.deactivate to
--     audit_logs in the same transaction. An unchanged save writes nothing.
--
-- It locks the doctors row first. The booking functions (0003, 0011, 0012)
-- lock the same row, so a booking cannot land between the hours check and
-- the commit.
--
-- Authorization follows ADR-0003: the function re-checks that
-- p_actor_profile_id is an active admin, or the active doctor whose schedule
-- this is. It raises P0001 with not_authorized, not_found, or
-- orphans_appointments; an overlap raises the exclusion violation 23P01.
-- Execute is revoked from public, anon, and authenticated and granted to
-- service_role only.

-- ---------------------------------------------------------------------------
-- Upcoming appointments outside the doctor's hours
-- ---------------------------------------------------------------------------

-- Upcoming slot-holding appointments that no active period effective on their
-- Manila date covers. Mirrors fitsConsultationHours in
-- src/lib/schedules/availability.ts: same weekday, inside [start, end), and
-- never running past Manila midnight.
create or replace function public.cammi_connect_doctor_appointments_outside_hours(
  p_doctor_id uuid
)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select appointments.id
  from public.appointments
  where appointments.doctor_id = p_doctor_id
    and appointments.status in ('requested', 'confirmed', 'checked_in')
    and appointments.scheduled_at >= now()
    and not exists (
      select 1
      from public.doctor_schedules as schedules
      where schedules.doctor_id = appointments.doctor_id
        and schedules.is_active
        and schedules.day_of_week
          = extract(dow from appointments.scheduled_at at time zone 'Asia/Manila')
        and (appointments.scheduled_at at time zone 'Asia/Manila')::date
          >= schedules.effective_from
        and (
          schedules.effective_until is null
          or (appointments.scheduled_at at time zone 'Asia/Manila')::date
            <= schedules.effective_until
        )
        and (appointments.scheduled_end_at at time zone 'Asia/Manila')::date
          = (appointments.scheduled_at at time zone 'Asia/Manila')::date
        and (appointments.scheduled_at at time zone 'Asia/Manila')::time
          >= schedules.start_time
        and (appointments.scheduled_end_at at time zone 'Asia/Manila')::time
          <= schedules.end_time
    );
$$;

revoke all on function public.cammi_connect_doctor_appointments_outside_hours(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_doctor_appointments_outside_hours(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Save a schedule period
-- ---------------------------------------------------------------------------

-- p_period_id null creates a period; otherwise the doctor's own period is
-- updated. Returns the period id.
create or replace function public.cammi_connect_save_schedule_period(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_period_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_slot_duration_minutes integer,
  p_effective_from date,
  p_effective_until date,
  p_is_active boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous public.doctor_schedules;
  v_saved public.doctor_schedules;
  v_already_outside uuid[];
  v_action text;
begin
  -- An active admin may edit any doctor's hours; an active doctor only their own.
  perform 1
  from public.profiles
  where id = p_actor_profile_id
    and is_active
    and (role = 'admin' or (role = 'doctor' and id = p_doctor_id));
  if not found then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;

  perform 1
  from public.doctors
  where id = p_doctor_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(outside.id), '{}')
  into v_already_outside
  from public.cammi_connect_doctor_appointments_outside_hours(p_doctor_id) as outside (id);

  if p_period_id is null then
    insert into public.doctor_schedules (
      doctor_id, day_of_week, start_time, end_time, slot_duration_minutes,
      effective_from, effective_until, is_active
    ) values (
      p_doctor_id, p_day_of_week, p_start_time, p_end_time, p_slot_duration_minutes,
      p_effective_from, p_effective_until, p_is_active
    )
    returning * into v_saved;
    v_action := 'schedule.create';
  else
    select * into v_previous
    from public.doctor_schedules
    where id = p_period_id and doctor_id = p_doctor_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;

    if (v_previous.day_of_week, v_previous.start_time, v_previous.end_time,
        v_previous.slot_duration_minutes, v_previous.effective_from,
        v_previous.effective_until, v_previous.is_active)
       is not distinct from
       (p_day_of_week, p_start_time, p_end_time, p_slot_duration_minutes,
        p_effective_from, p_effective_until, p_is_active) then
      return p_period_id;
    end if;

    update public.doctor_schedules
      set day_of_week = p_day_of_week,
          start_time = p_start_time,
          end_time = p_end_time,
          slot_duration_minutes = p_slot_duration_minutes,
          effective_from = p_effective_from,
          effective_until = p_effective_until,
          is_active = p_is_active
      where id = p_period_id
      returning * into v_saved;
    v_action := case
      when v_previous.is_active and not p_is_active then 'schedule.deactivate'
      else 'schedule.update'
    end;
  end if;

  if exists (
    select 1
    from public.cammi_connect_doctor_appointments_outside_hours(p_doctor_id) as outside (id)
    where outside.id <> all (v_already_outside)
  ) then
    raise exception 'orphans_appointments' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, v_action, 'schedule', v_saved.id::text,
    case when v_previous.id is null then null else jsonb_build_object(
      'doctor_id', v_previous.doctor_id,
      'day_of_week', v_previous.day_of_week,
      'start_time', v_previous.start_time,
      'end_time', v_previous.end_time,
      'slot_duration_minutes', v_previous.slot_duration_minutes,
      'effective_from', v_previous.effective_from,
      'effective_until', v_previous.effective_until,
      'is_active', v_previous.is_active
    ) end,
    jsonb_build_object(
      'doctor_id', v_saved.doctor_id,
      'day_of_week', v_saved.day_of_week,
      'start_time', v_saved.start_time,
      'end_time', v_saved.end_time,
      'slot_duration_minutes', v_saved.slot_duration_minutes,
      'effective_from', v_saved.effective_from,
      'effective_until', v_saved.effective_until,
      'is_active', v_saved.is_active
    )
  );

  return v_saved.id;
end;
$$;

revoke all on function public.cammi_connect_save_schedule_period(
  uuid, uuid, uuid, smallint, time, time, integer, date, date, boolean
) from public, anon, authenticated;
grant execute on function public.cammi_connect_save_schedule_period(
  uuid, uuid, uuid, smallint, time, time, integer, date, date, boolean
) to service_role;
