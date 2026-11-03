-- CamiConnect — administrator module foundation (ADM-00)
--
-- Run after 0012_front_desk_booking.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
--   * adds profiles.is_active. Admins deactivate accounts instead of deleting
--     them; the server's session guards deny an inactive profile for every role.
--   * creates audit_logs, a generic append-only log of admin changes. Appointment
--     history stays in appointment_audit_logs (0007).
--
-- Authorization follows ADR-0003: the server writes with the service-role
-- client and checks the admin role in the application layer. RLS is enabled
-- with no policies, anon/authenticated have no privileges, and service_role may
-- only select and insert. Credential-like keys are stripped from the payloads by
-- the server before insert (src/lib/audit/redact.ts).

alter table public.profiles
  add column if not exists is_active boolean not null default true;

comment on column public.profiles.is_active is
  'False once an admin deactivates the account. Deactivated users cannot use any dashboard; their history is kept.';

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- restrict: a set-null cascade would be an UPDATE, which the log forbids.
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text not null,
  previous_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_target_type_not_blank check (btrim(target_type) <> ''),
  constraint audit_logs_target_id_not_blank check (btrim(target_id) <> '')
);

comment on table public.audit_logs is
  'Append-only audit history of admin changes (ADM-00). action is a dotted verb such as department.update. Rows cannot be updated or deleted.';

create index if not exists audit_logs_target_idx
  on public.audit_logs (target_type, target_id);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

-- Reuses the immutability guard from 0007.
drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.cammi_connect_reject_audit_log_change();

drop trigger if exists audit_logs_no_truncate on public.audit_logs;
create trigger audit_logs_no_truncate
before truncate on public.audit_logs
for each statement execute function public.cammi_connect_reject_audit_log_change();

alter table public.audit_logs enable row level security;

revoke all on table public.audit_logs from anon, authenticated, service_role;
grant select, insert on table public.audit_logs to service_role;
