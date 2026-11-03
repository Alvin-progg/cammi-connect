-- CamiConnect — admin user and role management (ADM-01)
--
-- Run after 0013_admin_foundation.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
--   * guards profiles.role: a role can only change inside the functions below
--     (and cammi_connect_save_doctor), which set a transaction-local flag. A
--     plain UPDATE of the role raises role_change_forbidden.
--   * adds the admin functions for listing accounts, provisioning invited
--     staff, changing roles, activating/deactivating, and editing profiles.
--     Each mutation writes its audit_logs row in the same transaction.
--   * adds cammi_connect_bootstrap_staff_role for the seed script only.
--
-- Authorization follows ADR-0003: the server calls these with the service-role
-- client after getAdminSession. As defense in depth, every admin function
-- re-checks that p_actor_profile_id is an active admin, under a row lock. The
-- actor ID must come from the session, never from input.
--
-- The last active admin cannot be demoted or deactivated: the actor must be an
-- active admin and may not target themselves, so another active admin always
-- remains. Both rows are locked in id order, so two admins demoting each other
-- at the same time are serialized and the second one fails with not_admin.
--
-- All functions raise P0001 with one of these messages: not_admin,
-- reason_required, not_found, unchanged, self_change, doctor_record,
-- invalid_role, already_provisioned, full_name_required. Execute is revoked
-- from public, anon, and authenticated and granted to service_role only.

-- ---------------------------------------------------------------------------
-- Role-change guard
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_guard_role_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('cammi_connect.role_change', true), '') <> 'on' then
    raise exception 'role_change_forbidden' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.cammi_connect_guard_role_change()
  from public, anon, authenticated;

drop trigger if exists profiles_guard_role_change on public.profiles;
create trigger profiles_guard_role_change
before update of role on public.profiles
for each row execute function public.cammi_connect_guard_role_change();

-- Allows role updates for the rest of the current transaction only.
create or replace function public.cammi_connect_allow_role_change()
returns void
language sql
security invoker
set search_path = ''
as $$
  select set_config('cammi_connect.role_change', 'on', true);
$$;

revoke all on function public.cammi_connect_allow_role_change()
  from public, anon, authenticated;
grant execute on function public.cammi_connect_allow_role_change() to service_role;

-- ---------------------------------------------------------------------------
-- Save doctor: unchanged from 0003 except that it allows its role change.
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_save_doctor(
  p_doctor_id uuid,
  p_full_name text,
  p_department_id uuid,
  p_is_active boolean,
  p_specialty_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doctor_id uuid := p_doctor_id;
  v_role public.user_role;
begin
  if v_doctor_id is null then
    insert into public.profiles (role, full_name, department_id)
    values ('doctor', p_full_name, p_department_id)
    returning id into v_doctor_id;
  else
    select role into v_role
    from public.profiles
    where id = v_doctor_id
    for update;

    if not found then
      raise exception 'profile_not_found' using errcode = 'P0001';
    end if;
    if v_role = 'admin' then
      raise exception 'admin_profile' using errcode = 'P0001';
    end if;

    perform public.cammi_connect_allow_role_change();
    update public.profiles
      set role = 'doctor',
          full_name = p_full_name,
          department_id = p_department_id
      where id = v_doctor_id;
  end if;

  insert into public.doctors (id, department_id, full_name, is_active)
  values (v_doctor_id, p_department_id, p_full_name, p_is_active)
  on conflict (id) do update
    set department_id = excluded.department_id,
        full_name = excluded.full_name,
        is_active = excluded.is_active;

  delete from public.doctor_specialties
    where doctor_id = v_doctor_id
      and specialty_id <> all (p_specialty_ids);

  insert into public.doctor_specialties (doctor_id, specialty_id)
  select v_doctor_id, specialty_id
  from unnest(p_specialty_ids) as specialty_id
  on conflict do nothing;

  return v_doctor_id;
end;
$$;

revoke all on function public.cammi_connect_save_doctor(uuid, text, uuid, boolean, uuid[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_save_doctor(uuid, text, uuid, boolean, uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- Shared checks
-- ---------------------------------------------------------------------------

-- Locks the actor and target profiles in id order, then checks that the actor
-- is an active admin and the target is an account with a login. Raises
-- not_admin or not_found.
create or replace function public.cammi_connect_lock_admin_target(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id in (p_actor_profile_id, p_target_profile_id)
  order by id
  for update;

  perform 1
  from public.profiles
  where id = p_actor_profile_id and role = 'admin' and is_active;
  if not found then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  perform 1
  from public.profiles
  where id = p_target_profile_id and auth_user_id is not null;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.cammi_connect_lock_admin_target(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_lock_admin_target(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Change role
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_set_user_role(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_new_role public.user_role,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_previous_role public.user_role;
begin
  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, p_target_profile_id);

  if v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select role into v_previous_role
  from public.profiles
  where id = p_target_profile_id;

  if v_previous_role = p_new_role then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;
  if p_target_profile_id = p_actor_profile_id then
    raise exception 'self_change' using errcode = 'P0001';
  end if;
  -- Doctors with a directory record are managed from the Doctors section,
  -- so their appointments and schedules are never orphaned here.
  if exists (select 1 from public.doctors where id = p_target_profile_id) then
    raise exception 'doctor_record' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_allow_role_change();
  update public.profiles
    set role = p_new_role
    where id = p_target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values, reason
  ) values (
    p_actor_profile_id, 'user.role_change', 'user', p_target_profile_id::text,
    jsonb_build_object('role', v_previous_role),
    jsonb_build_object('role', p_new_role),
    v_reason
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_user_role(uuid, uuid, public.user_role, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_user_role(uuid, uuid, public.user_role, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Activate / deactivate
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_set_user_active(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_is_active boolean,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_was_active boolean;
begin
  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, p_target_profile_id);

  if v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select is_active into v_was_active
  from public.profiles
  where id = p_target_profile_id;

  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;
  if p_target_profile_id = p_actor_profile_id then
    raise exception 'self_change' using errcode = 'P0001';
  end if;

  update public.profiles
    set is_active = p_is_active
    where id = p_target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values, reason
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'user.activate' else 'user.deactivate' end,
    'user', p_target_profile_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active),
    v_reason
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_user_active(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_user_active(uuid, uuid, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Edit name and phone
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_update_user_profile(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_full_name text,
  p_phone text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_previous record;
begin
  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, p_target_profile_id);

  if v_full_name = '' then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;

  select full_name, phone into v_previous
  from public.profiles
  where id = p_target_profile_id;

  if v_previous.full_name = v_full_name
     and v_previous.phone is not distinct from v_phone then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  update public.profiles
    set full_name = v_full_name,
        phone = v_phone
    where id = p_target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'user.update', 'user', p_target_profile_id::text,
    jsonb_build_object('full_name', v_previous.full_name, 'phone', v_previous.phone),
    jsonb_build_object('full_name', v_full_name, 'phone', v_phone)
  );
end;
$$;

revoke all on function public.cammi_connect_admin_update_user_profile(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_update_user_profile(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Provision an invited staff account
-- ---------------------------------------------------------------------------

-- Supabase Auth's invite inserts the auth user, and
-- cammi_connect_handle_new_auth_user (0001) gives it a patient profile. This
-- turns that new profile into a staff profile. Returns the profile id.
create or replace function public.cammi_connect_admin_provision_staff(
  p_actor_profile_id uuid,
  p_auth_user_id uuid,
  p_role public.user_role,
  p_full_name text,
  p_phone text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_profile_id uuid;
  v_role public.user_role;
begin
  if p_role not in ('front_desk', 'doctor', 'admin') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if v_full_name = '' then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;

  select id, role into v_profile_id, v_role
  from public.profiles
  where auth_user_id = p_auth_user_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, v_profile_id);

  -- Only a fresh patient profile from the invite is turned into staff.
  if v_role <> 'patient' then
    raise exception 'already_provisioned' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_allow_role_change();
  update public.profiles
    set role = p_role,
        full_name = v_full_name,
        phone = v_phone
    where id = v_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, new_values
  ) values (
    p_actor_profile_id, 'user.create', 'user', v_profile_id::text,
    jsonb_build_object('role', p_role, 'full_name', v_full_name)
  );

  return v_profile_id;
end;
$$;

revoke all on function public.cammi_connect_admin_provision_staff(uuid, uuid, public.user_role, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_provision_staff(uuid, uuid, public.user_role, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Read accounts (profiles joined to auth.users)
-- ---------------------------------------------------------------------------

-- Security definer so it can read auth.users. It returns only the listed
-- columns: password hashes, tokens, and auth metadata are never selected.
-- Only accounts with a login are listed (walk-in and directory-only profiles
-- have no auth user).
create or replace function public.cammi_connect_admin_list_users(
  p_search text,
  p_role public.user_role,
  p_is_active boolean,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with pattern as (
    select '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      as value
    where nullif(btrim(coalesce(p_search, '')), '') is not null
  )
  select
    profiles.id,
    profiles.full_name,
    users.email::text,
    profiles.role,
    profiles.is_active,
    profiles.created_at,
    users.last_sign_in_at,
    count(*) over () as total_count
  from public.profiles
  join auth.users as users on users.id = profiles.auth_user_id
  where (p_role is null or profiles.role = p_role)
    and (p_is_active is null or profiles.is_active = p_is_active)
    and (
      not exists (select 1 from pattern)
      or profiles.full_name ilike (select value from pattern)
      or users.email ilike (select value from pattern)
    )
  order by profiles.created_at desc, profiles.id
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.cammi_connect_admin_list_users(text, public.user_role, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_list_users(text, public.user_role, boolean, integer, integer)
  to service_role;

create or replace function public.cammi_connect_admin_get_user(p_profile_id uuid)
returns table (
  id uuid,
  auth_user_id uuid,
  full_name text,
  email text,
  phone text,
  role public.user_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  has_doctor_record boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id,
    profiles.auth_user_id,
    profiles.full_name,
    users.email::text,
    profiles.phone,
    profiles.role,
    profiles.is_active,
    profiles.created_at,
    users.last_sign_in_at,
    exists (select 1 from public.doctors where doctors.id = profiles.id)
  from public.profiles
  join auth.users as users on users.id = profiles.auth_user_id
  where profiles.id = p_profile_id;
$$;

revoke all on function public.cammi_connect_admin_get_user(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_get_user(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Seed only
-- ---------------------------------------------------------------------------

-- Used only by scripts/seed.mjs to create the first admin, the seed doctor,
-- and the seed front desk account. It needs no actor because the first admin
-- cannot be created by another admin. Application code must not call it.
create or replace function public.cammi_connect_bootstrap_staff_role(
  p_auth_user_id uuid,
  p_role public.user_role,
  p_full_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  perform public.cammi_connect_allow_role_change();
  insert into public.profiles (auth_user_id, role, full_name)
  values (p_auth_user_id, p_role, p_full_name)
  on conflict (auth_user_id) do update
    set role = excluded.role,
        full_name = excluded.full_name
  returning id into v_profile_id;
  return v_profile_id;
end;
$$;

revoke all on function public.cammi_connect_bootstrap_staff_role(uuid, public.user_role, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_bootstrap_staff_role(uuid, public.user_role, text)
  to service_role;
