-- CamiConnect — admin specialty management (ADM-03)
--
-- Run after 0015_admin_departments.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
--   * specialties get updated_at and case-insensitive unique names. The index
--     fails to build if two existing names differ only by case; rename one
--     first.
--   * admin functions save a specialty and activate/deactivate it, each writing
--     its audit_logs row in the same transaction. Specialties are never
--     deleted. Deactivating only hides a specialty from patient choices (spec
--     §7): doctor_specialties and appointments.specialty_id are left as they
--     are, so nothing blocks it.
--
-- Specialties are independent of departments (no foreign key between them).
-- Authorization follows ADR-0003 (see 0014): the functions re-check that
-- p_actor_profile_id is an active admin and raise P0001 with not_admin,
-- duplicate, not_found, or unchanged. Execute is revoked from public, anon,
-- and authenticated and granted to service_role only.

alter table public.specialties
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists specialties_set_updated_at on public.specialties;
create trigger specialties_set_updated_at
before update on public.specialties
for each row execute function public.cammi_connect_set_updated_at();

create unique index if not exists specialties_name_ci_key
  on public.specialties (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Save (create or update)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_save_specialty(
  p_actor_profile_id uuid,
  p_specialty_id uuid,
  p_name text,
  p_description text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_specialty_id uuid := p_specialty_id;
  v_previous record;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_specialty_id is not null then
    select name, description into v_previous
    from public.specialties
    where id = v_specialty_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_specialty_id is null then
      insert into public.specialties (name, description)
      values (v_name, v_description)
      returning id into v_specialty_id;
    else
      update public.specialties
        set name = v_name,
            description = v_description
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
      else jsonb_build_object('name', v_previous.name, 'description', v_previous.description)
    end,
    jsonb_build_object('name', v_name, 'description', v_description)
  );

  return v_specialty_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Activate / deactivate
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_set_specialty_active(
  p_actor_profile_id uuid,
  p_specialty_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_was_active boolean;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select is_active into v_was_active
  from public.specialties
  where id = p_specialty_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  update public.specialties
    set is_active = p_is_active
    where id = p_specialty_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'specialty.activate' else 'specialty.deactivate' end,
    'specialty', p_specialty_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_specialty_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_specialty_active(uuid, uuid, boolean)
  to service_role;
