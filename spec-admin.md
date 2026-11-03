# CamiConnect — Administrator Module: Implementation Slices

Source: *CAMICONNECT — ADMINISTRATOR MODULE* (Proposed Specification).
Approach: SDD + TDD. Each slice is a vertical, independently shippable unit (migration → RLS → server logic → UI → tests) sized for one focused OpenCode session. Hand the agent **one slice file at a time**, plus this README for context.

## Slice map

| # | Slice | Spec § | Depends on | Size |
|---|---|---|---|---|
| ADM-00 | Foundation: roles, admin guard, shell, audit log | 3, 5.4, 16, 18 | — | M |
| ADM-01 | User & role management | 3.1, 5 | 00 | M |
| ADM-02 | Departments | 6 | 00 | S |
| ADM-03 | Specialties | 7 | 00 | S |
| ADM-04 | Doctors + specialty assignment | 8 | 01, 02, 03 | M |
| ADM-05 | Weekly doctor schedules | 9.1, 9.2, 9.4 | 04 | M |
| ADM-06 | Schedule exceptions + appointment protection | 9.3, 9.4 | 05 | M |
| ADM-07 | Hospital services | 10 | 02 | S |
| ADM-08 | Appointment requirements | 11 | 03, 07 | S |
| ADM-09 | Appointment monitoring (read-only) | 3.4, 12 | 04 | M |
| ADM-10 | Analytics metric layer (SQL + definitions) | 13.1, 13.3, 13.4 | 09 | M |
| ADM-11 | Analytics page: 6 charts, filters, CSV | 13.2, 13.5 | 10 | M |
| ADM-12 | Admin dashboard | 4 | 10 | M |
| ADM-13 | Knowledge documents: CRUD + publishing lifecycle | 14.1, 14.2, 14.4 | 00 | M |
| ADM-14 | Ingestion pipeline: chunk → embed → pgvector | 14.3, 14.4 | 13 | L |
| ADM-15 | System configuration | 15 | 00 | S |
| ADM-16 | Audit log viewer + security/E2E hardening | 16, 18, 20 | all | M |

## Suggested build order

```
ADM-00 ─┬─ ADM-01 ─┐
        ├─ ADM-02 ─┼─ ADM-04 ─┬─ ADM-05 ─ ADM-06
        ├─ ADM-03 ─┘          └─ ADM-09 ─ ADM-10 ─┬─ ADM-11
        │                                         └─ ADM-12
        ├─ ADM-07 ─ ADM-08 (also needs 03)
        ├─ ADM-13 ─ ADM-14
        └─ ADM-15
ADM-16 last
```

Milestones:
1. **Admin can log in and configure the hospital** — 00 → 04
2. **Doctors bookable** — 05, 06 (unblocks patient portal + front desk)
3. **Oversight & analytics** — 09 → 12
4. **Cami AI knowledge** — 13, 14 (can run in parallel with milestone 3)
5. **Config + hardening** — 07, 08, 15, 16

## Rules that apply to every slice

- **Reconcile first.** Before writing a migration, check existing migrations in the repo. Extend existing tables; never create duplicates (spec §17).
- **Server is the authority.** Every mutation goes through a Route Handler or Server Action that (1) authenticates via Supabase Auth, (2) checks role server-side, (3) validates input with a Zod schema, (4) writes, (5) records an audit event. Hiding UI is never the security boundary.
- **RLS on every new table.** Admin-only tables get `select/insert/update` policies gated by `public.is_admin()` (from ADM-00). No `delete` policies on records with history — deactivate instead.
- **Never delete history.** Deactivation = `is_active = false`. Appointments, doctor associations, and audit rows are never removed by normal app operations.
- **Asia/Manila.** Store `timestamptz`; schedule times are `time` interpreted in `Asia/Manila`. Do date bucketing in SQL with `AT TIME ZONE 'Asia/Manila'`.
- **No secrets in the browser.** Service-role key and Gemini/OpenCode keys are server-only (`import 'server-only'`).
- **Tests first.** Each slice lists the tests to write before implementation. Minimum per slice: unit tests for pure logic, RLS tests for each new table (admin allowed / non-admin denied), one E2E happy path.

## Open decisions (resolve before the slice that needs them)

| # | Question | Needed by | Proposed default |
|---|---|---|---|
| D1 | Spec §17 has no general audit table, only `appointment_audit_logs`. | ADM-00 | Add a generic `audit_logs` table for admin events; keep `appointment_audit_logs` for appointment status history. |
| D2 | Role storage: `profiles.role` column vs. separate `user_roles` table vs. JWT custom claim. | ADM-00 | Single `profiles.role` enum + trigger blocking role changes outside a security-definer function. Add JWT claim hook later only if RLS performance needs it. |
| D3 | Can an admin confirm appointments? (§3.4) | ADM-09 | **No** for now. Read-only monitoring. Add as an explicit, audited permission later if the hospital asks. |
| D4 | Dashboard cards: scheduled date or activity date? (§4.1) | ADM-12 | Total/Confirmed/Completed/No-show → **scheduled date**. Pending → **current snapshot**. Cancelled → **cancellation date**. Label each card. |
| D5 | Rate denominators (§13.1) | ADM-10 | See ADM-10 metric definitions table. Get adviser sign-off. |
| D6 | What happens to future confirmed appointments when a doctor/department is deactivated or a schedule exception is added? | ADM-04, ADM-06 | Block the change and list conflicting appointments; front desk must reschedule/cancel first. Never auto-move. |
| D7 | Do structured records (doctors, departments, services, requirements) auto-generate knowledge docs, or does the admin write them manually? | ADM-13 | Manual documents only for v1. Auto-sync from structured tables is a later slice. |
| D8 | Request expiration policy value (§15). | ADM-15 | Store as config; default off until hospital provides the policy. |
| D9 | Service-level scheduling / equipment capacity (§10). | ADM-07 | Out of scope. Services are informational + requirements only. |