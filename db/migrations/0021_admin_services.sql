-- CamiConnect — admin hospital services (ADM-07)
--
-- Run after 0020_admin_schedule_exceptions.sql, in the hosted Supabase
-- project's SQL editor. This file can run in one go.
--
--   * services: consultation, laboratory, X-ray, and so on. They are
--     informational (spec §10, decision D9): booking_mode only documents how a
--     patient reaches the service; there is no service-level scheduling or
--     equipment capacity. Names are unique ignoring case and surrounding
--     spaces. A service may belong to one department or to none.
--   * admin functions save a service and activate/deactivate it, each writing
--     its audit_logs row in the same transaction. Services are never deleted.
--     A new or changed department must be active; a service may keep a
--     department that was deactivated after it was assigned.
--
-- Authorization follows ADR-0003 (see 0014): RLS is on with no policies,
-- anon/authenticated have no table access, and the functions re-check that
-- p_actor_profile_id is an active admin. They raise P0001 with not_admin,
-- duplicate, not_found, unchanged, or inactive_department. Execute is revoked
-- from public, anon, and authenticated and granted to service_role only.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  description text,
  department_id uuid references public.departments (id),
  requires_appointment boolean not null default false,
  booking_mode text not null default 'none'
    check (booking_mode in ('none', 'doctor_consultation', 'walk_in')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.services is
  'Hospital services patients ask about. Informational only; not scheduled.';

create unique index if not exists services_name_ci_key
  on public.services (lower(btrim(name)));
create index if not exists services_department_id_idx
  on public.services (department_id);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row execute function public.cammi_connect_set_updated_at();

alter table public.services enable row level security;
revoke all on table public.services from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Save (create or update)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_save_service(
  p_actor_profile_id uuid,
  p_service_id uuid,
  p_name text,
  p_description text,
  p_department_id uuid,
  p_requires_appointment boolean,
  p_booking_mode text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_service_id uuid := p_service_id;
  v_previous record;
  v_previous_department_id uuid;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_service_id is not null then
    select name, description, department_id, requires_appointment, booking_mode
    into v_previous
    from public.services
    where id = v_service_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    v_previous_department_id := v_previous.department_id;
  end if;

  -- A service may keep a department that was deactivated after assignment.
  if p_department_id is not null
     and (p_service_id is null or p_department_id is distinct from v_previous_department_id) then
    perform 1
    from public.departments
    where id = p_department_id and is_active;
    if not found then
      raise exception 'inactive_department' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_service_id is null then
      insert into public.services (
        name, description, department_id, requires_appointment, booking_mode
      ) values (
        v_name, v_description, p_department_id, p_requires_appointment, p_booking_mode
      )
      returning id into v_service_id;
    else
      update public.services
        set name = v_name,
            description = v_description,
            department_id = p_department_id,
            requires_appointment = p_requires_appointment,
            booking_mode = p_booking_mode
        where id = v_service_id;
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
    case when p_service_id is null then 'service.create' else 'service.update' end,
    'service', v_service_id::text,
    case
      when p_service_id is null then null
      else jsonb_build_object(
        'name', v_previous.name,
        'description', v_previous.description,
        'department_id', v_previous.department_id,
        'requires_appointment', v_previous.requires_appointment,
        'booking_mode', v_previous.booking_mode
      )
    end,
    jsonb_build_object(
      'name', v_name,
      'description', v_description,
      'department_id', p_department_id,
      'requires_appointment', p_requires_appointment,
      'booking_mode', p_booking_mode
    )
  );

  return v_service_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_service(uuid, uuid, text, text, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_service(uuid, uuid, text, text, uuid, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Activate / deactivate
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_set_service_active(
  p_actor_profile_id uuid,
  p_service_id uuid,
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
  from public.services
  where id = p_service_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  update public.services
    set is_active = p_is_active
    where id = p_service_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'service.activate' else 'service.deactivate' end,
    'service', p_service_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_service_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_service_active(uuid, uuid, boolean)
  to service_role;
