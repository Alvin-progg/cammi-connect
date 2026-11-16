# ADR-0005 — Object Storage and Rate Limiting

- Status: Partially accepted (storage for payment receipts, 2026-11-16); rate-limit store still proposed
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

## Amendment (2026-11-16, PAY-001 decision D1)

Approved by the project owner while planning chat payments
([`PAY-001`](../tasks/PAY-001-chat-payments-discounts-services.md)).

- **Provider.** Supabase Storage, in the existing hosted Supabase project.
- **Bucket.** One private bucket, `payment-receipts`. No public URLs.
- **Object path.** `{patient_id}/{payment_id}/{random}.{ext}`. Objects are never
  overwritten; each upload gets a new random name.
- **Uploads.** Server-side only, through `POST /api/v1/payments/[id]/receipt`, using the
  service-role client after the session, ownership, attempt-limit, size (≤ 5 MB), and
  file-signature (JPEG/PNG/WebP) checks. The browser never receives a storage key or a
  signed upload URL.
- **Viewing.** Front desk and admin only, through signed URLs that expire after 60
  seconds; every view is audited (`payment.receipt_viewed`). Doctors have no access.
- **Retention.** Receipt images are deleted 90 days after the payment is closed
  (PAY-001 D5); the payment record and history stay.
- **Upload rate limit.** 5 receipt uploads per 10 minutes per patient, counted in
  Postgres from `payment_receipts`. This is not the general rate-limit store, which stays
  undecided.
- **Knowledge-base uploads** keep their current Server Action path (ADM-13) and are not
  moved to Storage by this amendment.

## Consequences

- `CC-302` and `CC-404` cannot start.
- `S-13` and `I-RL-01` cannot be verified.
- No bucket, store, or credential may be created.

## Approval

- [x] Storage provider selected (Supabase Storage, receipts only, 2026-11-16).
- [x] Upload policy approved: server-side uploads, no signed upload URLs (2026-11-16).
- [ ] Rate-limit store selected.
- [ ] Failure mode approved.
- [ ] Test strategy approved.
- [ ] Human owner approval recorded.
