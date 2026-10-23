# ADR-0007 — Appointment and Doctor-Scope Policy

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-008`
- Related requirements: `FR-004`, `FR-005`, `UI-003`, `UI-004`
- Related specification: `SPEC.md` §6.1, §7.1, §15 item 9

## Context

Availability, booking, cancellation, rescheduling, status transitions, and doctor scope
must be authoritative database rules. Tests cannot be written without an explicit policy.

## Decision drivers

- Concurrency-safe booking.
- No double-booking.
- Explicit legal status transitions.
- Patient ownership enforcement.
- Doctor data minimization.
- Timezone correctness.
- Auditability.

## Decision required

### Status model

- Statuses and allowed transitions.
- Who may set each status.
- Whether cancellation is terminal.
- Whether no-show or completion statuses are required.

### Scheduling policy

- Slot duration and schedule model.
- Past/overlap rejection.
- Cancellation window.
- Reschedule limits.
- Timezone and period boundaries.

### Doctor scope

- Own appointments only or another approved scope.
- Minimum patient fields returned.
- Permitted status updates.

No policy is selected.

## Decision

TBD. Do not implement appointment rules until approved.

## Consequences

- `CC-501` through `CC-505` cannot start.
- `U-APT-03`, `U-APT-04`, `U-APT-05`, and `U-APT-07` cannot be written precisely.
- E2E booking flows cannot be specified.

## Approval

- [ ] Transition matrix approved.
- [ ] Scheduling policy approved.
- [ ] Doctor scope and patient fields approved.
- [ ] Timezone and audit rules approved.
- [ ] Human owner approval recorded.
