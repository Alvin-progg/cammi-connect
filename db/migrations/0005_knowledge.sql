-- CamiConnect — hospital knowledge base for RAG answers (AI-APT-001, slice S2)
--
-- Stores the synthetic corpus from db/knowledge/ as documents and embedded
-- chunks (gemini-embedding-001 at 768 dimensions, ADR-0006). Run after
-- 0004_chat.sql in the hosted Supabase project's SQL editor, then load the
-- corpus with `npm run kb:ingest` (db/README.md).
--
-- Security model is unchanged from 0001–0004 (ADR-0003): RLS enabled with no
-- permissive policies, anon/authenticated revoked, service_role only. pgvector
-- is reached only through the two service-role functions below.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  content_hash text not null,
  version integer not null default 1 check (version >= 1),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists knowledge_documents_set_updated_at on public.knowledge_documents;
create trigger knowledge_documents_set_updated_at
before update on public.knowledge_documents
for each row execute function public.cammi_connect_set_updated_at();

-- ---------------------------------------------------------------------------
-- Chunks
-- ---------------------------------------------------------------------------

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  document_version integer not null,
  chunk_index integer not null check (chunk_index >= 0),
  section_title text,
  content text not null check (char_length(content) between 1 and 4000),
  content_hash text not null,
  embedding extensions.vector(768) not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Similarity search: published chunks of published documents only
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
    and d.is_published
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.cammi_connect_match_knowledge_chunks(extensions.vector, integer, double precision)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_match_knowledge_chunks(extensions.vector, integer, double precision)
  to service_role;

-- ---------------------------------------------------------------------------
-- Atomic re-ingestion of one document
--
-- p_document: {"slug", "title", "content_hash"}
-- p_chunks:   [{"chunk_index", "section_title", "content", "content_hash",
--               "embedding": [768 numbers]}, ...]
--
-- Upserts the document (bumping version when its hash changes) and replaces
-- all of its chunks in one transaction, so searches never see a half-loaded
-- document.
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

  insert into public.knowledge_documents (slug, title, content_hash)
  values (p_document->>'slug', p_document->>'title', p_document->>'content_hash')
  on conflict (slug) do update
    set title = excluded.title,
        content_hash = excluded.content_hash,
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

revoke all on function public.cammi_connect_replace_document_chunks(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_replace_document_chunks(jsonb, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security (same model as 0001–0004)
-- ---------------------------------------------------------------------------

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

revoke all on table public.knowledge_documents from anon, authenticated;
revoke all on table public.knowledge_chunks from anon, authenticated;

grant all on table public.knowledge_documents to service_role;
grant all on table public.knowledge_chunks to service_role;

notify pgrst, 'reload schema';
