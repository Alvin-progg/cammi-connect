-- CamiConnect — admin system configuration (ADM-15)
--
-- Run after 0026_admin_knowledge_ingestion.sql, in the hosted Supabase
-- project's SQL editor. This file can run in one go.
--
--   * system_settings: one row per allow-listed key (spec §15). A key with no
--     row uses the default defined in src/lib/settings/schema.ts, so nothing is
--     seeded. Values are validated by the server's Zod schemas before save;
--     this file re-checks only that the key is on the allow-list.
--   * cammi_connect_admin_save_settings upserts the keys whose value changed
--     and writes one settings.update audit_logs row in the same transaction,
--     with the previous and new value of each changed key. A previous value of
--     null means the key had no row and was using its default.
--   * cammi_connect_match_knowledge_chunks gains a categories filter for
--     chatbot.enabled_categories. Null searches every category. Adding a
--     parameter changes the signature, so the old three-argument function is
--     dropped first; the body is otherwise the published-only search from 0025.
--
-- Authorization follows ADR-0003 (see 0014): RLS is on with no policies,
-- anon/authenticated have no table access, and the save function re-checks
-- that p_actor_profile_id is an active admin. It raises P0001 with not_admin,
-- unknown_key, or unchanged. Execute is revoked from public, anon, and
-- authenticated and granted to service_role only.

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

comment on table public.system_settings is
  'Admin-editable hospital policy settings (spec §15). A missing key uses its default.';

alter table public.system_settings enable row level security;
revoke all on table public.system_settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Save
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

-- ---------------------------------------------------------------------------
-- Similarity search: chunks of published documents in the enabled categories
-- ---------------------------------------------------------------------------

drop function if exists public.cammi_connect_match_knowledge_chunks(
  extensions.vector, integer, double precision
);

create or replace function public.cammi_connect_match_knowledge_chunks(
  query_embedding extensions.vector(768),
  match_count integer,
  min_similarity double precision,
  categories text[] default null
)
returns table (
  chunk_id uuid,
  slug text,
  title text,
  section_title text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    d.slug,
    d.title,
    c.section_title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.is_published
    and d.status = 'published'
    and (categories is null or d.category = any (categories))
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.cammi_connect_match_knowledge_chunks(extensions.vector, integer, double precision, text[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_match_knowledge_chunks(extensions.vector, integer, double precision, text[])
  to service_role;
