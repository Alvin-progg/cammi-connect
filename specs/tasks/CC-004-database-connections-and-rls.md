# CC-004 — Database Connections and RLS

- Status: Proposed
- Phase: PHASE-00
- Type: Architecture / security decision
- Approval required: yes
- ADR: [`ADR-0003`](../decisions/ADR-0003-database-connections-and-rls.md)
- Depends on: CC-001
- Blocks: CC-005, CC-103, CC-104, CC-105, CC-801

## Objective

Approve the local/test database strategy, connection modes, migration path, and the
relationship between application authorization, Supabase RLS, and `service_role`.

## Requirement and specification references

- `SPEC.md` §6, §6.2, §7.2, §15 item 2
- `TEST.md` `I-DB-01`, `I-DB-02`, `I-DB-03`, `I-DB-04`, `I-DB-05`, `I-DB-06`, `S-18`, `S-21`
- No requirement is implemented here.

## Decision required

- Local development: Supabase CLI local stack or pinned Docker Compose pgvector image.
- Application connection: transaction-mode pooler or another approved mode.
- Prepared-statement setting for the chosen driver/ORM.
- Migration connection: direct or session mode.
- Database roles used by the app and by migrations.
- RLS model: deny-by-default policies and whether the Data API is disabled.
- Whether the server uses `service_role`; if so, document that RLS does not constrain it.
- How `I-DB-04` and `I-DB-06` will be verified against real Supabase behavior.

## Acceptance criteria

- `ADR-0003` is approved with exact connection modes and role model.
- RLS is not presented as a substitute for server-side authorization.
- The service-role key and connection strings remain server-only.
- Local, CI, preview, and hosted migration paths are documented.
- A concrete test plan exists for RLS, pooling, and migrations from empty.
- Destructive database operations remain approval-gated.

## Evidence

- Approved `ADR-0003`.
- Current Supabase connection/RLS documentation.
- Human approval record.

## Out of scope

- Creating the database.
- Running migrations.
- Installing Drizzle or a database driver.
