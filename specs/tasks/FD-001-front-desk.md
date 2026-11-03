# FD-001 — Front Desk Appointment Management

- Status: In progress (PR 1 committed `8a2009f`; PR 2 committed `3085b61`; PR 3 implemented 2026-11-03, awaiting review)
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

## PR 2 — traceability

| Requirement (SPEC-frontdesk) | Implementation | Verification |
|---|---|---|
| §3 front desk role | `0008_front_desk_role.sql`; `USER_ROLES` in `src/lib/auth/roles.ts`; seed `SEED_FRONT_DESK_EMAIL` | smoke step 16 |
| §3 server-side role authorization | `getFrontDeskSession` in `src/server/auth/dal.ts`; `/front-desk` page renders access denied for any other role | `tests/unit/auth/front-desk-session.test.ts` |
| §3, §14 staff cannot use admin functions | `getAdminSession` denies `front_desk`, so admin pages show access denied and admin actions return an error | `tests/unit/auth/admin-session.test.ts`; existing `directory/actions` and `schedules/actions` tests for the null-session path |
| §3 no patient-only access | `getPatientSession` and `resolvePatientForApi` deny `front_desk` (`/chat`, and 403 on `/api/v1/chat`) | `admin-session.test.ts`, `patient-api-access.test.ts` |
| §3 staff are not doctors | `getDoctorSession` denies `front_desk` | `doctor-session.test.ts` |
| §14 staff reach their dashboard | sign-in lands on `/front-desk`; `src/proxy.ts` protects `/front-desk` | `tests/unit/auth/actions.test.ts`, `tests/unit/auth/proxy.test.ts` |
| Layout (sidebar, top bar, breadcrumb) | `src/components/front-desk/front-desk-shell.tsx`; design.md §6.10 | `tests/component/front-desk/front-desk-shell.test.tsx`, `front-desk-error.test.tsx` |

Open item: `cammi_connect_upsert_doctor` (0003) refuses to convert an admin profile
but not a `front_desk` profile, so an admin could turn a staff account into a doctor.
Unchanged in PR 2; tighten in a later migration if wanted.

## PR 3 — traceability

Decisions (2026-11-03):
- **No chat link.** Appointments are not linked to chat conversations, and staff see
  no chat text. The details page shows the patient's stated reason and the booking
  metadata instead.
- **Contact is the email plus the phone when set.**
  - The email is the patient's sign-in email, read server-side through the
    service-role Auth admin API.
  - The phone comes from `profiles.phone`.
  - Either one shows "not provided" when it is missing.

| Requirement (SPEC-frontdesk) | Implementation | Verification |
|---|---|---|
| §5 queue of Cami requests | `/front-desk/requests`; `listRequestQueue` and `supabaseFrontDeskRequestsRepository` (`booking_source = ai_chatbot` only, 100-row limit) | `tests/unit/front-desk/service.test.ts`; smoke step 17 |
| §5 queue fields (request ID, patient, contact, specialty, doctor, date, time, submitted, status) | `RequestQueue` component | `tests/component/front-desk/request-queue.test.tsx` |
| §5 filters (pending, confirmed, rejected, cancelled, date, doctor, specialty) | `parseRequestQueueFilters` in `src/lib/front-desk/requests.ts`; the service maps pending to `requested` and the date to a Manila day | `tests/unit/front-desk/requests.test.ts`, `service.test.ts` |
| §5 request details with previous status changes | `/front-desk/requests/[id]`; `RequestDetailsView`; history from `appointment_audit_logs` with actor names | `tests/component/front-desk/request-details.test.tsx`; smoke step 17 |
| §3 server-side role authorization | Both pages call `getFrontDeskSession` and show access denied otherwise; a malformed, unknown or non-Cami ID gets not found | `front-desk-session.test.ts`, `service.test.ts`; smoke step 17 |
| §14 "pending requests appear in a centralized queue", "staff can view complete request details" | as above | as above |

Limitations:
- **No requested specialty on chat bookings.** `cammi_connect_book_appointment` doesn't record `specialty_id`, so the queue shows the doctor's specialties. Capturing the specialty needs a migration and is a possible follow-up.
- **No "relevant appointment requirements".** §5 lists them, but no data source exists, so they are not shown.
- **No chat context.** By decision, staff see no AI conversation context.
- **No pagination.** The queue shows the first 100 matches, ordered by appointment time.
