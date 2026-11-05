-- CamiConnect — allow superseding a requirement again (ADM-08)
--
-- Run after 0023_fix_admin_save_create.sql, in the hosted Supabase project's
-- SQL editor. This file can run in one go.
--
-- 0022 refused a second supersede (already_superseded) even when the newer
-- version had been archived without being published. The published original
-- then lapsed on the day before that version's start, with nothing to replace
-- it. Now a requirement whose newer version is archived can be superseded
-- again; one whose newer version is a draft or published is still refused.
--
-- The first supersede shortened the original's effective_to, and the archived
-- copy kept the original end date. A re-supersede uses that copy's
-- effective_to as the end date to check against and to give the new copy.
-- The archived copy is left as it is; the original's superseded_by moves to
-- the new copy. Signature, refusal codes, grants, and audit rows are unchanged.

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
  v_successor public.service_requirements;
  v_original_end date;
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

  v_original_end := v_current.effective_to;
  if v_current.superseded_by is not null then
    select * into v_successor
    from public.service_requirements
    where id = v_current.superseded_by
    for update;
    if v_successor.status is distinct from 'archived' then
      raise exception 'already_superseded' using errcode = 'P0001';
    end if;
    v_original_end := v_successor.effective_to;
  end if;

  if p_starts_on is null
     or p_starts_on <= v_current.effective_from
     or (v_original_end is not null and p_starts_on > v_original_end) then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;

  insert into public.service_requirements (
    title, description, service_id, specialty_id, is_mandatory,
    effective_from, effective_to
  ) values (
    v_current.title, v_current.description, v_current.service_id,
    v_current.specialty_id, v_current.is_mandatory,
    p_starts_on, v_original_end
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
    jsonb_build_object(
      'effective_to', v_current.effective_to,
      'superseded_by', v_current.superseded_by
    ),
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
      'effective_to', v_original_end,
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
