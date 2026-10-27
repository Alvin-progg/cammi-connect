# ADR-0007 — Appointment and Doctor-Scope Policy

- Status: Accepted
- Date: 2026-10-23
- Amended: 2026-10-25 (doctor mutation slice)
- Decision owner: Human project owner
- Related ticket: `CC-008`
- Related requirements: `FR-004`, `FR-005`, `UI-003`, `UI-004`
- Related specification: `SPEC.md` §6.1, §7.1, §15 item 9

## Context

Availability, booking, cancellation, rescheduling, status transitions, and doctor scope
must be authoritative database rules. The first doctor slice is read-only and needs an
explicit scope, patient-field policy, status vocabulary, and timezone before UI and tests
can be written.

**2026-10-25 amendment:** the human project owner approved the doctor mutation slice for
the full doctor dashboard: doctors may confirm, complete, mark no-show, **cancel with a
recorded reason**, and **initiate rescheduling** against their own schedule and
availability. Weekly schedules, blocked slots, appointment status history, doctor
notifications, and appointment statistics were approved in the same session.

## Decision drivers

- Concurrency-safe booking.
- No double-booking.
- Explicit legal status transitions.
- Patient ownership enforcement.
- Doctor data minimization.
- Timezone correctness.
- Auditability.

## Decision

### Status model

The approved statuses are:

| Status | Meaning |
|---|---|
| `requested` | Patient request received; not yet confirmed. |
| `confirmed` | Doctor or staff confirmed the appointment. |
| `completed` | Visit occurred and is closed. |
| `cancelled` | Appointment will not happen. |
| `no_show` | Patient did not attend. |

Approved transitions:

| From | To | Actor |
|---|---|---|
| `requested` | `confirmed` | Doctor or admin |
| `requested` | `cancelled` | Doctor (reason required), patient, or admin |
| `confirmed` | `completed` | Doctor |
| `confirmed` | `no_show` | Doctor |
| `confirmed` | `cancelled` | Doctor (reason required), patient, or admin |

`completed`, `cancelled`, and `no_show` are terminal. Doctor cancellation requires a
recorded reason stored on the appointment (`cancellation_reason`,
`cancelled_by_role = 'doctor'`). Patient cancellation rules, including any window, remain
deferred. Admin overrides are deferred.

### Rescheduling (doctor-initiated)

- A doctor may reschedule their own `requested` or `confirmed` appointment to a new
  `scheduled_at`.
- The new time must be in the future, fall fully inside one of the doctor's active
  weekly schedule windows (Manila time), not intersect any blocked slot, and not
  overlap another active (`requested`/`confirmed`) appointment of the same doctor.
- The previous time is recorded (`rescheduled_from_at`) and a status-history row is
  written with the reason.

### Audit history

Every doctor transition and reschedule writes a row to
`appointment_status_history` with from/to status, the acting profile, the reason when
collected, and a `scheduled_at` snapshot.

### Doctor scope

- A doctor sees **only their own appointments**.
- The doctor identifier comes from the authenticated profile, never from a URL or query
  parameter.
- Access by another doctor, a patient, or an unlinked account is denied.
- The dashboard returns only these patient fields: `full name`, `reason`, `scheduled
  time`, and `status`.
- Patient identifiers, email addresses, phone numbers, and clinical records are not
  selected into the dashboard DTO.

### Timezone

- Display and day boundaries use `Asia/Manila` (PHT, UTC+08:00).
- A "day" is `[00:00, 24:00)` in Manila. Manila has no daylight-saving changes.
- Stored timestamps use `timestamptz`; formatting happens at the presentation boundary.

### Scheduling model (approved 2026-10-25)

- `doctor_schedules` stores one row per doctor per weekday (`day_of_week` 0–6,
  Sunday-first), with `start_time`, `end_time`, `slot_duration_minutes`
  (15/30/45/60), and an `is_active` flag.
- `doctor_blocked_slots` stores `[starts_at, ends_at)` unavailability intervals with a
  required reason.
- Double-booking is rejected in the service layer (friendly error) and enforced in the
  database by a partial exclusion constraint on active appointments overlapping
  `[scheduled_at, scheduled_at + duration_minutes)`.
- Cancellation windows, reschedule limits, and slot generation for patient self-booking
  remain deferred.

## Consequences

- The doctor dashboard can implement the approved mutation, schedule, notification,
  profile, and statistics modules with deterministic tests.
- Cross-doctor data is denied in the DAL/service layer and the query is scoped by the
  session doctor ID.
- Patient self-booking, patient cancellation windows, admin overrides, and slot
  generation remain unimplemented.
- `U-APT-03`, `U-APT-04`, `U-APT-05`, and `U-APT-07` remain partially specified until
  patient-side scheduling work is approved.
- E2E booking flows cannot be specified yet.
- Doctor provisioning remains manual or seed-based until an admin flow exists.

## Approval

- [x] Transition matrix approved (amended 2026-10-25: doctor cancel + reschedule).
- [x] Doctor scope and patient fields approved.
- [x] Status vocabulary and doctor permissions approved.
- [x] Timezone approved (`Asia/Manila`).
- [x] Weekly schedule, blocked slots, overlap constraint, and audit history approved 2026-10-25.
- [x] Human owner approval recorded on 2026-10-25.
