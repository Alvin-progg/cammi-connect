-- CamiConnect — per-patient booking cap (security hardening)
--
-- Run after 0030_query_indexes.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go; it only replaces two functions.
--
--   * cammi_connect_book_appointment (patient and Cami bookings): body from
--     0020, plus a cap on the patient's upcoming requested/confirmed visits.
--     At the cap it raises P0001 too_many_upcoming, which the server maps to a
--     friendly message. The cap is the appointment.max_upcoming_per_patient
--     setting, or 3 when no row is stored.
--   * cammi_connect_front_desk_book_appointment (0012) is NOT changed, so
--     staff can still book for a patient who is at the cap.
--   * cammi_connect_admin_save_settings: body from 0027 with the new key on
--     the allow-list.
--
-- Signatures and grants are unchanged (execute for service_role only).

-- ---------------------------------------------------------------------------
-- cammi_connect_book_appointment (body from 0020, plus the cap)
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
  v_upcoming integer;
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

  -- Per-patient cap on upcoming visits (appointment.max_upcoming_per_patient,
  -- default 3, matching src/lib/settings/schema.ts). The patient lock
  -- serializes this patient's bookings across doctors, so two parallel
  -- requests cannot both pass the count. Lock order: doctor, then patient.
  perform 1
  from public.profiles
  where id = p_patient_id
  for update;

  select count(*)
  into v_upcoming
  from public.appointments
  where patient_id = p_patient_id
    and status in ('requested', 'confirmed')
    and scheduled_at > now();

  if v_upcoming >= coalesce(
    (
      select (settings.value #>> '{}')::integer
      from public.system_settings as settings
      where settings.key = 'appointment.max_upcoming_per_patient'
    ), 3) then
    raise exception 'too_many_upcoming' using errcode = 'P0001';
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
-- cammi_connect_admin_save_settings (body from 0027, plus the new key)
-- ---------------------------------------------------------------------------

-- p_values: {"<key>": <value>, ...}, the keys the admin changed.
create or replace function public.cammi_connect_admin_save_settings(
  p_actor_profile_id uuid,
  p_values jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allowed constant text[] := array[
    'appointment.default_slot_minutes',
    'appointment.request_expiry_hours',
    'appointment.min_lead_hours',
    'appointment.max_advance_days',
    'appointment.max_upcoming_per_patient',
    'appointment.cancellation_policy_text',
    'appointment.reschedule_policy_text',
    'hospital.name',
    'hospital.address',
    'hospital.contact_phone',
    'hospital.contact_email',
    'hospital.operating_hours',
    'chatbot.enabled',
    'chatbot.welcome_message',
    'chatbot.enabled_categories'
  ];
  v_key text;
  v_value jsonb;
  v_stored jsonb;
  v_previous jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'unknown_key' using errcode = 'P0001';
  end if;

  for v_key, v_value in select * from jsonb_each(p_values) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'unknown_key' using errcode = 'P0001';
    end if;

    select value into v_stored
    from public.system_settings
    where key = v_key
    for update;

    if v_stored is distinct from v_value then
      insert into public.system_settings (key, value, updated_by, updated_at)
      values (v_key, v_value, p_actor_profile_id, now())
      on conflict (key) do update
        set value = excluded.value,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at;

      v_previous := v_previous || jsonb_build_object(v_key, v_stored);
      v_new := v_new || jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  if v_new = '{}'::jsonb then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'settings.update', 'system_settings', 'system_settings',
    v_previous, v_new
  );
end;
$$;

revoke all on function public.cammi_connect_admin_save_settings(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_settings(uuid, jsonb)
  to service_role;
