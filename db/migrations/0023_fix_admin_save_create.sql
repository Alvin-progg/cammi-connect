-- CamiConnect — fix creating departments, specialties, services, and requirements
--
-- Run after 0022_admin_requirements.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
-- The save functions from 0015, 0016, 0021, and 0022 declared `v_previous` as
-- an untyped `record`, assigned only when editing an existing row. On create it
-- stays unassigned, and PL/pgSQL rejects any reference to its fields, even in
-- a CASE branch that is not taken: every create failed with
--   55000 record "v_previous" is not assigned yet
-- Each function below is the same as before except that `v_previous` is a
-- typed row of its table (all fields null until assigned) filled with
-- `select *`. Signatures, refusals, grants, and audit rows are unchanged.

-- ---------------------------------------------------------------------------
-- cammi_connect_admin_save_department (from 0015_admin_departments.sql)
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
  v_previous public.departments;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_department_id is not null then
    select * into v_previous
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
-- cammi_connect_admin_save_specialty (from 0016_admin_specialties.sql)
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
-- cammi_connect_admin_save_service (from 0021_admin_services.sql)
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
  v_previous public.services;
  v_previous_department_id uuid;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_service_id is not null then
    select * into v_previous
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
-- cammi_connect_admin_save_requirement (from 0022_admin_requirements.sql)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_save_requirement(
  p_actor_profile_id uuid,
  p_requirement_id uuid,
  p_title text,
  p_description text,
  p_service_id uuid,
  p_specialty_id uuid,
  p_is_mandatory boolean,
  p_effective_from date,
  p_effective_to date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_requirement_id uuid := p_requirement_id;
  v_previous public.service_requirements;
  v_target_changed boolean := true;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_requirement_id is not null then
    select * into v_previous
    from public.service_requirements
    where id = v_requirement_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if v_previous.status <> 'draft' then
      raise exception 'not_draft' using errcode = 'P0001';
    end if;
    v_target_changed := p_service_id is distinct from v_previous.service_id
      or p_specialty_id is distinct from v_previous.specialty_id;
  end if;

  -- A draft may keep a target that was deactivated after it was chosen.
  if v_target_changed then
    if p_service_id is not null then
      perform 1 from public.services where id = p_service_id and is_active;
    else
      perform 1 from public.specialties where id = p_specialty_id and is_active;
    end if;
    if not found then
      raise exception 'inactive_target' using errcode = 'P0001';
    end if;
  end if;

  if v_requirement_id is null then
    insert into public.service_requirements (
      title, description, service_id, specialty_id, is_mandatory,
      effective_from, effective_to
    ) values (
      v_title, v_description, p_service_id, p_specialty_id, p_is_mandatory,
      p_effective_from, p_effective_to
    )
    returning id into v_requirement_id;
  else
    update public.service_requirements
      set title = v_title,
          description = v_description,
          service_id = p_service_id,
          specialty_id = p_specialty_id,
          is_mandatory = p_is_mandatory,
          effective_from = p_effective_from,
          effective_to = p_effective_to
      where id = v_requirement_id;
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_requirement_id is null then 'requirement.create' else 'requirement.update' end,
    'requirement', v_requirement_id::text,
    case
      when p_requirement_id is null then null
      else jsonb_build_object(
        'title', v_previous.title,
        'description', v_previous.description,
        'service_id', v_previous.service_id,
        'specialty_id', v_previous.specialty_id,
        'is_mandatory', v_previous.is_mandatory,
        'effective_from', v_previous.effective_from,
        'effective_to', v_previous.effective_to
      )
    end,
    jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'service_id', p_service_id,
      'specialty_id', p_specialty_id,
      'is_mandatory', p_is_mandatory,
      'effective_from', p_effective_from,
      'effective_to', p_effective_to
    )
  );

  return v_requirement_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_requirement(uuid, uuid, text, text, uuid, uuid, boolean, date, date)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_requirement(uuid, uuid, text, text, uuid, uuid, boolean, date, date)
  to service_role;
