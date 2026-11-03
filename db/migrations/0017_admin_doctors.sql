-- CamiConnect — admin doctor management (ADM-04)
--
-- Run after 0016_admin_specialties.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
-- Doctors stay a 1:1 extension of profiles (ADR-0007): doctors.id is the
-- doctor's profile id, and the doctor's sign-in account is that profile's
-- auth_user_id. The spec's doctors.user_id maps to it.
--
--   * doctors gets admin-managed contact_email, contact_phone, and bio. These
--     are read only by the admin pages; patient booking and Cami read the
--     directory, which never selects them.
--   * a doctor must have a department from now on. The check is NOT VALID, so
--     existing rows without one keep working until an admin edits them.
--   * a trigger rejects a doctors row whose profile is not a doctor.
--   * admin functions save a doctor (with its specialty set), replace the
--     specialty set, link a doctor account, and activate/deactivate. Each writes
--     its audit_logs rows in the same transaction, so a failure leaves nothing
--     half-saved.
--   * deactivation is refused while the doctor has a future requested or
--     confirmed appointment (spec-admin D6). Nothing is moved automatically.
--   * cammi_connect_save_doctor (0003/0014) is left in place but no longer
--     called by the application.
--
-- Linking an account. A linkable account is an active profile with role
-- doctor, a login, and no doctors row (for example a doctor invited at
-- /admin/users). On create, the doctor record is made on that profile. For an
-- existing doctor without a login, the account's login (auth_user_id) moves
-- onto the doctor's profile and the emptied account profile is deactivated.
-- That move is refused if anything else already references the account
-- profile, so no history is orphaned.
--
-- Authorization follows ADR-0003 (see 0014): the functions re-check that
-- p_actor_profile_id is an active admin. They raise P0001 with not_admin,
-- not_found, unchanged, full_name_required, department_required,
-- inactive_department, specialty_required, inactive_specialty, not_linkable,
-- not_doctor_account, already_linked, account_has_history, or
-- has_future_appointments. Execute is revoked from public, anon, and
-- authenticated and granted to service_role only.

-- ---------------------------------------------------------------------------
-- Columns and checks
-- ---------------------------------------------------------------------------

alter table public.doctors
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists bio text;

alter table public.doctors
  drop constraint if exists doctors_contact_email_length,
  add constraint doctors_contact_email_length
    check (contact_email is null or char_length(contact_email) <= 254),
  drop constraint if exists doctors_contact_phone_length,
  add constraint doctors_contact_phone_length
    check (contact_phone is null or char_length(contact_phone) <= 40),
  drop constraint if exists doctors_bio_length,
  add constraint doctors_bio_length
    check (bio is null or char_length(bio) <= 1000),
  drop constraint if exists doctors_department_required,
  add constraint doctors_department_required
    check (department_id is not null) not valid;

comment on column public.doctors.contact_email is
  'Admin-managed contact email. Admin pages only; never shown to patients or Cami.';
comment on column public.doctors.contact_phone is
  'Admin-managed contact phone. Admin pages only; never shown to patients or Cami.';

-- ---------------------------------------------------------------------------
-- A doctors row must belong to a doctor profile
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_guard_doctor_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id = new.id and role = 'doctor';
  if not found then
    raise exception 'not_doctor_account' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.cammi_connect_guard_doctor_profile_role()
  from public, anon, authenticated;

drop trigger if exists doctors_guard_profile_role on public.doctors;
create trigger doctors_guard_profile_role
before insert or update on public.doctors
for each row execute function public.cammi_connect_guard_doctor_profile_role();

-- ---------------------------------------------------------------------------
-- Shared check: linkable doctor account
-- ---------------------------------------------------------------------------

-- Locks the account profile and raises not_linkable unless it is an active
-- doctor account with a login and no doctor record.
create or replace function public.cammi_connect_require_linkable_doctor_account(
  p_account_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id = p_account_profile_id
    and role = 'doctor'
    and auth_user_id is not null
    and is_active
  for update;
  if not found then
    raise exception 'not_linkable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.doctors where id = p_account_profile_id) then
    raise exception 'not_linkable' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.cammi_connect_require_linkable_doctor_account(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_require_linkable_doctor_account(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Replace a doctor's specialty set
-- ---------------------------------------------------------------------------

-- Replaces the whole set in one transaction. Added specialties must be
-- active; a specialty the doctor already has may stay after it was
-- deactivated. Writes doctor.specialties_change only when the set changed.
create or replace function public.cammi_connect_admin_set_doctor_specialties(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_specialty_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_specialty_ids uuid[];
  v_previous_ids uuid[];
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select coalesce(array_agg(distinct requested.specialty_id order by requested.specialty_id), '{}')
  into v_specialty_ids
  from unnest(coalesce(p_specialty_ids, '{}'::uuid[])) as requested (specialty_id)
  where requested.specialty_id is not null;

  if cardinality(v_specialty_ids) = 0 then
    raise exception 'specialty_required' using errcode = 'P0001';
  end if;

  perform 1
  from public.doctors
  where id = p_doctor_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(links.specialty_id order by links.specialty_id), '{}')
  into v_previous_ids
  from public.doctor_specialties as links
  where links.doctor_id = p_doctor_id;

  if v_previous_ids = v_specialty_ids then
    return;
  end if;

  if exists (
    select 1
    from unnest(v_specialty_ids) as requested (specialty_id)
    where requested.specialty_id <> all (v_previous_ids)
      and not exists (
        select 1
        from public.specialties
        where specialties.id = requested.specialty_id and specialties.is_active
      )
  ) then
    raise exception 'inactive_specialty' using errcode = 'P0001';
  end if;

  delete from public.doctor_specialties
    where doctor_id = p_doctor_id
      and specialty_id <> all (v_specialty_ids);

  insert into public.doctor_specialties (doctor_id, specialty_id)
  select p_doctor_id, requested.specialty_id
  from unnest(v_specialty_ids) as requested (specialty_id)
  on conflict do nothing;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'doctor.specialties_change', 'doctor', p_doctor_id::text,
    jsonb_build_object('specialty_ids', to_jsonb(v_previous_ids)),
    jsonb_build_object('specialty_ids', to_jsonb(v_specialty_ids))
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_doctor_specialties(uuid, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_doctor_specialties(uuid, uuid, uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- Save (create or update)
-- ---------------------------------------------------------------------------

-- p_doctor_id null creates a doctor: on p_account_profile_id when given (it
-- must be linkable), otherwise on a new profile without a login.
-- p_account_profile_id is ignored on update. A new or changed department must
-- be active. Returns the doctor id.
create or replace function public.cammi_connect_admin_save_doctor(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_account_profile_id uuid,
  p_full_name text,
  p_department_id uuid,
  p_contact_email text,
  p_contact_phone text,
  p_bio text,
  p_specialty_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_contact_email text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_contact_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_doctor_id uuid := p_doctor_id;
  v_previous_full_name text;
  v_previous_department_id uuid;
  v_previous_contact_email text;
  v_previous_contact_phone text;
  v_previous_bio text;
  v_new_values jsonb;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_full_name = '' then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;
  if p_department_id is null then
    raise exception 'department_required' using errcode = 'P0001';
  end if;

  if p_doctor_id is not null then
    select full_name, department_id, contact_email, contact_phone, bio
    into v_previous_full_name, v_previous_department_id,
         v_previous_contact_email, v_previous_contact_phone, v_previous_bio
    from public.doctors
    where id = p_doctor_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  -- A doctor may keep a department that was deactivated after assignment.
  if p_doctor_id is null or p_department_id is distinct from v_previous_department_id then
    perform 1
    from public.departments
    where id = p_department_id and is_active;
    if not found then
      raise exception 'inactive_department' using errcode = 'P0001';
    end if;
  end if;

  v_new_values := jsonb_build_object(
    'full_name', v_full_name,
    'department_id', p_department_id,
    'contact_email', v_contact_email,
    'contact_phone', v_contact_phone,
    'bio', v_bio
  );

  if p_doctor_id is null then
    if p_account_profile_id is null then
      insert into public.profiles (role, full_name, department_id)
      values ('doctor', v_full_name, p_department_id)
      returning id into v_doctor_id;
    else
      perform public.cammi_connect_require_linkable_doctor_account(p_account_profile_id);
      v_doctor_id := p_account_profile_id;
      update public.profiles
        set full_name = v_full_name,
            department_id = p_department_id
        where id = v_doctor_id;
    end if;

    insert into public.doctors (id, department_id, full_name, contact_email, contact_phone, bio)
    values (v_doctor_id, p_department_id, v_full_name, v_contact_email, v_contact_phone, v_bio);

    insert into public.audit_logs (
      actor_profile_id, action, target_type, target_id, new_values
    ) values (
      p_actor_profile_id, 'doctor.create', 'doctor', v_doctor_id::text, v_new_values
    );

    if p_account_profile_id is not null then
      insert into public.audit_logs (
        actor_profile_id, action, target_type, target_id, new_values
      ) values (
        p_actor_profile_id, 'doctor.link_account', 'doctor', v_doctor_id::text,
        jsonb_build_object('account_profile_id', p_account_profile_id)
      );
    end if;
  else
    update public.profiles
      set full_name = v_full_name,
          department_id = p_department_id
      where id = v_doctor_id;

    update public.doctors
      set full_name = v_full_name,
          department_id = p_department_id,
          contact_email = v_contact_email,
          contact_phone = v_contact_phone,
          bio = v_bio
      where id = v_doctor_id;

    if v_previous_full_name is distinct from v_full_name
       or v_previous_department_id is distinct from p_department_id
       or v_previous_contact_email is distinct from v_contact_email
       or v_previous_contact_phone is distinct from v_contact_phone
       or v_previous_bio is distinct from v_bio then
      insert into public.audit_logs (
        actor_profile_id, action, target_type, target_id,
        previous_values, new_values
      ) values (
        p_actor_profile_id, 'doctor.update', 'doctor', v_doctor_id::text,
        jsonb_build_object(
          'full_name', v_previous_full_name,
          'department_id', v_previous_department_id,
          'contact_email', v_previous_contact_email,
          'contact_phone', v_previous_contact_phone,
          'bio', v_previous_bio
        ),
        v_new_values
      );
    end if;
  end if;

  perform public.cammi_connect_admin_set_doctor_specialties(
    p_actor_profile_id, v_doctor_id, p_specialty_ids
  );

  return v_doctor_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_doctor(uuid, uuid, uuid, text, uuid, text, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_doctor(uuid, uuid, uuid, text, uuid, text, text, text, uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- Link an account to an existing doctor without a login
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_link_doctor_account(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_account_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  -- Both profiles are locked in id order so concurrent links cannot deadlock.
  perform 1
  from public.profiles
  where id in (p_doctor_id, p_account_profile_id)
  order by id
  for update;

  perform 1
  from public.doctors
  where id = p_doctor_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles
    where id = p_doctor_id and auth_user_id is not null
  ) then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_require_linkable_doctor_account(p_account_profile_id);

  -- Every column that references profiles (see migrations 0001-0013). The
  -- account profile is deactivated below, so nothing may point at it.
  if exists (
       select 1 from public.appointments
       where p_account_profile_id in (
         doctor_id, patient_id, created_by_profile_id, confirmed_by_profile_id
       )
     )
     or exists (
       select 1 from public.appointment_audit_logs
       where actor_profile_id = p_account_profile_id
     )
     or exists (
       select 1 from public.appointment_status_history
       where changed_by_profile_id = p_account_profile_id
     )
     or exists (
       select 1 from public.chat_conversations
       where patient_id = p_account_profile_id
     )
     or exists (
       select 1 from public.doctor_notifications
       where doctor_id = p_account_profile_id
     )
     or exists (
       select 1 from public.audit_logs
       where actor_profile_id = p_account_profile_id
     ) then
    raise exception 'account_has_history' using errcode = 'P0001';
  end if;

  select auth_user_id into v_auth_user_id
  from public.profiles
  where id = p_account_profile_id;

  -- auth_user_id is unique, so the account profile gives it up first.
  update public.profiles
    set auth_user_id = null,
        is_active = false
    where id = p_account_profile_id;

  update public.profiles
    set auth_user_id = v_auth_user_id
    where id = p_doctor_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, new_values
  ) values (
    p_actor_profile_id, 'doctor.link_account', 'doctor', p_doctor_id::text,
    jsonb_build_object('account_profile_id', p_account_profile_id)
  );
end;
$$;

revoke all on function public.cammi_connect_admin_link_doctor_account(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_link_doctor_account(uuid, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Activate / deactivate
-- ---------------------------------------------------------------------------

-- Inactive doctors are already refused by every booking function (0003, 0012)
-- and left out of the patient and Cami directory. Appointment history stays.
create or replace function public.cammi_connect_admin_set_doctor_active(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
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

  -- The booking functions lock this row too, so a booking cannot slip in
  -- between the check below and the update.
  select is_active into v_was_active
  from public.doctors
  where id = p_doctor_id
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
    where doctor_id = p_doctor_id
      and status in ('requested', 'confirmed')
      and scheduled_at > now()
  ) then
    raise exception 'has_future_appointments' using errcode = 'P0001';
  end if;

  update public.doctors
    set is_active = p_is_active
    where id = p_doctor_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'doctor.activate' else 'doctor.deactivate' end,
    'doctor', p_doctor_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_doctor_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_doctor_active(uuid, uuid, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

-- The future requested/confirmed appointments that block deactivating a
-- doctor, soonest first. No patient data is returned.
create or replace function public.cammi_connect_doctor_future_conflicts(
  p_doctor_id uuid
)
returns table (
  appointment_id uuid,
  scheduled_at timestamptz,
  status public.appointment_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select appointments.id, appointments.scheduled_at, appointments.status
  from public.appointments
  where appointments.doctor_id = p_doctor_id
    and appointments.status in ('requested', 'confirmed')
    and appointments.scheduled_at > now()
  order by appointments.scheduled_at
  limit 50;
$$;

revoke all on function public.cammi_connect_doctor_future_conflicts(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_doctor_future_conflicts(uuid)
  to service_role;

-- Accounts an admin can link: active doctor profiles with a login and no
-- doctor record. Names only.
create or replace function public.cammi_connect_admin_list_linkable_doctor_accounts()
returns table (
  profile_id uuid,
  full_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select profiles.id, profiles.full_name
  from public.profiles
  where profiles.role = 'doctor'
    and profiles.auth_user_id is not null
    and profiles.is_active
    and not exists (select 1 from public.doctors where doctors.id = profiles.id)
  order by profiles.full_name
  limit 200;
$$;

revoke all on function public.cammi_connect_admin_list_linkable_doctor_accounts()
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_list_linkable_doctor_accounts()
  to service_role;
