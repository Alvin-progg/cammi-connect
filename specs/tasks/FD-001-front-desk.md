# FD-001 — Front Desk Appointment Management

- Status: In progress (PR 1 implemented 2026-11-03, awaiting review)
- Type: Feature
- Priority: High
- Module: Front Desk Staff
- Specification: [`SPEC-frontdesk.md`](../../SPEC-frontdesk.md)
- ADRs: [`ADR-0003`](../decisions/ADR-0003-database-connections-and-rls.md) (note
  2026-11-03), [`ADR-0007`](../decisions/ADR-0007-appointment-and-doctor-policy.md)
  (amendment 2026-11-03)

## Objective

Give front desk staff a dashboard where they review appointment requests that Cami
submits, confirm or reject them, manage day-of attendance, reschedule and cancel, and
book appointments for walk-in and phone-in patients. Cami can only submit requests;
confirmation is a staff action.

## Approved scope decisions (2026-11-03)

1. **Authorization stays in the server layer (ADR-0003).** Front-desk access goes
   through a DAL guard and the service-role client. No front-desk RLS policies.
2. **`requested` is kept** as the stored value for the spec's `pending_confirmation`,
   labelled "Pending confirmation". Only `rejected` and `checked_in` are added.
3. **One audit table.** `appointment_audit_logs` is backfilled from
   `appointment_status_history` and replaces it for all writes and reads.
4. **Front desk confirms, doctors don't.** Doctors lose `confirm` in PR 4.
5. **Database checks are manual.** There is no local or CI database (ADR-0003), so
   constraints, triggers, grants, and concurrency are checked by the numbered smoke
   steps in `db/README.md`. Vitest covers the domain logic and services.

## Slices

Each PR uses TDD and stops for review.

| PR | Goal | Open decision before starting |
|---|---|---|
| 1 | Lifecycle schema: new statuses, booking source and creator columns, AI-insert guard, overlap guard extended to `checked_in`, append-only `appointment_audit_logs`, `canTransition` | — |
| 2 | `front_desk` role (enum-only migration), `getFrontDeskSession`, `/front-desk` in `src/proxy.ts`, empty shell layout | — |
| 3 | Read-only request queue (status, date, doctor, specialty filters) and request details with audit history | Whether to link appointments to chat conversations and show an excerpt (privacy) |
| 4 | Atomic confirm and reject database functions, Server Actions, dialogs; remove the doctor `confirm` action | — |
| 5 | Daily schedule with booking-source badges; check-in, complete, and no-show, each audited | — |
| 6 | Atomic reschedule and cancel with required reasons and previous/new values in the audit log | — |
| 7 | Staff-assisted booking for walk-in and phone-in patients (`booking_source = front_desk`) | How staff register a patient with no account (ADR-0001) |
| 8 | Dashboard overview: four Manila-day summary cards, pending first, recent activity, quick search | — |
| 9 | Patient status view with reasons, and in-app patient notifications | Page or chat view; `patient_notifications` table |

## PR 1 — traceability

| Requirement (SPEC-frontdesk) | Implementation | Verification |
|---|---|---|
| §11 statuses and transitions | `src/lib/appointments/status.ts`, `transitions.ts` (`canTransition`) | `tests/unit/appointments/transitions.test.ts`, `status.test.ts` |
| §10 booking source, creator, confirmer, reasons | `0007` columns; booking function takes source and creator; chat books as `ai_chatbot` | `tests/unit/appointments/booking.test.ts`, `tests/unit/chat/tools.test.ts`; smoke step 15 |
| §10 audit history, append-only | `appointment_audit_logs` plus immutability trigger and grants; the repository writes and reads it | `tests/unit/appointments/audit.test.ts`; smoke step 15 |
| §13 database-level double-booking prevention | `appointments_no_active_overlap` covers `checked_in`; `SLOT_HOLDING_STATUSES` | `status.test.ts`; smoke step 15 |
| §13 the AI cannot bypass confirmation | `appointments_guard_ai_booking` trigger | smoke step 15 |
| §6 rejected rows keep a reason | `appointments_rejection_reason_required` | smoke step 15 |
