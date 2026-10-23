# ADR-0002 — Hosting and Serverless Limits

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-003`
- Related requirements: `FR-001`, `FR-004`, `FR-007`
- Related specification: `SPEC.md` §2.4, §9.2, §10, §15 item 1

## Context

The design depends on serverless execution limits, request body limits, connection
pooling, and the availability of background execution. These limits determine LLM
timeout and retry budgets, ingestion step size, upload flow, and deployment checks.

## Decision drivers

- Next.js 16 support.
- Serverless execution time sufficient for LLM and ingestion steps.
- Request body size compatible with signed uploads.
- Pooled database connectivity.
- Preview environments.
- Structured logs and request IDs.
- Cost and free-tier limits for a capstone.
- No reliance on a personal laptop or Cloudflare Tunnel.

## Options considered

### Vercel

- Native Next.js hosting.
- Limits and background options must be verified.

### Another Node.js serverless platform

- Requires verification of Next.js compatibility, limits, and deployment model.

### Container platform

- Not serverless by default.
- Requires an approved architecture change.

No option is selected.

## Decision

TBD. Record the chosen platform and exact limits before Phase 1 deployment work.

## Required limit record

- Maximum function duration.
- Maximum request body size.
- Memory.
- Concurrency and cold-start behavior.
- Logging and request IDs.
- Background/cron/queue support.
- Free-tier and quota limits.
- Preview/demo environment support.

## Consequences

- `CC-110` and Phase 8 deployment checks cannot be finalized.
- `P-02` retry budgets cannot be validated.
- Ingestion step budgets cannot be finalized.
- Phase 1 local work may proceed, but the deployment spike remains blocked.

## Approval

- [ ] Platform selected.
- [ ] Limits recorded with source and checked date.
- [ ] Environment plan approved.
- [ ] Human owner approval recorded.
