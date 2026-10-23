# ADR-0006 — External Provider Contracts

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-007`
- Related requirements: `FR-001`, `FR-002`
- Related specification: `SPEC.md` §4.1, §4.4, §4.7, §15 item 7

## Context

Provider identifiers, endpoints, authentication, request formats, dimensions, and limits
must be verified before adapter code is written. Training-data assumptions are not
acceptable evidence.

## Decision drivers

- Verified Gemini embedding configuration.
- Verified OpenCode Zen generation configuration.
- Timeout and retry budgets within hosting limits.
- Server-only credentials.
- Controlled provider errors.
- Reproducible smoke tests.
- Cost and quota awareness.

## Verification record

### Gemini embeddings

| Item | Verified value | Source | Checked |
|---|---|---|---|
| SDK/version | TBD | TBD | TBD |
| Model ID | TBD | TBD | TBD |
| Output dimensionality | TBD | TBD | TBD |
| Document task type | TBD | TBD | TBD |
| Query task type | TBD | TBD | TBD |
| Batch/rate limits | TBD | TBD | TBD |

### OpenCode Zen

| Item | Verified value | Source | Checked |
|---|---|---|---|
| Model ID | TBD | TBD | TBD |
| Base URL | TBD | TBD | TBD |
| Endpoint | TBD | TBD | TBD |
| Auth scheme | TBD | TBD | TBD |
| Request format | TBD | TBD | TBD |
| Response format | TBD | TBD | TBD |
| Timeout/retry limits | TBD | TBD | TBD |
| Plan/quota constraints | TBD | TBD | TBD |

## Decision

TBD. Do not implement adapters until this record is verified and approved.

## Consequences

- `CC-306`, `CC-401`, and provider smoke tests are blocked.
- Embedding dimensionality and vector schema cannot be finalized.
- Timeout and retry budgets cannot be validated.

## Approval

- [ ] Gemini contract verified.
- [ ] OpenCode Zen contract verified.
- [ ] Sources and checked dates recorded.
- [ ] No secrets captured in the record.
- [ ] Human owner approval recorded.
