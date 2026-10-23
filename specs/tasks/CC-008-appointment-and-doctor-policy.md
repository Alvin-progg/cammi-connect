# CC-008 — Appointment and Doctor-Scope Policy

- Status: Proposed
- Phase: PHASE-00
- Type: Product / security policy decision
- Approval required: yes
- ADR: [`ADR-0007`](../decisions/ADR-0007-appointment-and-doctor-policy.md)
- Depends on: none
- Blocks: CC-501, CC-502, CC-503, CC-504, CC-505

## Objective

Approve the appointment state model, cancellation/reschedule rules, doctor authorization
scope, and minimum patient fields returned to doctors.

## Requirement and specification references

- `FR-004`, `FR-005`, `UI-003`, `UI-004`
- `SPEC.md` §6.1, §7.1, §15 item 9
- `TEST.md` `U-APT-01..07`, `I-APT-01..04`, `E-APT-01..04`, `E-DOC-01`

## Decision required

- Appointment statuses and allowed transitions.
- Who may set each status.
- Whether patients may request, confirm, cancel, or reschedule.
- Cancellation window and reschedule limits.
- Slot duration, schedule model, and timezone boundaries.
- Doctor scope: own appointments, department, or another approved scope.
- Minimum patient fields returned by doctor APIs.
- Audit requirements for status changes and administrative overrides.
- Behavior for past, overlapping, and unavailable slots.

## Acceptance criteria

- `ADR-0007` is approved with an explicit transition matrix.
- Cancellation and reschedule rules are testable.
- Doctor scope and patient-field minimization are explicit.
- Timezone handling is explicit; display timezone is Asia/Manila unless changed.
- Structured “slot unavailable” behavior is defined.
- `U-APT-03`, `U-APT-04`, `U-APT-05`, and `U-APT-07` can be written without guessing.
- No policy is implemented before approval.

## Evidence

- Approved `ADR-0007`.
- Human approval record.

## Out of scope

- Implementing appointments.
- Creating schemas or status enums.
- Changing `SPEC.md` or `TEST.md`.
