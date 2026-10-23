# CC-005 — Ingestion Job Execution

- Status: Proposed
- Phase: PHASE-00
- Type: Architecture decision
- Approval required: yes
- ADR: [`ADR-0004`](../decisions/ADR-0004-ingestion-job-execution.md)
- Depends on: CC-004
- Blocks: CC-301, CC-307, CC-308

## Objective

Approve how ingestion jobs are advanced and resumed within serverless limits without
duplicate work or partial publication.

## Requirement and specification references

- `SPEC.md` §4.2, §9.1, §15 item 4
- `TEST.md` `U-RAG-20`, `I-RAG-03`, `I-RAG-04`, `I-RAG-05`, `I-RAG-06`, `I-RAG-07`,
  `I-RAG-08`, `I-RAG-09`, `P-03`, `SM-06`

## Decision required

- Trigger: queue, cron, platform background task, repeated admin-triggered calls, or
  an approved combination.
- Authentication/authorization of the trigger.
- Job lease/locking and stale-lease recovery.
- Progress checkpoint fields.
- Bounded step size and time budget.
- Idempotency rules per step.
- Retry and failure behavior.
- How an invocation cut-off is simulated in tests.

## Options to evaluate

- Managed queue.
- Scheduled cron invocation.
- Platform background task.
- Authenticated admin-driven stepping.

No option is selected by this ticket.

## Acceptance criteria

- `ADR-0004` is approved with the trigger and lease model.
- Each step is idempotent and resumable.
- A cut-off invocation cannot duplicate active chunks.
- Publication remains atomic after all required writes commit.
- `I-RAG-08` and `I-RAG-09` have a concrete test strategy.
- No background mechanism is installed or configured before approval.

## Evidence

- Approved `ADR-0004`.
- Linked platform documentation with checked date.
- Human approval record.

## Out of scope

- Implementing the job engine.
- Creating queues, cron jobs, or storage.
- Running ingestion.
