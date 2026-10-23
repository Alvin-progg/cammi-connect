# ADR-0004 — Ingestion Job Execution

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-005`
- Related requirements: `FR-002`
- Related specification: `SPEC.md` §4.2, §9.1, §15 item 4

## Context

Ingestion cannot run as one long serverless invocation. Jobs must advance in bounded,
idempotent steps, survive cut-off invocations, avoid duplicate chunks, and publish
atomically. The trigger mechanism is unresolved.

## Decision drivers

- Serverless time limits.
- Idempotency and resumability.
- No duplicate active chunks.
- Atomic publication.
- Safe retry after provider failure.
- Authenticated trigger.
- Observable progress and errors.
- Testability of cut-off and overlapping invocations.

## Options considered

### Managed queue

- Durable work dispatch.
- Requires provider selection and configuration.

### Scheduled cron

- Simple periodic advancement.
- May add latency and requires idempotency.

### Platform background task

- Depends on hosting limits and API.
- Requires verification.

### Authenticated admin-driven stepping

- No extra infrastructure.
- Requires repeated human action and careful authorization.

No option is selected.

## Decision

TBD. Record trigger, lease model, checkpoint fields, step budget, and retry policy.

## Consequences

- `CC-307` and `CC-308` cannot start.
- `I-RAG-08` and `I-RAG-09` cannot be written.
- Phase 3 remains blocked.
- No queue, cron job, or worker may be created.

## Approval

- [ ] Trigger selected.
- [ ] Lease/idempotency model approved.
- [ ] Step budget and retry policy approved.
- [ ] Test strategy approved.
- [ ] Human owner approval recorded.
