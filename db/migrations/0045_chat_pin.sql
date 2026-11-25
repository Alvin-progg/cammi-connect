-- CamiConnect — pin patient chat conversations
--
-- Run in the hosted Supabase project's SQL editor. This file can run in one go.
--
-- Patients can pin a conversation to the top of the chat sidebar. Pinning
-- sets or clears chat_conversations.pinned_at. Pinning must not move
-- updated_at: updated_at orders the list, and it starts the 12-month retention
-- clock (SPEC §7.3). So the updated_at trigger skips updates that change only
-- pinned_at. Any other update still bumps updated_at, as before.

alter table public.chat_conversations
  add column if not exists pinned_at timestamptz;

drop trigger if exists chat_conversations_set_updated_at on public.chat_conversations;
create trigger chat_conversations_set_updated_at
before update on public.chat_conversations
for each row
when (old.pinned_at is not distinct from new.pinned_at)
execute function public.cammi_connect_set_updated_at();
