# Administrator module: acceptance traceability

Maps each "Tests first" item in `pr-admin.md` (ADM-00 to ADM-16), ADM-17 from `specs/tasks/ADM-17-analytics-interpretation.md`, and the acceptance criteria of `specs/tasks/AI-APT-002-need-based-specialty-routing.md`, to the place it is verified. The full specification's §20 checklist is not in the repository, so this table follows the slices instead.

Status values:

- **test**: an automated Vitest test, run by `npm test`.
- **static**: an automated test that reads source or migration files instead of running against a database.
- **manual**: the smoke steps in `db/README.md`, run against the hosted Supabase project.
- **gap**: not verified yet. RLS and integration items need a database, and there is no local one (ADR-0003). E2E items need Playwright, which is not installed.

Authorization model note: under ADR-0003, every table has RLS on with no policies, and `anon`/`authenticated` have no table access. "RLS: role X can/can't …" items therefore become "only the service-role server can read or write, after a session guard." That is covered by the static route and action checks in ADM-16, and not by per-role policies.

## ADM-00 Foundation

| Item | Status | Where |
|---|---|---|
| Session guard: no session, wrong role, inactive, admin passes | test | `tests/unit/auth/admin-session.test.ts` |
| Audit redaction strips sensitive keys, nested too | test | `tests/unit/audit/redact.test.ts`, `tests/unit/audit/service.test.ts` |
| Non-admin cannot change their own role | manual / gap | trigger in `0014`; `db/README.md` (0014) |
| Non-admin cannot read `audit_logs`; nobody can update or delete it | manual / gap | `0013` grants; no direct table access under ADR-0003 |
| Patient visiting `/admin` is denied; admin sees the shell | test | `tests/unit/security/admin-routes.test.ts`, `tests/component/admin/admin-shell.test.tsx` |

## ADM-01 Users and roles

| Item | Status | Where |
|---|---|---|
| Guard rails (self-demote, last admin) | test | `tests/unit/users/guards.test.ts` |
| Role change by non-admin denied; by admin changes the role and writes an audit row | test + manual | `tests/unit/users/actions.test.ts`, `service.test.ts`; `0014` |
| Deactivated user is denied | test | `tests/unit/auth/admin-session.test.ts` and the other `*-session` tests |
| Responses never include password, hash, or token fields | test | `tests/unit/users/repository-mapping.test.ts` |
| Invite a front desk user, who then appears in the list | manual / gap (E2E) | `db/README.md` (ADM-01) |

## ADM-02 Departments, ADM-03 Specialties, ADM-07 Services

| Item | Status | Where |
|---|---|---|
| Form schemas (required, length, trim) | test | `tests/unit/{departments,specialties,services}/schemas.test.ts` |
| Case-insensitive duplicate rejected | test + manual | the `service.test.ts` refusal mapping; unique indexes in `0015`/`0016`/`0021` |
| Deactivation refused while future appointments exist | test + manual | `tests/unit/departments/service.test.ts`; `0015` |
| Patients see active records only; non-admin writes denied | static + manual | `tests/unit/security/server-actions.test.ts`; `0015`/`0016`/`0021` |
| Create, edit, deactivate | manual / gap (E2E) | `db/README.md` |

## ADM-04 Doctors

| Item | Status | Where |
|---|---|---|
| Schema (at least 1 specialty, valid department) | test | `tests/unit/doctors/schemas.test.ts` |
| Specialty replacement is atomic; linking a non-doctor account is rejected | manual / gap | `0017` functions |
| Contact fields are admin-only; doctor A cannot update doctor B | static + test | session-scoped IDs in `tests/unit/schedules/actions.test.ts` and `tests/unit/doctors/actions.test.ts` |
| Registered doctor is bookable; deactivated doctor is not | test + gap (E2E) | `tests/unit/availability/service.test.ts`, `tests/unit/chat/tools.test.ts` |

## ADM-05 Weekly schedules, ADM-06 Exceptions

| Item | Status | Where |
|---|---|---|
| Slot generation and boundaries | test | `tests/unit/schedules/slots.test.ts` |
| Overlap detection matrix | test | `tests/unit/schedules/periods.test.ts`, `availability.test.ts` |
| Availability is weekly hours minus exceptions; holidays apply to all doctors | test | `tests/unit/schedules/availability.test.ts`, `tests/unit/availability/service.test.ts` |
| An edit or exception that would orphan an appointment is refused | test + manual | `tests/unit/schedules/service.test.ts`; `0018`/`0020` |
| DB constraint rejects overlap; concurrent inserts allow exactly one | manual / gap | `appointments_no_active_overlap` |
| Patient sees the configured slots | gap (E2E) | |

## ADM-08 Requirements

| Item | Status | Where |
|---|---|---|
| "Currently effective" predicate | test | `tests/unit/requirements/effective.test.ts` |
| Supersede keeps the old row with an end date | test + manual | `tests/unit/requirements/service.test.ts`; `0022`/`0024` |
| Drafts are not visible to patients | n/a | requirements are admin-only for now (D7) |

## ADM-09 Monitoring

| Item | Status | Where |
|---|---|---|
| Every status change writes an `appointment_audit_logs` row | static | `tests/unit/appointments/audit-coverage.test.ts` |
| Filter combinations | test | `tests/unit/appointments/monitoring.test.ts`, `tests/unit/appointments-monitoring/service.test.ts` |
| Non-admin is denied | static | `tests/unit/security/admin-routes.test.ts` |
| Filter, then open a detail page with the timeline | gap (E2E) | |

## ADM-10 to ADM-12 Analytics and dashboard

| Item | Status | Where |
|---|---|---|
| KPI values, null denominators, Manila month boundary, pending/rejected excluded, filters | test | `tests/unit/analytics/metrics.test.ts`, `service.test.ts` |
| Filter and URL serialization; previous period | test | `tests/unit/analytics/filters.test.ts`, `period.test.ts`, `tests/unit/admin/dashboard.test.ts` |
| CSV serializer and export route (403 for non-admins, audited) | test | `tests/unit/analytics/csv.test.ts`, `export-route.test.ts` |
| No patient identifiers | static | `tests/unit/security/analytics-privacy.test.ts` |
| Dashboard numbers | test | `tests/unit/analytics/dashboard-service.test.ts` |
| Charts update and the CSV downloads | gap (E2E) | |

## ADM-17 Analytics interpretation

| Item | Status | Where |
|---|---|---|
| Each chart: every threshold band, boundaries, below-minimum → null | test | `tests/unit/analytics/interpretation.test.ts` |
| ≤ 12 words per line, ≤ 15 per summary point, no cause words, deterministic | test | `tests/unit/analytics/interpretation.test.ts` |
| Summary: alerts first, max 3, steady line, not-enough line | test | `tests/unit/analytics/interpretation.test.ts` |
| Summary card badges with text labels and chart links; "What it means" line | test | `tests/component/analytics/analytics-summary.test.tsx` |
| Analytics page and dashboard interpret the filtered data | test | `tests/component/analytics/page.test.tsx`, `tests/component/admin-dashboard/page.test.tsx`, `tests/unit/analytics/dashboard-service.test.ts` |
| No LLM or external call | static (by construction) | `src/lib/analytics/interpretation.ts` is pure and imports only the metric layer |

## ADM-13, ADM-14 Knowledge base

| Item | Status | Where |
|---|---|---|
| Status transitions | test | `tests/unit/knowledge/transitions.test.ts` |
| Content normalization and hash | test | `tests/unit/knowledge/content.test.ts` |
| Upload rejects the wrong MIME type or an oversized file | test | `tests/unit/knowledge/schemas.test.ts`, `extract-text.test.ts` |
| Chunker | test | `tests/unit/chat/rag/chunking.test.ts` |
| Gemini retries and clean failure | test | `tests/unit/ai/gemini-embeddings.test.ts`, `http.test.ts` |
| Ingestion: swap, stale, failure keeps the old chunks, drafts skipped | test (fakes) + manual | `tests/unit/knowledge/ingest.test.ts`; `0026` |
| Archived documents are never retrieved | manual / gap | `0026` deletes chunks; the match function filters on published |
| Provider keys are not in the client bundle | static | `npm run check:bundle` (after `npm run build`) |

## ADM-15 Settings

| Item | Status | Where |
|---|---|---|
| Each schema: bounds, unknown key rejected | test | `tests/unit/settings/schema.test.ts` |
| Non-admin denied; admin save writes an audit row with the diff | test + manual | `tests/unit/settings/actions.test.ts`, `service.test.ts`; `0027` |
| `enabled_categories` limits retrieval | test + manual | `tests/unit/knowledge/service.test.ts`; `0027` |
| Welcome message shows in the patient chat | test + manual | `tests/component/chat/chat-shell.test.tsx`; `db/README.md` (0027) |

## ADM-16 Audit log and hardening

| Item | Status | Where |
|---|---|---|
| Viewer: filters, Manila time, linked targets, read-only | test | `tests/unit/audit/log.test.ts`, `tests/component/audit-log/audit-log.test.tsx` |
| Detail diff of previous and new values | test | `tests/unit/audit/log.test.ts`, `tests/component/audit-log/audit-log.test.tsx` |
| CSV export: admin only, audited as `audit.export`, row cap | test | `tests/unit/audit/export-route.test.ts`, `reader-service.test.ts` |
| Required audit events (§16) are written | static | `tests/unit/audit/required-events.test.ts` |
| Every admin page and API route checks the admin session | static | `tests/unit/security/admin-routes.test.ts` |
| Every Server Action checks a session | static | `tests/unit/security/server-actions.test.ts` |
| No credential keys in audit payloads | test + static | `tests/unit/audit/redact.test.ts`, `tests/unit/security/audit-payloads.test.ts` |
| Bundle contains no server secrets | static | `npm run check:bundle` |
| RLS matrix (role × table × operation) | gap | needs a database; see the ADR-0003 note above |
| PostgREST privilege escalation as each role | gap | needs a database; the anon/authenticated revokes are in every migration |
| E2E critical paths 1–5 | gap | Playwright not installed |

## AI-APT-002 Need-based specialty routing

| Item | Status | Where |
|---|---|---|
| A described concern gets doctor cards without choosing a specialty | test | `tests/unit/chat/orchestrator-routing.test.ts` |
| Only active specialties with active doctors are suggested; invented names dropped | test | `tests/unit/chat/routing.test.ts`, `tests/unit/chat/tools.test.ts` |
| Under 18 goes to Pediatrics unless another specialty is named | test | `tests/unit/chat/routing.test.ts`, `orchestrator-routing.test.ts` |
| Unclear or low-confidence concerns go to the first-contact specialty (settings, R3 fallback) | test | `tests/unit/chat/routing.test.ts`, `tests/unit/settings/schema.test.ts` |
| At most one age question (R5) | test | `tests/unit/chat/orchestrator-routing.test.ts` |
| Urgent keyword or model flag wins: emergency notice, no doctor cards | test | `tests/unit/chat/orchestrator-routing.test.ts`, `orchestrator.test.ts` |
| Routed replies are templates with no model text, no banned phrases, and [Change specialty] | test | `tests/unit/chat/safety.test.ts`, `orchestrator-routing.test.ts`, `tests/component/chat/booking-cards.test.tsx` |
| Concern is the reason for visit and can be edited before Confirm | test | `tests/unit/chat/orchestrator-routing.test.ts`, `tests/component/chat/booking-cards.test.tsx` |
| Medical-advice decline offers [Yes, book], which routes without another model call | test | `tests/unit/chat/orchestrator-routing.test.ts` |
| Admins edit routing hints; saves are audited with the hints | test + static + manual | `tests/unit/specialties/*.test.ts`, `tests/component/specialties/specialties.test.tsx`, `tests/unit/specialties/routing-hints-sql.test.ts`; `0032` smoke-tested on the local Supabase (`scripts/db-local-apply.sh`) |
| Concern is never logged | static (by construction) | the chat log entry type carries IDs and outcomes only (`src/server/chat/handler.ts`); no new log calls |
| Routing eval reaches ≥ 90% correct or safe with zero urgent misroutes | test (scoring) + gap (run) | scoring in `tests/unit/chat/routing-eval.test.ts`; `npm run eval:routing` needs real keys and has not been run |

## PAY-01 Price catalogue

| Item | Status | Where |
|---|---|---|
| Admin sets the specialty default fee and a doctor fee override (pesos in, integer centavos stored) | test | `tests/unit/specialties/*.test.ts`, `tests/unit/doctors/*.test.ts`, `tests/component/specialties/specialties.test.tsx`, `tests/component/doctors/doctors.test.tsx` |
| Admin sets service category, price (blank = on request), VAT-able, PhilHealth benefit, HMO-coverable, doctor's request, daily capacity; `scheduled` booking mode | test | `tests/unit/services/*.test.ts`, `tests/component/services/services.test.tsx` |
| Peso parsing and formatting use integer math only | test | `tests/unit/billing/money.test.ts` |
| HMO providers: list, create, edit, activate/deactivate; admin only | test | `tests/unit/hmo-providers/*.test.ts`, `tests/component/hmo-providers/hmo-providers.test.tsx`, `tests/component/admin/admin-shell.test.tsx` |
| Payment settings stored with bounds; the 20% privilege discount is read-only | test + static | `tests/unit/settings/schema.test.ts`, `tests/component/settings/settings-form.test.tsx`, `tests/unit/billing/price-catalogue-sql.test.ts` |
| Every price save is audited; negative amounts refused (`invalid_price`); non-admin refused; RLS on, anon/authenticated revoked, functions for service_role only | static + manual | `tests/unit/billing/price-catalogue-sql.test.ts`; `0033` smoke-tested on the local Supabase (`scripts/db-local-apply.sh`) |
| HMO writes clear the reference cache | static | `tests/unit/security/reference-cache.test.ts` |
| Seed loads the synthetic prices and sample HMOs (PhilHealth ₱0) | manual | `scripts/seed.mjs`, run against the local Supabase only |
| No patient-facing change | by construction | no patient or chat module reads the new columns or settings |

## PAY-02 Billing math

| Item | Status | Where |
|---|---|---|
| Breakdown order VAT exemption → 20% senior/PWD → PhilHealth → HMO, matching every worked example in the spec and the pricing doc (PWD CBC + urinalysis + FBS as three line items) | test (math only; chat in PAY-03) | `tests/unit/billing/compute.test.ts` |
| Senior and PWD can't both be applied: one `privilege` choice of `none`/`senior`/`pwd` | test (type and schema; chat in PAY-03) | `tests/unit/billing/compute.test.ts` |
| Integer centavos only, half-up rounding, no float leaks, line items always sum to base | test | `tests/unit/billing/compute.test.ts` |
| PhilHealth clamped to what is left; HMO skips non-coverable items; co-pay once per booking, never negative | test | `tests/unit/billing/compute.test.ts` |
| Peso formatting (`₱560.00`, thousands separators) | test | `tests/unit/billing/money.test.ts` |
| No UI | by construction | nothing imports `src/lib/billing/compute.ts` yet |

## PAY-03 Discount, payer, and price in chat booking

| Item | Status | Where |
|---|---|---|
| With `payment.enabled`, the slot is followed by the discount question (Senior 60+ / PWD / None, one only) and the payer question (I'll pay / Pay at the hospital / My HMO with active HMOs and a member number) | test | `tests/unit/chat/booking-payment.test.ts`, `tests/component/chat/payment-cards.test.tsx` |
| PhilHealth offered only when the item's benefit is above ₱0 (never for a consultation); a PhilHealth answer for a consult is refused in TS and SQL | test + local SQL smoke | `tests/unit/chat/booking-payment.test.ts`, `tests/component/chat/payment-cards.test.tsx`, db/README.md (0034) |
| Consultation fee from the database: doctor fee overrides the specialty default; null is "price on request" and not bookable in chat | test + local SQL smoke | `tests/unit/chat/booking-payment.test.ts`, `tests/unit/billing/chat-booking-charges-sql.test.ts` |
| Summary card shows price, VAT exemption, 20%, PhilHealth, HMO, and amount to pay from `computeCharge`; HMO member number masked | test | `tests/unit/chat/booking-payment.test.ts`, `tests/component/chat/payment-cards.test.tsx` |
| Confirm creates appointment, charge, line item, payment, and `created` event in one transaction, or nothing | local SQL smoke | db/README.md (0034); `tests/unit/billing/chat-booking-charges-sql.test.ts` (static) |
| SQL recomputes the charge from its own prices and refuses `price_changed` when it differs from the summary | test (static) + local SQL smoke | `tests/unit/billing/chat-booking-charges-sql.test.ts` |
| Status on create: `awaiting_payment` (self, > ₱0), `hmo_pending` (HMO), `not_required` (₱0 without HMO) | local SQL smoke | db/README.md (0034) |
| Deadline = now + `payment.deadline_minutes`, clamped to 2 h before the visit; visits within 2 h refused `payment_too_soon` → "pick a later time" | test + local SQL smoke | `tests/unit/payments/service.test.ts`, `tests/unit/chat/booking-payment.test.ts` |
| Reference code `CC-XXXXX` unique; transaction reference unique ignoring case/spaces; `payment_events` append-only; ADR-0003 lockdown | test (static) + local SQL smoke | `tests/unit/billing/chat-booking-charges-sql.test.ts` |
| Double Confirm books once (claim guard + exclusion constraint) | test + local SQL smoke | `tests/unit/chat/booking-payment.test.ts` |
| Templated payment request with amount, reference code, and deadline; HMO pending message | test | `tests/unit/chat/payment.test.ts`, `tests/unit/chat/booking-payment.test.ts` |
| The LLM never sees amounts or reference codes (messages with payment details are masked in history); no model call in payment steps | test | `tests/unit/chat/handler.test.ts`, `tests/unit/chat/payment.test.ts`, `tests/unit/chat/booking-payment.test.ts` |
| `payment.enabled` off keeps the old no-charge booking | test | `tests/unit/chat/booking-payment.test.ts` |
| `src/server/payments` never caches | test | `tests/unit/security/reference-cache.test.ts` |
| QR card, receipt upload, front desk verification | built in PAY-04 (QR card, upload); front desk verification is PAY-05 | see PAY-04 |

## PAY-04 Pay in chat

| Item | Status | Where |
|---|---|---|
| Spec payment request text (scan the QR, put the reference in the notes, send a photo of the receipt) and the "Got your receipt…" reply, both templated | test | `tests/unit/chat/payment.test.ts`, `tests/unit/payments/receipt-upload.test.ts` |
| QR card with QR image (`payment.qr_image_path`, same-site paths only), account name, amount, reference code, and deadline; "QR isn't set up yet, pay at the cashier" fallback; no QR or upload for a counter payment | test | `tests/component/chat/pay-in-chat.test.tsx`, `tests/unit/chat/payment.test.ts` |
| Receipt upload control (labelled file input, `accept` JPEG/PNG/WebP) posts to `POST /api/v1/payments/[id]/receipt`; Cami's reply is appended and the card shows "Receipt sent"; refusals show the server's fixed message | test | `tests/component/chat/pay-in-chat.test.tsx` |
| Only JPEG/PNG/WebP up to 5 MB, by file signature (GIF, PDF, renamed text, empty, > 5 MB refused; the detected type wins over the browser's) | test + local Storage smoke | `tests/unit/billing/receipts.test.ts`, `tests/unit/payments/receipt-upload.test.ts`, db/README.md (0035) |
| Another patient's payment (or a malformed ID) is reported as not found (404), in the route and in SQL | test + local SQL smoke | `tests/unit/payments/receipt-upload.test.ts`, `tests/unit/billing/payment-receipts-sql.test.ts`, db/README.md (0035) |
| Attempt limit (`payment.max_receipts`, default 3) → 409; 5 uploads per 10 minutes per patient → 429; checked before storing and again in SQL | test + local SQL smoke | `tests/unit/payments/receipt-upload.test.ts`, `tests/unit/billing/payment-receipts-sql.test.ts` |
| A rejected receipt lets the patient resend, up to the limit (SQL accepts `rejected`; the reject action itself is PAY-05) | local SQL smoke | db/README.md (0035) |
| Upload moves the payment to `submitted`, adds an attempt, and writes `receipt_submitted`, in one transaction | test (static) + local SQL smoke | `tests/unit/billing/payment-receipts-sql.test.ts`, db/README.md (0035) |
| Random object name under `{patient_id}/{payment_id}/`; service-role upload server-side only, no signed upload URL; object removed when the database refuses or fails | test | `tests/unit/payments/receipt-upload.test.ts` |
| Private bucket, 5 MB and MIME limits, no storage policies; `payment_receipts` and the function per ADR-0003 | test (static) + local SQL and Storage smoke | `tests/unit/billing/payment-receipts-sql.test.ts`, db/README.md (0035) |
| 401/403 before any read; `payment.enabled` off → 503; fixed error messages; logs hold request ID, outcome, and status only | test | `tests/unit/payments/receipt-upload.test.ts`, `tests/unit/security/logging.test.ts` |
| Every `/api/v1` route resolves the patient session | test (static) | `tests/unit/security/patient-api-routes.test.ts` |
| The receipt and payment data never reach an AI provider (the route and handler import no AI, chat orchestrator, or knowledge code) | test (static) | `tests/unit/payments/receipt-upload.test.ts` |
| "Pay later": My appointments shows the payment card (QR, amount, reference, upload) under an unpaid requested appointment | test | `tests/component/chat/pay-in-chat.test.tsx` |
| End-to-end upload through the running app against Supabase | manual | db/README.md (0035 smoke test) |

## PAY-05 Front desk verification

| Item | Status | Where |
|---|---|---|
| An appointment can't be confirmed while its payment is unverified: `cammi_connect_confirm_appointment` (0036) refuses `payment_not_verified` unless the payment is `verified`, `hmo_approved`, `not_required`, or `collect_at_counter`; no payment row is not gated (front-desk, legacy, payments-off bookings) | test (static) + local SQL smoke | `tests/unit/billing/payment-verification-sql.test.ts`, db/README.md (0036) |
| Confirm button disabled with "Payment not verified yet"; the refusal is translated for staff | test | `tests/component/front-desk/request-decision.test.tsx`, `tests/unit/front-desk/service.test.ts`, `tests/unit/billing/verification.test.ts` |
| Verify needs the transaction reference, amount received (≥ amount due), and time received; the same reference (any case or spacing) can't verify two payments (also the unique index, 23505) | test + local SQL smoke | `tests/unit/billing/verification.test.ts`, `tests/unit/payments/verification.test.ts`, `tests/unit/billing/payment-verification-sql.test.ts`, db/README.md (0036) |
| Reject a submitted receipt with a preset reason (not found, amount different, unreadable, already used, other + text); the patient can resend up to the limit | test + local SQL smoke | `tests/unit/billing/verification.test.ts`, `tests/component/front-desk/payment-panel.test.tsx`, db/README.md (0036) |
| Only active front desk/admin staff decide (re-checked in SQL, `not_allowed`); every decision writes `payment_events`; Server Actions resolve the front desk session | test (static) + local SQL smoke | `tests/unit/billing/payment-verification-sql.test.ts`, `tests/unit/security/server-actions.test.ts` |
| Queue payment badges (Awaiting payment, Receipt to check, HMO to check, Paid, Overdue), "Receipt to check" filter, receipts to check sorted first | test | `tests/component/front-desk/request-queue.test.tsx`, `tests/unit/billing/verification.test.ts`, `tests/unit/front-desk/requests.test.ts`, `tests/unit/front-desk/service.test.ts` |
| Payment panel: breakdown, reference code, deadline, attempts; Verify / Reject / Mark refunded; no actions for HMO (PAY-06) | test | `tests/component/front-desk/payment-panel.test.tsx` |
| Receipt viewer: the view is audited (`payment_events` `receipt_viewed` and `audit_logs` `payment.receipt_viewed`) before a 60-second signed URL is made server-side; the image is shown from a blob (CSP unchanged) | test + local SQL smoke | `tests/unit/payments/verification.test.ts`, `tests/component/front-desk/payment-panel.test.tsx`, db/README.md (0036) |
| Cami tells the patient in their latest chat (D9): the spec's Verified and Rejected texts and a refund-sent text, templated and hidden from the LLM (`payment_update` payload) | test | `tests/unit/payments/verification.test.ts`, `tests/unit/chat/payment.test.ts` |
| Cancelling a paid appointment creates a refund to track (D4 trigger on any cancel or reject path); a patient's own cancellation under `payment.refund_cutoff_hours` keeps the payment verified with a `no_refund` event; "Refund due" list and Mark refunded with a reference | test (static) + local SQL smoke | `tests/unit/billing/payment-verification-sql.test.ts`, `tests/component/front-desk/payment-panel.test.tsx`, db/README.md (0036) |
| Doctors never see payment data (doctor routes, components, and server reads never touch payment tables or billing modules) | test (static) | `tests/unit/security/doctor-payment-privacy.test.ts` |
| End-to-end verify/reject/refund through the running app, and the receipt image loading from Supabase Storage | manual | db/README.md (0036 smoke test) |

## PAY-06 HMO and PhilHealth paths

| Item | Status | Where |
|---|---|---|
| `cammi_connect_decide_hmo` (0037): only active front desk/admin staff (`not_allowed`, also a doctor or patient), only from `hmo_pending` (`not_open`) on a still-pending request (`not_pending`); approve needs an LOA number (`loa_required`), deny a reason (`reason_required`); both write `payment_events` (`hmo_approved`/`hmo_denied`); execute for `service_role` only | test (static) + local SQL smoke | `tests/unit/billing/hmo-decision-sql.test.ts`, db/README.md (0037) |
| Approve → `hmo_approved` with the LOA number, and Confirm then succeeds | local SQL smoke | db/README.md (0037) |
| HMO denial switches to self-pay: HMO deduction removed from the items and charge, payer `self`, recomputed amount (Cardiology ₱700 → ₱700; senior → ₱560; ₱100 co-pay HMO → ₱700), `awaiting_payment` by QR with a new deadline (`payment.deadline_minutes`, clamped to 2 h before the visit); a receipt is then accepted, verified, and the request confirmed | test (static) + local SQL smoke | `tests/unit/billing/hmo-decision-sql.test.ts`, db/README.md (0037) |
| A denial for a visit starting within 2 hours becomes `collect_at_counter` (cashier at the visit, no deadline) and can be confirmed | local SQL smoke | db/README.md (0037) |
| Cami's templated HMO approved and HMO denied messages (new amount, reference, deadline; cashier variant; ₱0 variant), the QR card (PAY-04) under a QR denial, the deny reason never repeated; hidden from the LLM | test | `tests/unit/payments/hmo-decision.test.ts`, `tests/unit/chat/payment.test.ts`, `tests/component/chat/pay-in-chat.test.tsx` |
| HMO pending message after booking (spec text) | test (PAY-03) | `tests/unit/chat/booking-payment.test.ts`, `tests/unit/chat/payment.test.ts` |
| Front desk HMO panel: provider, full member number, co-pay, LOA number once approved, denial reason once denied; Approve coverage (LOA no.) and Deny coverage (reason) only while pending | test | `tests/component/front-desk/payment-panel.test.tsx`, `tests/unit/billing/hmo.test.ts` |
| Member numbers masked (`••••4417`) everywhere else: the stored number is read only by the booking write and the front desk details, never by the queue | test + test (static) | `tests/unit/billing/hmo.test.ts`, `tests/unit/security/hmo-member-number.test.ts` |
| PhilHealth offered only when a chosen item has a benefit above ₱0 (`philhealthOffered`; consultations never; the server also refuses a PhilHealth choice without one) | test | `tests/unit/billing/hmo.test.ts`, `tests/unit/chat/booking-payment.test.ts`, `tests/component/chat/payment-cards.test.tsx` |
| End-to-end approve/deny through the running app | manual | db/README.md (0037 smoke test) |

## PAY-07 Lab, imaging, and package booking

Decisions: one appointment row per visit (`kind = 'service'`, `doctor_id` null, `service_id` = the first service; every service is a charge line, where capacity is counted); analytics (ADM-10/11/12) count consultations only, and service visits are left out.

| Item | Status | Where |
|---|---|---|
| `appointments.kind`/`service_id`; `doctor_id` null only for (and always for) a service visit; a consultation with no doctor is refused | test (static) + local SQL smoke | `tests/unit/billing/service-booking-sql.test.ts`, db/README.md (0038) |
| `service_schedules` with Manila effective dates, slot minutes, capacity per slot, overlap exclusion, ADR-0003 lockdown; audited `cammi_connect_admin_save_service_schedule` (admin only, walk-in/scheduled services only) | test (static) + local SQL smoke | `tests/unit/billing/service-booking-sql.test.ts`, db/README.md (0038) |
| `cammi_connect_book_service`: CBC + urinalysis as one visit, one charge, two lines (₱370); PWD CBC + urinalysis + FBS ₱520 → ₱416; walk-in daily cap (`service_full`); ultrasound capacity 1 refuses a second booking of the slot (`slot_full`), also under concurrency (the second call waits on the service lock); off-grid slot, holiday, lab + imaging mix, booking mode `none`, PhilHealth without a benefit all refused | test (static) + local SQL smoke | `tests/unit/billing/service-booking-sql.test.ts`, db/README.md (0038) |
| Every service visit is born with its charge and payment in the same transaction, so the PAY-05 confirm gate applies: confirm refused (`payment_not_verified`) until verified, then succeeds; no doctor notification | test (static) + local SQL smoke | `tests/unit/billing/service-booking-sql.test.ts`, db/README.md (0038) |
| Walk-in dates (all services open, first service's hours, not past, no holiday, daily cap) and scheduled slots (grid, capacity per slot) in TS | test | `tests/unit/services/booking.test.ts`, `tests/unit/service-booking/service.test.ts`, `tests/unit/chat/tools.test.ts` |
| Chat: "What kind?" chips next to the specialties (payment on only); lab multi-select, single imaging/package; dates or slots; requirements shown with the discount question, before payer and payment; PhilHealth only with a benefit, HMO only when a line is coverable; one summary, Confirm books through `cammi_connect_book_service`; templated replies | test | `tests/unit/chat/service-booking.test.ts`, `tests/component/chat/service-cards.test.tsx`, `tests/unit/chat/state.test.ts` |
| AI-APT-002 `serviceCandidates`: "Need ko magpa-CBC" goes to the CBC dates; invented names fall back to routing; payments off → front desk reply; urgent still first; prompt lists names only, no prices | test | `tests/unit/chat/service-booking.test.ts` |
| Front desk queue/details/schedule/overview and admin monitoring show the services where the doctor would be; reschedule hidden for service visits; doctor dashboard never sees them (queries scoped by `doctor_id`) | test (reschedule) + typecheck | `tests/unit/front-desk/decisions.test.ts` |
| Analytics read consultations only | test (static) | `tests/unit/analytics/service-visits.test.ts` |
| Admin service hours editor (add/remove, audited `service_schedule.*`) | test | `tests/unit/services/schedule-actions.test.ts`, `tests/unit/services/service.test.ts` |
| Patient books and pays for a CBC + urinalysis and an ultrasound slot through the running app | manual | db/README.md (0038 smoke test) |

## PAY-08 Expiry, refunds, retention

| Item | Status | Where |
|---|---|---|
| `cammi_connect_expire_unpaid` (0039): overdue `awaiting_payment`/`rejected` payments of `requested` appointments only; appointment `cancelled` with `cancelled_by_role = 'system'` and "Payment not received" plus an audit row; payment `expired` plus a `payment_events` row; `submitted`, `hmo_pending`, and not-yet-due untouched; slot released; second run a no-op; skip locked; `service_role` only | test (static) + local SQL smoke | `tests/unit/billing/expire-unpaid-sql.test.ts`, `tests/unit/appointments/audit-coverage.test.ts`, db/README.md (0039) |
| Cami's Expired message (spec text, doctor or service names) in the patient's latest conversation, `payment_update` payload hidden from the LLM | test (static) + local SQL smoke | `tests/unit/billing/expire-unpaid-sql.test.ts`, db/README.md (0039) |
| No profile can hold the `system` role | test (static) + local SQL smoke | `tests/unit/billing/expire-unpaid-sql.test.ts`, db/README.md (0039) |
| pg_cron every 5 minutes, scheduled only when the extension is installed | test (static) + local (job ran) | `tests/unit/billing/expire-unpaid-sql.test.ts`, db/README.md (0039) |
| Receipt retention (D5): purgeable 90 days after the payment closed; `refund_due` and pending requests stay open; `npm run payments:purge-receipts` deletes images then marks `purged_at` | test + local run | `tests/unit/billing/retention.test.ts`, db/README.md (0039) |
| Refunds tracked (`refund_due` → `refunded`) | test (PAY-05) | see PAY-05 |
| Overdue requests cancel automatically on the hosted project (pg_cron enabled) and the purge run there | manual | db/README.md (0039 smoke test) |
