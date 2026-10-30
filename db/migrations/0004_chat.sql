-- CamiConnect — patient chat conversations (AI-APT-001, slice S1)
--
-- Stores each patient's chat conversations and messages, together with the
-- server-owned booking state that later slices use. Run after
-- 0003_doctor_specialty_schedules.sql in the hosted Supabase project's SQL
-- editor.
--
-- Security model is unchanged from 0001–0003: RLS enabled with no permissive
-- policies, anon/authenticated revoked, service_role only. The application
-- scopes every query by the patient ID from the session.
--
-- Retention (ADR-0008): chat_messages are kept for 90 days and purged by the
-- manual SQL step in db/README.md. There is no automated job.

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  booking_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_patient_updated_idx
  on public.chat_conversations (patient_id, updated_at desc);

drop trigger if exists chat_conversations_set_updated_at on public.chat_conversations;
create trigger chat_conversations_set_updated_at
before update on public.chat_conversations
for each row execute function public.cammi_connect_set_updated_at();

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);

-- Supports the 90-day retention purge.
create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security (same model as 0001–0003)
-- ---------------------------------------------------------------------------

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.chat_conversations from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;

grant all on table public.chat_conversations to service_role;
grant all on table public.chat_messages to service_role;

notify pgrst, 'reload schema';
