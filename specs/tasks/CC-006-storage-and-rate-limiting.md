# CC-006 — Object Storage and Rate Limiting

- Status: Proposed
- Phase: PHASE-00
- Type: Architecture / security decision
- Approval required: yes
- ADR: [`ADR-0005`](../decisions/ADR-0005-storage-and-rate-limiting.md)
- Depends on: CC-003
- Blocks: CC-302, CC-404

## Objective

Approve the object storage and shared rate-limit services, including security constraints
for signed uploads and multi-instance rate limiting.

## Requirement and specification references

- `SPEC.md` §4.2, §7.2, §15 items 5 and 6
- `TEST.md` `S-13`, `I-RL-01`, `A-CHAT-03`, `UC-ADM-02`, `UC-ADM-03`

## Decision required

### Storage

- Provider and bucket/container model.
- Signed-upload issuance and expiry.
- Content-type and size enforcement.
- Object-key scoping and overwrite prevention.
- How server-side extraction accesses the object.
- Deletion/deactivation behavior.

### Rate limiting

- Shared store: Postgres-backed, Redis-compatible, or platform service.
- Keying strategy: identity, IP, route, or approved combination.
- Limits for chat and other expensive endpoints.
- Behavior across simulated separate instances.
- Failure mode when the store is unavailable.

## Acceptance criteria

- `ADR-0005` is approved for both storage and rate limiting.
- Signed uploads are short-lived and scoped to one key.
- Uploads cannot overwrite another object or bypass content-type/size checks.
- Rate limiting is not in-memory.
- `I-RL-01` and `S-13` have a concrete test strategy.
- Credentials remain server-only.
- No service is provisioned before approval.

## Evidence

- Approved `ADR-0005`.
- Linked provider documentation with checked date.
- Human approval record.

## Out of scope

- Creating buckets, stores, or credentials.
- Implementing signed uploads or rate limits.
