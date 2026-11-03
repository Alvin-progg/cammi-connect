-- CamiConnect — front desk staff role (FD-001, PR 2)
--
-- Adds the front_desk value to user_role (SPEC-frontdesk §3). Authorization
-- stays in the server layer (ADR-0003): getFrontDeskSession in
-- src/server/auth/dal.ts guards every front desk page and action. No RLS
-- policies are added.
--
-- Run this file ON ITS OWN. PostgreSQL cannot use a newly added enum value in
-- the same transaction that added it, and the Supabase SQL editor runs a
-- script as one transaction.
--
-- Front desk accounts are provisioned by the seed script only
-- (SEED_FRONT_DESK_EMAIL); there is no self-registration or admin UI for them.

alter type public.user_role add value if not exists 'front_desk';
