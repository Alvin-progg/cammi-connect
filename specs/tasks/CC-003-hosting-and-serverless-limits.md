# CC-003 — Hosting and Serverless Limits

- Status: Proposed
- Phase: PHASE-00
- Type: Architecture decision
- Approval required: yes
- ADR: [`ADR-0002`](../decisions/ADR-0002-hosting-and-serverless-limits.md)
- Depends on: CC-001
- Blocks: CC-110, PHASE-04, PHASE-08

## Objective

Approve the hosting platform and record the serverless constraints that shape timeouts,
body limits, ingestion steps, and deployment environments.

## Requirement and specification references

- `SPEC.md` §2.4, §9.2, §10, §15 item 1
- `TEST.md` `D-03`, `D-05`, `P-01`, `P-02`, `P-03`, `SM-04`
- No requirement is implemented here.

## Decision required

- Hosting platform.
- Function execution time limit.
- Request body size limit.
- Memory limit.
- Concurrency and cold-start behavior.
- Logging and request-ID support.
- Supported background mechanism, if any.
- Local, test/CI, preview, and demo environments.
- Cost/free-tier limits relevant to the capstone.

## Options to evaluate

- Vercel.
- Another Node.js serverless platform.
- A container platform, only if the approved architecture is explicitly changed.

No option is selected by this ticket.

## Acceptance criteria

- `ADR-0002` is approved with limits and environment plan.
- Provider limits are linked to current documentation with a checked date.
- Timeout budgets for embeddings, generation, and ingestion can be derived.
- The Phase 1 deployment spike is either approved or explicitly deferred.
- No deployment or secret is created by this ticket.

## Evidence

- Approved `ADR-0002`.
- Current platform-limit documentation.
- Human approval record.

## Out of scope

- Deploying the app.
- Creating hosting projects or environment variables.
- Changing the serverless architecture.
