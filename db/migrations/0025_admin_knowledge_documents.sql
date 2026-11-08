-- CamiConnect — admin knowledge documents (ADM-13)
--
-- Run after 0024_requirement_resupersede.sql, in the hosted Supabase project's
-- SQL editor. This file can run in one go. Then rerun `npm run kb:ingest` once
-- so the documents loaded from db/knowledge/ get their content and category.
--
--   * Extends knowledge_documents (0005) instead of adding a new table: admins
--     write the documents Cami answers from (decision D7: manual documents only).
--   * Lifecycle: draft → published → archived, and archived → draft (restore).
--     Drafts and published documents can be edited. Editing a published
--     document's content bumps its version and marks it pending; its old chunks
--     stay searchable until ingestion (ADM-14) replaces them, so there is no gap.
--   * Retrieval now follows status: only published documents are searched, and
--     archiving removes a document from search at once. is_published is dropped
--     because status replaces it.
--   * content_hash is the SHA-256 of the normalized content (computed by the
--     app, src/lib/knowledge/content.ts) and goes into every audit row.
--
-- Authorization follows ADR-0003 (see 0014): RLS is on with no policies,
-- anon/authenticated have no table access, and the functions re-check that
-- p_actor_profile_id is an active admin. They raise P0001 with not_admin,
-- not_found, not_editable, or invalid_transition. Execute is revoked from
-- public, anon, and authenticated and granted to service_role only.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.knowledge_documents
  add column if not exists category text not null default 'other_patient_info'
    check (category in (
      'hospital_info', 'departments', 'specialties', 'doctor_profiles', 'services',
      'appointment_requirements', 'appointment_procedures', 'other_patient_info'
    )),
  add column if not exists content text not null default ''
    check (char_length(content) <= 200000),
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  add column if not exists processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column if not exists processing_error text,
  add column if not exists source_file_name text,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles (id),
  add column if not exists archived_at timestamptz,
  add column if not exists created_by uuid references public.profiles (id);

comment on column public.knowledge_documents.created_by is
  'Admin who created the document; null for documents loaded by npm run kb:ingest.';

-- Documents that existed before this migration came from kb:ingest and
-- already have their chunks.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_documents'
      and column_name = 'is_published'
  ) then
    update public.knowledge_documents
      set status = case when is_published then 'published' else 'archived' end,
          processing_status = 'ready',
          published_at = case when is_published then created_at end,
          archived_at = case when is_published then null else updated_at end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Similarity search: chunks of published documents only
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_match_knowledge_chunks(
  query_embedding extensions.vector(768),
  match_count integer,
  min_similarity double precision
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
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

alter table public.knowledge_documents drop column if exists is_published;

-- ---------------------------------------------------------------------------
-- Atomic re-ingestion of one document (npm run kb:ingest)
--
-- p_document: {"slug", "title", "content_hash", "content", "category"}
--
-- Same as 0005, plus content and category. A new document is published; an
-- existing one keeps its status, so a document an admin archived stays
-- archived. The chunks are replaced, so processing becomes ready.
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_replace_document_chunks(
  p_document jsonb,
  p_chunks jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_document_id uuid;
  v_version integer;
begin
  if jsonb_typeof(p_chunks) is distinct from 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'A document needs at least one chunk.' using errcode = '22023';
  end if;

  insert into public.knowledge_documents (
    slug, title, content_hash, content, category,
    status, processing_status, published_at
  )
  values (
    p_document->>'slug',
    p_document->>'title',
    p_document->>'content_hash',
    coalesce(p_document->>'content', ''),
    coalesce(p_document->>'category', 'other_patient_info'),
    'published',
    'ready',
    now()
  )
  on conflict (slug) do update
    set title = excluded.title,
        content_hash = excluded.content_hash,
        content = excluded.content,
        category = excluded.category,
        processing_status = 'ready',
        processing_error = null,
        version = public.knowledge_documents.version
          + case
              when public.knowledge_documents.content_hash = excluded.content_hash then 0
              else 1
            end
  returning id, version into v_document_id, v_version;

  delete from public.knowledge_chunks where document_id = v_document_id;

  insert into public.knowledge_chunks (
    document_id, document_version, chunk_index, section_title, content, content_hash, embedding
  )
  select
    v_document_id,
    v_version,
    (chunk->>'chunk_index')::integer,
    chunk->>'section_title',
    chunk->>'content',
    chunk->>'content_hash',
    (chunk->'embedding')::text::extensions.vector
  from jsonb_array_elements(p_chunks) as chunk;

  return v_document_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Save a document (create a draft, or edit a draft or published document)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_save_knowledge_document(
  p_actor_profile_id uuid,
  p_document_id uuid,
  p_title text,
  p_category text,
  p_content text,
  p_content_hash text,
  p_source_file_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_document_id uuid := p_document_id;
  v_slug text;
  v_previous record;
  v_content_changed boolean;
  v_new_version integer;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_document_id is null then
    -- The slug is fixed at creation: lowercase words of the title joined by
    -- dashes, with a random suffix when another document already has it.
    v_slug := btrim(left(btrim(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '-'), 60), '-');
    if v_slug = '' then
      v_slug := 'document';
    end if;
    if exists (select 1 from public.knowledge_documents where slug = v_slug) then
      v_slug := v_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    end if;

    insert into public.knowledge_documents (
      slug, title, category, content, content_hash, source_file_name,
      status, processing_status, created_by
    ) values (
      v_slug, v_title, p_category, p_content, p_content_hash, p_source_file_name,
      'draft', 'pending', p_actor_profile_id
    )
    returning id into v_document_id;

    insert into public.audit_logs (
      actor_profile_id, action, target_type, target_id,
      previous_values, new_values
    ) values (
      p_actor_profile_id, 'knowledge.create', 'knowledge_document', v_document_id::text,
      null,
      jsonb_build_object(
        'title', v_title,
        'category', p_category,
        'status', 'draft',
        'content_hash', p_content_hash,
        'version', 1,
        'source_file_name', p_source_file_name
      )
    );

    return v_document_id;
  end if;

  select title, category, status, content_hash, version, source_file_name
  into v_previous
  from public.knowledge_documents
  where id = v_document_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_previous.status = 'archived' then
    raise exception 'not_editable' using errcode = 'P0001';
  end if;

  -- Only a published document's content edit needs re-embedding.
  v_content_changed := v_previous.status = 'published'
    and v_previous.content_hash is distinct from p_content_hash;
  v_new_version := v_previous.version + case when v_content_changed then 1 else 0 end;

  update public.knowledge_documents
    set title = v_title,
        category = p_category,
        content = p_content,
        content_hash = p_content_hash,
        source_file_name = coalesce(p_source_file_name, source_file_name),
        version = v_new_version,
        processing_status = case when v_content_changed then 'pending' else processing_status end,
        processing_error = case when v_content_changed then null else processing_error end
    where id = v_document_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'knowledge.update', 'knowledge_document', v_document_id::text,
    jsonb_build_object(
      'title', v_previous.title,
      'category', v_previous.category,
      'content_hash', v_previous.content_hash,
      'version', v_previous.version,
      'source_file_name', v_previous.source_file_name
    ),
    jsonb_build_object(
      'title', v_title,
      'category', p_category,
      'content_hash', p_content_hash,
      'version', v_new_version,
      'source_file_name', coalesce(p_source_file_name, v_previous.source_file_name)
    )
  );

  return v_document_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_knowledge_document(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_knowledge_document(uuid, uuid, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Status changes: publish (draft → published), archive (draft or published →
-- archived), restore (archived → draft)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_set_knowledge_document_status(
  p_actor_profile_id uuid,
  p_document_id uuid,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous record;
  v_action text;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select status, content_hash, version
  into v_previous
  from public.knowledge_documents
  where id = p_document_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if p_status = 'published' and v_previous.status = 'draft' then
    v_action := 'knowledge.publish';
    update public.knowledge_documents
      set status = 'published',
          processing_status = 'pending',
          processing_error = null,
          published_at = now(),
          published_by = p_actor_profile_id,
          archived_at = null
      where id = p_document_id;
  elsif p_status = 'archived' and v_previous.status in ('draft', 'published') then
    v_action := 'knowledge.archive';
    update public.knowledge_documents
      set status = 'archived',
          archived_at = now()
      where id = p_document_id;
  elsif p_status = 'draft' and v_previous.status = 'archived' then
    v_action := 'knowledge.restore';
    update public.knowledge_documents
      set status = 'draft',
          archived_at = null
      where id = p_document_id;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, v_action, 'knowledge_document', p_document_id::text,
    jsonb_build_object(
      'status', v_previous.status,
      'content_hash', v_previous.content_hash,
      'version', v_previous.version
    ),
    jsonb_build_object(
      'status', p_status,
      'content_hash', v_previous.content_hash,
      'version', v_previous.version
    )
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_knowledge_document_status(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_knowledge_document_status(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
