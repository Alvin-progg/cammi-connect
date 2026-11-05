-- CamiConnect — admin appointment requirements (ADM-08)
--
-- Run after 0021_admin_services.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
--   * service_requirements: what a patient must bring or do first (valid ID,
--     referral letter, previous records…). Each requirement belongs to exactly
--     one service or one specialty. It states what is required; whether a
--     patient met it stays with the front desk (spec §11).
--   * Lifecycle: draft → published → archived. Only drafts are edited. A
--     published requirement changes by being superseded: it is end-dated the
--     day before the new version starts and cloned into a new draft, so past
--     appointments keep the wording that applied to them. Nothing is deleted.
--   * Effective dates are Manila calendar dates, both ends inclusive.
--
-- Authorization follows ADR-0003 (see 0014): RLS is on with no policies,
-- anon/authenticated have no table access, and the functions re-check that
-- p_actor_profile_id is an active admin. They raise P0001 with not_admin,
-- not_found, not_draft, not_published, already_archived, already_superseded,
-- inactive_target, or invalid_date. Execute is revoked from public, anon, and
-- authenticated and granted to service_role only.

create table if not exists public.service_requirements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  description text,
  service_id uuid references public.services (id),
  specialty_id uuid references public.specialties (id),
  is_mandatory boolean not null default true,
  effective_from date not null default (now() at time zone 'Asia/Manila')::date,
  effective_to date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  superseded_by uuid references public.service_requirements (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requirements_one_target
    check (num_nonnulls(service_id, specialty_id) = 1),
  constraint service_requirements_effective_range
    check (effective_to is null or effective_to >= effective_from)
);

comment on table public.service_requirements is
  'Appointment requirements for one service or one specialty. Versioned by supersede; never deleted.';

create index if not exists service_requirements_service_id_idx
  on public.service_requirements (service_id);
create index if not exists service_requirements_specialty_id_idx
  on public.service_requirements (specialty_id);

drop trigger if exists service_requirements_set_updated_at on public.service_requirements;
create trigger service_requirements_set_updated_at
before update on public.service_requirements
for each row execute function public.cammi_connect_set_updated_at();

alter table public.service_requirements enable row level security;
revoke all on table public.service_requirements from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Save a draft (create or update)
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
  v_previous record;
  v_target_changed boolean := true;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_requirement_id is not null then
    select title, description, service_id, specialty_id, is_mandatory,
           effective_from, effective_to, status
    into v_previous
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

-- ---------------------------------------------------------------------------
-- Publish a draft
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_publish_requirement(
  p_actor_profile_id uuid,
  p_requirement_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select status into v_status
  from public.service_requirements
  where id = p_requirement_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_status <> 'draft' then
    raise exception 'not_draft' using errcode = 'P0001';
  end if;

  update public.service_requirements
    set status = 'published'
    where id = p_requirement_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'requirement.publish', 'requirement', p_requirement_id::text,
    jsonb_build_object('status', v_status),
    jsonb_build_object('status', 'published')
  );
end;
$$;

revoke all on function public.cammi_connect_admin_publish_requirement(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_publish_requirement(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Archive a draft or published requirement
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_archive_requirement(
  p_actor_profile_id uuid,
  p_requirement_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select status into v_status
  from public.service_requirements
  where id = p_requirement_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_status = 'archived' then
    raise exception 'already_archived' using errcode = 'P0001';
  end if;

  update public.service_requirements
    set status = 'archived'
    where id = p_requirement_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'requirement.archive', 'requirement', p_requirement_id::text,
    jsonb_build_object('status', v_status),
    jsonb_build_object('status', 'archived')
  );
end;
$$;

revoke all on function public.cammi_connect_admin_archive_requirement(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_archive_requirement(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Supersede a published requirement
-- ---------------------------------------------------------------------------
--
-- Ends the current version the day before p_starts_on and clones it into a new
-- draft that starts on p_starts_on and keeps the old end date. The old row
-- stays published (and in effect until it ends). Two audit rows are written:
-- requirement.update for the old row and requirement.create for the clone.

create or replace function public.cammi_connect_admin_supersede_requirement(
  p_actor_profile_id uuid,
  p_requirement_id uuid,
  p_starts_on date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.service_requirements;
  v_new_id uuid;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select * into v_current
  from public.service_requirements
  where id = p_requirement_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_current.status <> 'published' then
    raise exception 'not_published' using errcode = 'P0001';
  end if;
  if v_current.superseded_by is not null then
    raise exception 'already_superseded' using errcode = 'P0001';
  end if;
  if p_starts_on is null
     or p_starts_on <= v_current.effective_from
     or (v_current.effective_to is not null and p_starts_on > v_current.effective_to) then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;

  insert into public.service_requirements (
    title, description, service_id, specialty_id, is_mandatory,
    effective_from, effective_to
  ) values (
    v_current.title, v_current.description, v_current.service_id,
    v_current.specialty_id, v_current.is_mandatory,
    p_starts_on, v_current.effective_to
  )
  returning id into v_new_id;

  update public.service_requirements
    set effective_to = p_starts_on - 1,
        superseded_by = v_new_id
    where id = p_requirement_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values
  (
    p_actor_profile_id, 'requirement.update', 'requirement', p_requirement_id::text,
    jsonb_build_object('effective_to', v_current.effective_to, 'superseded_by', null),
    jsonb_build_object('effective_to', p_starts_on - 1, 'superseded_by', v_new_id)
  ),
  (
    p_actor_profile_id, 'requirement.create', 'requirement', v_new_id::text,
    null,
    jsonb_build_object(
      'title', v_current.title,
      'description', v_current.description,
      'service_id', v_current.service_id,
      'specialty_id', v_current.specialty_id,
      'is_mandatory', v_current.is_mandatory,
      'effective_from', p_starts_on,
      'effective_to', v_current.effective_to,
      'supersedes', p_requirement_id
    )
  );

  return v_new_id;
end;
$$;

revoke all on function public.cammi_connect_admin_supersede_requirement(uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_supersede_requirement(uuid, uuid, date)
  to service_role;
