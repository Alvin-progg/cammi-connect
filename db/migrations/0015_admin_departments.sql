-- CamiConnect — admin department management (ADM-02)
--
-- Run after 0014_admin_user_management.sql, in the hosted Supabase project's
-- SQL editor. This file can run in one go.
--
--   * departments get updated_at and case-insensitive unique names. The index
--     fails to build if two existing names differ only by case; rename one
--     first.
--   * admin functions save a department and activate/deactivate it, each
--     writing its audit_logs row in the same transaction. Departments are never
--     deleted, and deactivation leaves doctors.department_id untouched.
--   * deactivation is refused while any of the department's doctors has a
--     future requested or confirmed appointment (spec-admin D6). Nothing is
--     moved automatically; the front desk reschedules or cancels first.
--   * read functions for 30-day appointment stats by department (reused by the
--     analytics slices) and for the appointments blocking a deactivation.
--
-- Authorization follows ADR-0003 (see 0014). Mutating functions re-check that
-- p_actor_profile_id is an active admin. They raise P0001 with not_admin,
-- duplicate, not_found, unchanged, or has_future_appointments. Execute is
-- revoked from public, anon, and authenticated and granted to service_role
-- only.

alter table public.departments
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.cammi_connect_set_updated_at();

create unique index if not exists departments_name_ci_key
  on public.departments (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Shared actor check
-- ---------------------------------------------------------------------------

-- Raises not_admin unless the profile is an active admin. The row is locked so
-- a concurrent demotion of the actor waits for this transaction.
create or replace function public.cammi_connect_require_admin_actor(p_actor_profile_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id = p_actor_profile_id and role = 'admin' and is_active
  for share;
  if not found then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.cammi_connect_require_admin_actor(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_require_admin_actor(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Save (create or update)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_save_department(
  p_actor_profile_id uuid,
  p_department_id uuid,
  p_name text,
  p_code text,
  p_description text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_department_id uuid := p_department_id;
  v_previous record;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_department_id is not null then
    select name, code, description into v_previous
    from public.departments
    where id = v_department_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_department_id is null then
      insert into public.departments (name, code, description)
      values (v_name, v_code, v_description)
      returning id into v_department_id;
    else
      update public.departments
        set name = v_name,
            code = v_code,
            description = v_description
        where id = v_department_id;
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
    case when p_department_id is null then 'department.create' else 'department.update' end,
    'department', v_department_id::text,
    case
      when p_department_id is null then null
      else jsonb_build_object(
        'name', v_previous.name,
        'code', v_previous.code,
        'description', v_previous.description
      )
    end,
    jsonb_build_object('name', v_name, 'code', v_code, 'description', v_description)
  );

  return v_department_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_department(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_department(uuid, uuid, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Activate / deactivate
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_set_department_active(
  p_actor_profile_id uuid,
  p_department_id uuid,
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
  from public.departments
  where id = p_department_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  if not p_is_active and exists (
    select 1
    from public.appointments
    join public.doctors on doctors.id = appointments.doctor_id
    where doctors.department_id = p_department_id
      and appointments.status in ('requested', 'confirmed')
      and appointments.scheduled_at > now()
  ) then
    raise exception 'has_future_appointments' using errcode = 'P0001';
  end if;

  update public.departments
    set is_active = p_is_active
    where id = p_department_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'department.activate' else 'department.deactivate' end,
    'department', p_department_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_department_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_department_active(uuid, uuid, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

-- Appointment counts per department and status for appointments scheduled in
-- [p_from, p_to). Departments come from the doctor's current assignment.
create or replace function public.cammi_connect_department_appointment_stats(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  department_id uuid,
  status public.appointment_status,
  appointment_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select doctors.department_id, appointments.status, count(*)
  from public.appointments
  join public.doctors on doctors.id = appointments.doctor_id
  where doctors.department_id is not null
    and appointments.scheduled_at >= p_from
    and appointments.scheduled_at < p_to
  group by doctors.department_id, appointments.status;
$$;

revoke all on function public.cammi_connect_department_appointment_stats(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_department_appointment_stats(timestamptz, timestamptz)
  to service_role;

-- The future requested/confirmed appointments that block deactivating a
-- department, soonest first. No patient data is returned.
create or replace function public.cammi_connect_department_future_conflicts(
  p_department_id uuid
)
returns table (
  appointment_id uuid,
  scheduled_at timestamptz,
  status public.appointment_status,
  doctor_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select appointments.id, appointments.scheduled_at, appointments.status, doctors.full_name
  from public.appointments
  join public.doctors on doctors.id = appointments.doctor_id
  where doctors.department_id = p_department_id
    and appointments.status in ('requested', 'confirmed')
    and appointments.scheduled_at > now()
  order by appointments.scheduled_at
  limit 50;
$$;

revoke all on function public.cammi_connect_department_future_conflicts(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_department_future_conflicts(uuid)
  to service_role;
