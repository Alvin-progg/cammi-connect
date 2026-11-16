-- CamiConnect — specialty routing hints (AI-APT-002)
--
-- Run after 0031_patient_booking_cap.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
--   * specialties.routing_hints: plain-language "who should book here", up to
--     1,000 characters, written by the hospital's medical staff. Cami's intent
--     prompt lists each active specialty with its hints so it can suggest a
--     specialty from the hospital's own list. Hints are never shown to
--     patients.
--   * cammi_connect_admin_save_specialty gains p_routing_hints and records the
--     hints in the audit payload. The old four-argument function is dropped
--     first so only one save function exists. Body otherwise from 0023.
--   * cammi_connect_admin_save_settings: body from 0031, plus the two
--     first-contact specialty settings on the allow-list.
--
-- Authorization follows ADR-0003 (see 0014): execute is revoked from public,
-- anon, and authenticated and granted to service_role only.

alter table public.specialties
  add column if not exists routing_hints text;

alter table public.specialties
  drop constraint if exists specialties_routing_hints_length;
alter table public.specialties
  add constraint specialties_routing_hints_length
  check (routing_hints is null or char_length(routing_hints) <= 1000);

-- ---------------------------------------------------------------------------
-- cammi_connect_admin_save_specialty (body from 0023, plus routing hints)
-- ---------------------------------------------------------------------------

drop function if exists public.cammi_connect_admin_save_specialty(uuid, uuid, text, text);

create or replace function public.cammi_connect_admin_save_specialty(
  p_actor_profile_id uuid,
  p_specialty_id uuid,
  p_name text,
  p_description text,
  p_routing_hints text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_routing_hints text := nullif(btrim(coalesce(p_routing_hints, '')), '');
  v_specialty_id uuid := p_specialty_id;
  v_previous public.specialties;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_specialty_id is not null then
    select * into v_previous
    from public.specialties
    where id = v_specialty_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_specialty_id is null then
      insert into public.specialties (name, description, routing_hints)
      values (v_name, v_description, v_routing_hints)
      returning id into v_specialty_id;
    else
      update public.specialties
        set name = v_name,
            description = v_description,
            routing_hints = v_routing_hints
        where id = v_specialty_id;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate' using errcode = 'P0001';
  end;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_specialty_id is null then 'specialty.create' else 'specialty.update' end,
    'specialty', v_specialty_id::text,
    case
      when p_specialty_id is null then null
      else jsonb_build_object(
        'name', v_previous.name,
        'description', v_previous.description,
        'routing_hints', v_previous.routing_hints
      )
    end,
    jsonb_build_object(
      'name', v_name,
      'description', v_description,
      'routing_hints', v_routing_hints
    )
  );

  return v_specialty_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_admin_save_settings (body from 0031, plus the new keys)
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
    'chatbot.enabled_categories',
    'chatbot.first_contact_specialty_adult',
    'chatbot.first_contact_specialty_child'
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
