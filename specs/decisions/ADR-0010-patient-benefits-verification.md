# ADR-0010 — Patient PWD and HMO Verification

- Status: **Accepted** 2026-11-22 (project owner approved the plan and "do the whole spec")
- Date: 2026-11-22
- Decision owner: Human project owner
- Related ticket: `BEN-001`
- Related requirements: `FR-040`–`FR-052` (SPEC.md §17)

## Context

Chat booking prices a visit from a Senior/PWD/None answer and a typed HMO
provider and member number (PAY-003, PAY-06). Nothing verifies PWD status or
HMO membership, and HMO acceptance is not configured per doctor. The spec
requires verified records, per-doctor accreditation, and appointment-level
authorization kept separate from confirmation.

## Decision

1. **Profile-level records.** `patient_pwd`, `patient_hmo`, `doctor_hmo_accreditations`,
   and `appointment_hmo` (`0041`). `hmo_providers` (`0033`) is reused as the provider list.
2. **Verification gates pricing.** Chat offers the PWD privilege only when
   `patient_pwd` is `verified`. Senior stays a self-declared choice (unchanged).
   The booking RPC refuses `privilege = 'pwd'` for an unverified patient
   (`pwd_not_verified`).
3. **Saved membership replaces typed HMO entry.** Chat offers HMO only for a
   verified `patient_hmo` whose provider the chosen doctor accepts (active,
   in date). The RPC re-checks this (`0042`) and writes `appointment_hmo`.
   Service visits (no doctor) check verification only.
4. **Registration uploads.** Optional PWD/HMO details and images are accepted
   in the register flow after `signUp` succeeds. A failure never blocks
   account creation; the patient retries on `/account/benefits`.
5. **Separate processes.** Coverage and authorization live in `appointment_hmo`
   and are never inferred from accreditation. Confirmation still goes through
   the `0036` payment gate; the HMO decision in `0037` mirrors into
   `appointment_hmo` so the two records stay aligned.
6. **Re-verification.** Any change to a PWD ID or HMO membership returns that
   record to `pending`.
7. **No new benefit math.** PWD and HMO are combined only by the existing
   `computeCharge` order (VAT exemption → 20% → PhilHealth → HMO). Spec §11
   rule 9 is met by the hospital-approved rules already in code.
8. **Access.** Tables are service_role only (ADR-0003). Documents go in the
   private `benefit-documents` bucket and are viewed through an audited,
   short-lived signed URL. Membership and ID numbers never appear in audit
   payloads, the LLM history, or public API responses.

## Consequences

- Breaking change for chat HMO: the typed provider/member-number step is
  removed. Existing `payments.hmo_*` rows and `appointment_charges` keep their
  data; the backfill in `0042` creates `appointment_hmo` rows for existing HMO charges.
- Re-verification can temporarily remove a verified PWD benefit from chat.
- Registration now writes to storage before the patient is signed in. The
  risk is bounded by Supabase auth rate limits and by the same file checks
  used for receipts (magic bytes, 5 MB, one image per kind).
