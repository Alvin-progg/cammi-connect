# FD-001 — Front Desk Appointment Management

- Status: In progress (PR 1 committed `8a2009f`; PR 2 committed `3085b61`; PR 3 committed `d63cb77`; PR 4 committed `9bfb7a4`; PR 5 committed `4c48037`; PR 6 committed `8e783f8`; PR 7 implemented 2026-11-03, awaiting review)
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

## PR 4 — traceability

| Requirement (SPEC-frontdesk) | Implementation | Verification |
|---|---|---|
| §6 confirm through a controlled backend operation: still pending, availability re-checked, staff and timestamp recorded, success only after commit | `cammi_connect_confirm_appointment` (0009); `confirmRequest` and `confirmRequestAction`; `RequestDecision` confirm dialog | `tests/unit/front-desk/service.test.ts`, `actions.test.ts`, `tests/component/front-desk/request-decision.test.tsx`; smoke step 18 |
| §6 reject with a required reason; staff recorded; never deleted | `cammi_connect_reject_appointment` (0009); `rejectRequestSchema` (SPEC §6 presets, details required for "Other"); reject dialog | `tests/unit/front-desk/decisions.test.ts`, `service.test.ts`, `actions.test.ts`, `request-decision.test.tsx`; smoke step 18 |
| §14 staff can verify doctor and schedule availability | `checkRequestSlot` (reuses `validateAppointmentSlot`); "Schedule check" field | `service.test.ts`, `request-details.test.tsx` |
| §14 concurrent confirmation cannot double-book | Row lock plus the `not_pending` check; the pending row already holds its slot under `appointments_no_active_overlap` | smoke step 18 (two tabs) |
| §14 rejected requests retain their history; every action audited | Audit row written inside each function | smoke step 18 |
| §3 server-side role authorization | Both actions call `getFrontDeskSession` and never write without it; the staff ID comes from the session | `actions.test.ts` |
| §13 the AI cannot confirm | Only front desk actions call the confirm function; the chat tools have no confirm; the 0007 AI insert guard still applies | `tests/unit/chat/tools.test.ts` (existing) |
| ADR-0007 "Who confirms" | `confirm` removed from `DOCTOR_APPOINTMENT_ACTIONS`, `confirmAppointmentAction` and the doctor UI | `tests/unit/appointments/transitions.test.ts`, `mutations.test.ts`, `tests/component/doctor/week-schedule.test.tsx` |

**Changed doctor tests.** Removing doctor confirm is an approved behavior change. Each change is listed here so it can be reviewed:
- **`transitions.test.ts`:**
  - "allows confirm and cancel from requested" now asserts that requested allows only `cancel`.
  - `canDoctorPerform("confirmed", "confirm") === false` became an exact `allowedDoctorActions("confirmed")` list.
  - The `targetStatusForAction("confirm")` and `sourceStatusesForAction("confirm")` checks were removed (`sourceStatusesForAction("complete")` replaces the second), and `isDoctorAppointmentAction("confirm")` now expects false, in a new test.
- **`mutations.test.ts`:** the success, illegal-transition, scope and race cases use `complete` instead of `confirm`, with the same assertions.
- **`week-schedule.test.tsx`:** the popover asserts there is no Confirm button and shows "Awaiting front desk confirmation".

**Limitations.**
- There is no automated test of the SQL functions (ADR-0003: no local database). They are covered by smoke step 18.
- Patients learn the outcome only by viewing their appointments. Notifications and showing the rejection reason come in PR 9.

## PR 5 — traceability

Decisions (2026-11-03):
- Attendance is written by one atomic database function (`0010`), like PR 4.
- Attendance can be recorded only from the appointment's Manila calendar day onward.
- The details page opens appointments from every booking source; the request queue
  stays Cami-only.
- Doctors may complete a `checked_in` appointment (ADR-0007 amendment).

| Requirement (SPEC-frontdesk) | Implementation | Verification |
|---|---|---|
| §8 daily schedule: time, patient, doctor, specialty, status, booking source | `/front-desk/schedule`; `listDailySchedule` and `supabaseFrontDeskScheduleRepository` (all sources, 200-row limit); `DailySchedule` | `tests/unit/front-desk/service.test.ts`, `tests/component/front-desk/daily-schedule.test.tsx`; smoke step 19 |
| §8 view by date, filter by doctor and status, search patients | `parseScheduleFilters` in `src/lib/front-desk/schedule.ts`; name search in the service | `tests/unit/front-desk/schedule.test.ts`, `service.test.ts` |
| §8 open appointment details | `getRequest` no longer limited to `ai_chatbot`; details page breadcrumb follows the source | smoke step 19 |
| §8 attendance: confirmed → checked_in, completed, no_show; checked_in → completed | `allowedAttendanceActions` (uses `canTransition`); `cammi_connect_record_attendance` (0010); `recordAttendance`, `recordAttendanceAction`; `AttendanceActions` (no-show asks first) | `schedule.test.ts`, `service.test.ts`, `tests/unit/front-desk/actions.test.ts`, `tests/component/front-desk/attendance-actions.test.tsx`; smoke step 19 |
| §8 record the staff member and timestamp | Audit row written inside the function with `actor_profile_id` = session staff ID; `created_at` and `new_values.recorded_at` | `actions.test.ts` (staff ID from session, not the form); smoke step 19 |
| §3 server-side role authorization | `recordAttendanceAction` and the page call `getFrontDeskSession`; no write without it | `actions.test.ts` |
| §11 checked_in → completed by the doctor | `complete` sources are `confirmed` and `checked_in` | `tests/unit/appointments/transitions.test.ts`, `mutations.test.ts` |

**Changed doctor tests.** Letting doctors complete checked-in visits is an approved behavior change:
- **`transitions.test.ts`:** `sourceStatusesForAction("complete")` now expects `["confirmed", "checked_in"]` (was `["confirmed"]`). New test: from `checked_in` only `complete` is allowed.
- **`mutations.test.ts`:** the "completes a confirmed appointment" case now expects the guarded write's `from` to be `["confirmed", "checked_in"]`. New test: a doctor completes a checked-in appointment and the history records `checked_in → completed`.

**Limitations.**
- The SQL function has no automated test (ADR-0003: no local database). Smoke step 19 covers it.
- The patient search runs over the day's first 200 appointments. A notice shows when the limit is reached.
- The details page still labels its ID field "Request ID" for every booking source.
- Doctor completion of a checked-in visit uses the existing doctor write path: a guarded update, then a separate audit insert. It is not the atomic function.

## PR 6 — traceability

Decisions (2026-11-03):
- **Same doctor only.** A reschedule picks another free slot from the current
  doctor's availability. A change of doctor means cancelling and booking again (PR 7).
- **Reasons are presets plus details**, like reject. "Other" requires details. Both
  reschedule and cancel require a reason.
- Both writes are atomic database functions (`0011`), like PRs 4 and 5.
- Both apply to `requested` and `confirmed`. A reschedule keeps the status (§11), so a
  pending request still needs confirmation.

| Requirement (SPEC-frontdesk) | Implementation | Verification |
|---|---|---|
| §9 rescheduling steps 1–2: open the appointment, retrieve alternative schedules | "Reschedule" on the details page; `/front-desk/requests/[id]/reschedule` with a date picker; `listRescheduleSlots` (uses `generateAvailableSlots` and leaves the appointment's own interval out of the overlap check) | `tests/unit/front-desk/service.test.ts`; smoke step 20 |
| §9 rescheduling steps 3–8: select, review, confirm, update, record staff, visible to patient | `RescheduleForm`; `rescheduleAppointmentSchema`; `rescheduleAppointmentAction`; `cammi_connect_reschedule_appointment` (0011) re-checks the slot and writes the audit row with `previous_values`/`new_values` | `tests/unit/front-desk/decisions.test.ts`, `actions.test.ts`, `tests/component/front-desk/reschedule-form.test.tsx`; smoke step 20 |
| Rescheduling into a taken slot fails | `appointments_no_active_overlap` (23P01) rolls the function back; the service shows "That slot was just taken" | `service.test.ts`, `actions.test.ts`; smoke step 20 (two tabs) |
| §9 cancellation: action, required reason, confirm, update status, staff and timestamp | `CancelAppointment` dialog; `cancelAppointmentSchema`; `cancelAppointmentAction`; `cammi_connect_cancel_appointment` (0011) sets `cancellation_reason` and `cancelled_by_role` and writes the audit row (`new_values.cancelled_at`) | `decisions.test.ts`, `service.test.ts`, `actions.test.ts`, `tests/component/front-desk/request-decision.test.tsx`; smoke step 20 |
| Cancelling a completed appointment fails | `canFrontDeskCancel` (uses `canTransition`) hides the control; the function raises `not_cancellable` | `decisions.test.ts`, `actions.test.ts`; smoke step 20 |
| §9 every change in the audit history | History shows "Moved from … to …" from `previous_values` and `new_values` | `tests/component/front-desk/request-details.test.tsx` |
| §3 server-side role authorization | Both actions and the reschedule page call `getFrontDeskSession`; no write happens without it; the staff ID comes from the session, never the form | `actions.test.ts` |

**Refactor.** The reject reason radios and details moved into a shared `ReasonFields` component (`src/components/front-desk/reason-fields.tsx`). The reject preset-plus-details schema logic is now shared with cancel and reschedule. No reject test changed.

**Limitations.**
- The SQL functions have no automated test (ADR-0003: no local database). Smoke step 20 covers them.
- The reschedule page shows one day at a time and does not check that the doctor is still active before listing slots. The function refuses an inactive doctor on submit.
- The doctor-side reschedule and cancel (`/doctor`) still use the older non-atomic path (a guarded update, then a separate audit insert).
- Patients see the new time or the cancellation in their appointments. Notifications come in PR 9.


## PR 7 — traceability

Decisions (2026-11-03):
- **New patients are records only, with no login.** Staff register a walk-in or
  phone-in patient as a `profiles` row (`role = 'patient'`, `auth_user_id` null) with
  a name and a required phone, stored normalized (separators removed). No email or
  password is collected. A registration with a phone number already on file is
  refused.
- **Staff bookings are confirmed at once.** The staff member checks availability with
  the patient, so `cammi_connect_front_desk_book_appointment` (0012) inserts the
  appointment as `confirmed`. Only Cami requests go through the queue.
- A doctor is required before slots are shown. Specialty is an optional filter; when
  chosen it is stored in `specialty_id` and checked against the doctor.

| Requirement (SPEC-frontdesk) | Implementation | Verification |
|---|---|---|
| §7 steps 1–2: search for a patient, register one if none exists | `/front-desk/book` step 1; `patientSearchSchema`, `normalizePhone`, `registerPatientSchema` (`src/lib/front-desk/booking.ts`); `searchPatients`, `registerPatient`; `supabaseFrontDeskPatientsRepository` (patients only); `registerPatientAction`; `RegisterPatientForm` | `tests/unit/front-desk/booking.test.ts`, `service.test.ts`, `actions.test.ts`, `tests/component/front-desk/register-patient-form.test.tsx`; smoke step 21 |
| §7 steps 3–6: specialty, doctor, available slots, choose a slot | Step 2 GET form (specialty, doctor, date); `listBookingSlots` (uses `getAvailableSlots`, the same source as Cami) | `service.test.ts`; smoke step 21 |
| §7 steps 7–8: review and submit | `BookingForm` review panel and "Book and confirm"; `frontDeskBookingSchema`; `bookForPatientAction`; `cammi_connect_front_desk_book_appointment` (0012) | `booking.test.ts`, `actions.test.ts`, `tests/component/front-desk/booking-form.test.tsx`; smoke step 21 |
| Owner and creator stay distinct; booking source and staff identity recorded | `patient_id` from the chosen patient; `created_by_profile_id`/`confirmed_by_profile_id` from the session staff, never the form; `booking_source = 'front_desk'` | `service.test.ts`, `actions.test.ts` (posted `staffId` ignored); smoke step 21 |
| An overlapping slot is rejected | `appointments_no_active_overlap` (23P01) rolls the function back; "That slot was just taken" | `service.test.ts`, `actions.test.ts`; smoke step 21 (two tabs) |
| The audit row is written | One `created` row with `new_status = 'confirmed'` and the staff member, in the same transaction | smoke step 21 |
| §14 walk-in and phone-in bookings | "New appointment" in the front desk navigation | `tests/component/front-desk/front-desk-shell.test.tsx` |
| §3 server-side role authorization | The page and both actions call `getFrontDeskSession`; nothing is written without it | `actions.test.ts` |

**Refactor.** The phone pattern in `src/lib/profiles/schemas.ts` is now exported (`PHONE_PATTERN`) and shared with patient registration. The doctor profile rule is unchanged. The front desk service's refusal mapping moved into one `refusalMessage` helper, also unchanged in behavior.

**Limitations.**
- The SQL function has no automated test (ADR-0003: no local database). Smoke step 21 covers it.
- A walk-in record is not linked to an account if the patient later signs up; they get a second profile.
- Search covers name and phone only, not email (emails live in Supabase Auth). Patients who registered online usually have no phone on file.
- Existing phone numbers entered before PR 7 are not normalized, so the duplicate check and phone search only match numbers stored in the new form.
- The slot-grid SQL is now copied in three functions (0007, 0011, 0012).
- Booking succeeds by navigating to the appointment details. There is no toast.
