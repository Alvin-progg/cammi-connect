# ADR-0005 — Object Storage and Rate Limiting

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-006`
- Related requirements: `FR-002`, `FR-001`
- Related specification: `SPEC.md` §4.2, §7.2, §15 items 5 and 6

## Context

Knowledge-base uploads must use short-lived signed uploads scoped to one object, with
content-type and size restrictions. Chat and other expensive endpoints need a shared
rate-limit store that works across serverless instances.

## Decision drivers

- Serverless request body limits.
- Short-lived, least-privilege uploads.
- No overwrite of other objects.
- Server-only credentials.
- Shared rate-limit state across instances.
- Graceful behavior when the store is unavailable.
- Testability.

## Options considered

### Storage

- Supabase Storage.
- S3-compatible object storage.
- Another reviewed provider.

### Rate limit store

- Postgres-backed counter.
- Redis-compatible service.
- Platform rate-limit service.

No option is selected.

## Decision

TBD. Record storage provider, bucket policy, signed-URL constraints, and rate-limit store.

## Consequences

- `CC-302` and `CC-404` cannot start.
- `S-13` and `I-RL-01` cannot be verified.
- No bucket, store, or credential may be created.

## Approval

- [ ] Storage provider selected.
- [ ] Signed-upload policy approved.
- [ ] Rate-limit store selected.
- [ ] Failure mode approved.
- [ ] Test strategy approved.
- [ ] Human owner approval recorded.
