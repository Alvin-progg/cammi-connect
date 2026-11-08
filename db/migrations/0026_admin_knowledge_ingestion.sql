-- CamiConnect — admin knowledge ingestion (ADM-14)
--
-- Run after 0025_admin_knowledge_documents.sql, in the hosted Supabase
-- project's SQL editor. This file can run in one go.
--
--   * Publishing, editing, or reprocessing a document now ingests it inline in
--     the admin Server Action (ADR-0004 interim decision, 2026-11-08): the app
--     chunks and embeds the content, then stores the chunks through
--     cammi_connect_store_knowledge_chunks below.
--   * Atomic swap: the old chunks are deleted and the new ones inserted in one
--     transaction, only after embedding succeeded. Readers never see a gap,
--     and a failed run leaves the previous chunks searchable.
--   * Version guard: chunks are stored only when the document is still
--     published at the version that was embedded. Otherwise the function
--     raises stale and changes nothing, so an edit made mid-run is never
--     overwritten by older chunks.
--   * Archiving deletes the document's chunks (status function redefined
--     below), so archived text can't return if a later re-publish fails.
--   * Reprocess is an audited admin action (knowledge.reprocess). Marking a
--     document processing or failed is system state, written by guarded
--     updates from the app, and is not audited.
--
-- Authorization follows ADR-0003 (see 0014, 0025): execute is revoked from
-- public, anon, and authenticated and granted to service_role only.

-- ---------------------------------------------------------------------------
-- Reprocess: queue a published document for ingestion again
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_reprocess_knowledge_document(
  p_actor_profile_id uuid,
  p_document_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous record;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select status, processing_status, content_hash, version
  into v_previous
  from public.knowledge_documents
  where id = p_document_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_previous.status <> 'published' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.knowledge_documents
    set processing_status = 'pending',
        processing_error = null
    where id = p_document_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'knowledge.reprocess', 'knowledge_document', p_document_id::text,
    jsonb_build_object(
      'processing_status', v_previous.processing_status,
      'content_hash', v_previous.content_hash,
      'version', v_previous.version
    ),
    jsonb_build_object(
      'processing_status', 'pending',
      'content_hash', v_previous.content_hash,
      'version', v_previous.version
    )
  );
end;
$$;

revoke all on function public.cammi_connect_admin_reprocess_knowledge_document(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_reprocess_knowledge_document(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Store the embedded chunks of one document version (atomic swap)
--
-- p_chunks: [{"chunk_index", "section_title", "content", "content_hash",
--             "embedding": [768 numbers]}, ...]
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_store_knowledge_chunks(
  p_document_id uuid,
  p_version integer,
  p_chunks jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_document record;
begin
  if jsonb_typeof(p_chunks) is distinct from 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'A document needs at least one chunk.' using errcode = '22023';
  end if;

  select status, version
  into v_document
  from public.knowledge_documents
  where id = p_document_id
  for update;
  if not found or v_document.status <> 'published' or v_document.version <> p_version then
    raise exception 'stale' using errcode = 'P0001';
  end if;

  delete from public.knowledge_chunks where document_id = p_document_id;

  insert into public.knowledge_chunks (
    document_id, document_version, chunk_index, section_title, content, content_hash, embedding
  )
  select
    p_document_id,
    p_version,
    (chunk->>'chunk_index')::integer,
    chunk->>'section_title',
    chunk->>'content',
    chunk->>'content_hash',
    (chunk->'embedding')::text::extensions.vector
  from jsonb_array_elements(p_chunks) as chunk;

  update public.knowledge_documents
    set processing_status = 'ready',
        processing_error = null
    where id = p_document_id;
end;
$$;

revoke all on function public.cammi_connect_store_knowledge_chunks(uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_store_knowledge_chunks(uuid, integer, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Status changes (redefined from 0025): archiving now also deletes the
-- document's chunks. Re-publishing always ingests again, so nothing is lost.
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
    -- Withdrawn text must never come back: a later restore → edit → publish
    -- whose ingestion fails would otherwise serve these chunks again.
    delete from public.knowledge_chunks where document_id = p_document_id;
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
