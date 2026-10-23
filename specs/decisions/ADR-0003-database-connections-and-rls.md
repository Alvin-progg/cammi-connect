# ADR-0003 — Database Connections and RLS

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-004`
- Related requirements: `FR-003`, `FR-004`, `FR-006`
- Related specification: `SPEC.md` §6, §6.2, §7.2, §15 item 2

## Context

Supabase PostgreSQL with pgvector is selected. The application uses serverless Route
Handlers. Local/test parity, transaction-mode pooling, prepared statements, migration
connections, and Row Level Security must be defined before schema and test work.

## Decision drivers

- Reproducible local and CI databases.
- Serverless-safe connection pooling.
- Short transactions.
- Migrations from empty.
- pgvector support.
- Deny-by-default RLS.
- Server-only secrets.
- No destructive operations without approval.

## Options considered

### Local database

- Supabase CLI local stack for parity.
- Pinned pgvector Docker image via Compose.

### Application connection

- Supabase transaction-mode pooler with prepared statements disabled.
- Direct/session connection, only if verified as serverless-safe.

### Migrations

- Direct or session-mode connection.

### RLS

- RLS enabled on every application table with no permissive `anon`/`authenticated`
  policies; Data API disabled or restricted.
- Application access through server-only credentials.

No option is selected.

## Security note

`service_role` bypasses RLS. If the server uses it, RLS protects the Data API but does
not replace application-layer authorization. This must be stated explicitly in the
security documentation.

## Decision

TBD. Record local strategy, connection modes, roles, RLS model, and test plan.

## Consequences

- Phase 1 database tickets are blocked.
- `I-DB-04` and `I-DB-06` verification approach is undefined.
- `S-18` and `S-21` cannot be verified.
- No schema or migration work may begin.

## Approval

- [ ] Local strategy selected.
- [ ] Connection and migration modes selected.
- [ ] Role/RLS model approved.
- [ ] Test plan approved.
- [ ] Human owner approval recorded.
