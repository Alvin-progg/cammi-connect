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

## Interim decision (2026-10-30, AI-APT-001)

Approved by the human owner through `PLN-002`:

- The synthetic corpus (ADR-0009) is ingested by a manual local CLI,
  `npm run kb:ingest`, run by a developer with `.env.local`. It is not a serverless
  function, so the time limits above do not apply.
- It skips documents whose content hash is unchanged and replaces a changed document's
  chunks atomically through a `service_role`-only database function, so readers never
  see a partial document.
- Admin knowledge-base upload (FR-002), `ingestion_jobs`, leases, and any queue, cron,
  or background worker remain undecided and out of scope.

## Interim decision (2026-11-08, ADM-14)

Approved by the human owner for admin-authored knowledge documents:

- Trigger: the admin Server Action (publish, edit of a published document's content,
  Reprocess) chunks and embeds the document inline and awaits the result. No queue,
  cron job, worker, `ingestion_jobs` table, or lease is added.
- Idempotency: every write is guarded by document status and version. Chunks are stored
  by `cammi_connect_store_knowledge_chunks` (0026) only while the document is still
  published at the embedded version; otherwise it raises `stale` and changes nothing.
- Atomic swap: the old chunks are deleted and the new ones inserted in one transaction,
  after embedding succeeds, so readers never see a gap and a failure keeps the old chunks.
- Retry policy: Gemini calls retry 429, 5xx, and timeouts with bounded backoff
  (`fetchJson`). A failed run sets `processing_status = 'failed'` with a fixed message,
  and the admin retries with Reprocess.
- Step budget: documents are at most 200,000 characters (about 120 chunks, 3 embedding
  batches of 50), which fits one invocation at capstone scale. If it stops fitting, move
  ingestion to a job model under the decision below.

## Decision

TBD for job-based ingestion. Record trigger, lease model, checkpoint fields, step
budget, and retry policy before FR-002 work starts.

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
