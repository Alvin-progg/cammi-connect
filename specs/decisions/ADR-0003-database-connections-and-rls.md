# ADR-0003 — Database Connections and RLS

- Status: Accepted
- Date: 2026-10-23
- Amended: 2026-10-25
- Decision owner: Human project owner
- Related ticket: `CC-004`
- Related requirements: `FR-003`, `FR-004`, `FR-006`
- Related specification: `SPEC.md` §6, §6.2, §7.2, §15 item 2

## Context

Supabase PostgreSQL with pgvector is selected. The application uses serverless Route
Handlers and server components. The first data slice is a read-only doctor dashboard
that needs `profiles` and `appointments`, a migration path, and a test strategy.

The earlier proposal assumed a local database, a pooled application connection, and
Drizzle migrations. The project owner instead selected a hosted-only path with the
Supabase Data API for this slice, which removes the database URL and ORM dependencies.

## Decision drivers

- Short setup path for a capstone project.
- Serverless-safe data access.
- Migrations from empty without exposing database passwords.
- Deny-by-default RLS.
- Server-only secrets.
- Testability without a local database.
- No destructive operations without approval.

## Options considered

### Hosted Supabase only (selected)

- Runtime uses `@supabase/supabase-js` with the server-only service-role key.
- Migrations are hand-written SQL applied once through the Supabase SQL editor.
- Unit tests mock the repository; integration verification is a manual hosted smoke test.
- No local or CI database in this slice.

### Local Supabase stack or Compose Postgres

- Better reproducibility and automated integration tests.
- Requires Docker, a local stack, seed automation, and more setup time.
- Deferred until CI or integration testing is in scope.

### Raw SQL with `postgres` and database URLs

- Direct Postgres access with a migration runner.
- Requires `DATABASE_URL` and `DIRECT_URL`, database-password handling, and a new
  dependency.
- Rejected for this slice in favor of the already-installed Supabase client.

### Drizzle ORM

- Typed schema and generated migrations.
- Adds three dependencies and a migration toolchain.
- Rejected because the slice needs two tables and one read join.

## Decision

1. **Hosted-only database.** Development and production use the hosted Supabase
   project. There is no local or CI database in this slice.
2. **Supabase Data API runtime access.** Server-only code creates a
   `@supabase/supabase-js` client with `SUPABASE_SERVICE_ROLE_KEY`. The Data API must
   be enabled for the project.
3. **No database URLs or ORM.** `DATABASE_URL`, `DIRECT_URL`, `postgres`, `drizzle-orm`,
   and `drizzle-kit` are not used.
4. **Deny-by-default RLS.** RLS is enabled on every application table with no permissive
   `anon`/`authenticated` policies. Table privileges are revoked from those roles.
   The service role bypasses RLS, so application-layer authorization is the runtime gate.
5. **Manual migrations.** Schema changes live in `db/migrations/*.sql` and are applied
   through the Supabase SQL editor. This is a manual, one-time step, not an automated
   migration runner.
6. **Test strategy.** Unit and component tests mock the repository and Supabase client.
   Real database verification is a manual hosted smoke test using synthetic data.

## Security note

The service-role key can read and write every table and bypasses RLS. It must remain in
`.env.local` and server-only modules, never in `NEXT_PUBLIC_*` or client code. If the key
leaks, rotate it immediately. A defect in the service layer is not contained by RLS.

The migration revokes `anon`/`authenticated` access and creates no policies, so direct
Data API reads return nothing. The browser never queries `profiles` or `appointments`
directly.

## Consequences

- No new database dependency and no database password is required.
- Migrations are manual and not verified in CI. A future CI slice must revisit this ADR.
- Unit tests cannot prove RLS, grants, or real query behavior; those require the hosted
  smoke test.
- Service-role runtime access has a large blast radius. Application authorization and
  data minimization must be reviewed carefully.
- RLS is defense in depth for the Data API, not a safety net for server bugs.
- Integration and E2E database tests remain blocked until a local/CI strategy is approved.

## Approval

- [x] Hosted-only strategy selected.
- [x] Data API and service-role access approved.
- [x] Deny-by-default RLS and manual migration path approved.
- [x] Test plan approved (mocked unit tests plus manual hosted smoke).
- [x] Human owner approval recorded on 2026-10-25.
