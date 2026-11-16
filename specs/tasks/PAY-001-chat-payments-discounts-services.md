# PAY-001 — Chat Payments, Discounts and Coverage, and Non-Consultation Services

- Status: **Approved** 2026-11-16 by the project owner (all decisions D1–D10 at their recommended defaults); **built** 2026-11-17 (all slices, PAY-01 to PAY-08; two acceptance criteria below are still unverified)
- Date: 2026-11-16
- Type: Feature
- Priority: High
- Module: Patient Chatbot / Booking, Front Desk, Administrator
- Requirements touched: `FR-004`, `UI-001`, `UI-003`, `SPEC-frontdesk.md` §5–6, `spec-admin.md`
  ADM-07 (services), ADM-08 (requirements), ADM-15 (settings)
- ADRs touched: `ADR-0005` (storage — **must be decided first**), `ADR-0007` (amend: payment
  gate on confirm, non-doctor bookings), `ADR-0008` (chat uploads)
- Companion docs: [`docs/pricing-recommendation.md`](../../docs/pricing-recommendation.md),
  [`db/knowledge/payments-and-discounts.md`](../../db/knowledge/payments-and-discounts.md)

## Progress

- 2026-11-16 — **PAY-01 built** (migration `0033_price_catalogue.sql`): specialty and
  doctor consultation fees, service pricing fields and `scheduled` booking mode,
  `hmo_providers` with an admin page, `payment.*` settings (Payment tab), audited saves,
  and seed prices. No patient-facing change.
- 2026-11-16 — **PAY-02 built**: `src/lib/billing/compute.ts` (pure TS, integer centavos,
  half-up rounding) with every worked example and pricing-doc example as test vectors. The
  HMO co-pay is charged once per booking, on the first HMO-coverable items. The two
  criteria ticked below are verified at the math level only; chat-level verification comes
  in PAY-03.
- 2026-11-16 — **PAY-03 built** (migration `0034_chat_booking_charges.sql`): with
  `payment.enabled` on, Cami asks the discount and payer questions after the slot, shows
  the breakdown on the summary, and Confirm books through `cammi_connect_book_with_charge`
  (appointment, charge snapshot, line item, payment, and `created` event in one
  transaction; the SQL recomputes the price from the database and refuses a mismatch).
  Status on create is `awaiting_payment`, `hmo_pending`, or `not_required`. "Pay at the
  hospital" (D6) is a self-pay method with the same deadline. A visit starting within 2
  hours can't be booked with payment ("pick a later time"). The payment request is text
  only (amount, reference code, deadline); the QR card is PAY-04. With
  `payment.enabled` off, booking is unchanged.
- 2026-11-17 — **PAY-04 built** (migration `0035_payment_receipts.sql`): private
  `payment-receipts` bucket (5 MB, JPEG/PNG/WebP, no storage policies), `payment_receipts`,
  and `cammi_connect_submit_payment_receipt` (owner check reported as not found,
  `awaiting_payment`/`rejected` only, `payment.max_receipts`, 5 uploads per 10 minutes per
  patient, moves to `submitted` with a `receipt_submitted` event). `POST
  /api/v1/payments/[id]/receipt` checks the session, ownership, limits, size, and file
  signature, stores the image server-side under a random name, and removes it if the
  database refuses. The QR card (QR image, account name, amount, reference, deadline,
  upload) follows the payment request, falls back to "pay at the cashier" when no QR is
  set, and is shown again under unpaid requests in My appointments. Cami's "Got your
  receipt" reply is appended server-side. A "Pay at the hospital" payment gets no QR or
  upload. The payment request now uses the spec's QR wording.
- 2026-11-17 — **PAY-05 built** (migration `0036_payment_verification.sql`): the confirm
  function refuses `payment_not_verified` unless the payment is `verified`,
  `hmo_approved`, `not_required`, or `collect_at_counter`. An appointment with no
  payment row is not gated; front-desk bookings keep having none (they are created
  confirmed, and a `collect_at_counter` row would need a priced charge), which deviates
  from the ADR-0007 amendment's wording but has the same effect. Audited verify (unique
  reference, amount ≥ due, time received; also from `awaiting_payment` for "pay at the
  hospital"), reject (preset reasons), mark refunded, and receipt view
  (`payment.receipt_viewed`, 60-second signed URL). A trigger applies D4 on every cancel
  or reject path (`refund_due`, or `no_refund` for a patient's own cancellation under
  `payment.refund_cutoff_hours`); a front desk cancellation is always a hospital
  cancellation. Request queue badges, "Receipt to check" filter and sort, Payment panel,
  disabled Confirm, "Refund due" list. Cami's Verified, Rejected, and refund-sent texts
  are appended to the patient's latest chat (D9), hidden from the LLM. HMO actions are
  PAY-06; automatic expiry PAY-08.
- 2026-11-17 — **PAY-06 built** (migration `0037_hmo_decisions.sql`): audited
  `cammi_connect_decide_hmo` (front desk/admin, from `hmo_pending` on a pending request).
  Approve records the LOA number (`hmo_approved`, confirmable). Deny records the reason
  and makes the visit self-pay: the HMO deduction is removed from the snapshotted items
  and charge (payer `self`; the HMO and member number stay on the charge), and the
  payment becomes `awaiting_payment` by QR with a new deadline (`payment.deadline_minutes`,
  clamped to 2 h before the visit). Decision: when the visit is less than 2 hours away the
  denial makes the payment `collect_at_counter` instead (the cashier collects at the
  visit, and it can be confirmed), since no online payment can be held that late. Front
  desk HMO panel (provider, full member number, co-pay, LOA number or denial reason) with
  **Approve coverage** and **Deny coverage**; the member number is masked (`••••4417`)
  everywhere else. Cami's templated approved and denied messages (the denial with the
  PAY-04 QR card, never the reason) go to the patient's latest chat, hidden from the LLM.
  PhilHealth is offered only when a chosen item has a benefit (`philhealthOffered`);
  consultations never have one, so services follow in PAY-07.
- 2026-11-17 — **PAY-07 built** (migration `0038_service_booking.sql`): `appointments.kind`
  and `service_id`, `doctor_id` null only for service visits (D3). Decision: **one
  appointment per visit**; a lab multi-select (CBC + urinalysis) is one appointment, one
  charge, and one line per test, with `appointments.service_id` the first test, and
  capacity is counted per service through the charge lines (`cammi_connect_service_load`).
  `service_schedules` (Manila effective dates, slot minutes, capacity per slot, overlap
  exclusion) with an audited admin "Hours" editor on the service page; walk-in services
  use their periods as opening hours (the visit holds the day from the first service's
  opening), scheduled ones as slots. `cammi_connect_book_service` locks the services,
  applies the patient cap, hours, hospital-wide holidays, `daily_capacity` per date and
  capacity per slot, recomputes the charge like 0034, and writes the visit, charge,
  lines, payment, and `created` event in one transaction, so every chat service booking
  has a payment row and the PAY-05 confirm gate always applies (local SQL: confirm
  refused until verified). Only active `walk_in`/`scheduled` services with a price are
  bookable (ER and pharmacy never); several services only when all are walk-in lab tests.
  Chat (payment on only; with it off, a service request gets a front desk reply): "What
  kind?" chips beside the specialties, lab multi-select, single imaging or package,
  dates or slots, published requirements (and "Doctor's request form" for services that
  need one and list none) shown with the discount question before payer and payment,
  PhilHealth only with a benefit and an HMO only when a line is HMO-coverable, one
  summary, then the PAY-03..06 payment flow. AI-APT-002 `serviceCandidates` is wired.
  Front desk and admin monitoring show the services where a doctor would be; front desk
  reschedule is hidden for service visits; doctors never see them. Decision: analytics
  (ADM-10/11/12) count consultations only; service visits wait for PAY-08 revenue
  numbers. Automatic expiry is PAY-08.
- 2026-11-17 — **PAY-08 built** (migration `0039_payment_expiry.sql`):
  `cammi_connect_expire_unpaid` cancels `requested` appointments whose payment is
  `awaiting_payment` or `rejected` past its deadline (`cancelled_by_role = 'system'`,
  "Payment not received", audit row; payment `expired` with an event; skip locked, so
  runs can overlap) and writes Cami's Expired text into the patient's latest chat itself
  (`payment_update`, hidden from the LLM), so it needs no app process. Decision: `system`
  is added to `user_role` for `cancelled_by_role`, and a check keeps every profile off
  it. pg_cron runs it every 5 minutes, scheduled by the migration only when the
  extension is installed (enabling it on the hosted project is a manual step,
  db/README.md); the front desk "Overdue" badge covers the gap. Receipt retention (D5):
  `npm run payments:purge-receipts` deletes images 90 days after the payment closed
  (`src/lib/billing/retention.ts`; `refund_due` stays open) and sets `purged_at`; run by
  hand, no scheduler. Revenue: `/admin/analytics` shows collected, refunded, refund due,
  outstanding, and HMO approved for the period, hospital-wide (definitions in
  `docs/analytics-definitions.md`).

## Objective

1. **Pay in chat.** After the patient picks everything, Cami shows the price, asks for
   payment, and sends the hospital's QR Ph code. The patient pays in GCash, Maya, or a bank
   app and sends a photo of the receipt in the chat. Front desk checks that the money
   actually arrived and only then confirms the appointment.
2. **Discounts and coverage.** Senior citizen and PWD discounts (20%), PhilHealth, and HMO,
   computed the way Philippine law and PhilHealth require.
3. **Prices.** Every bookable consultation and service has a price stored in the database
   (recommended starting rates in the companion pricing doc).
4. **More than consultations.** Patients can book laboratory tests, imaging, other
   diagnostics, and check-up packages, not just doctor consultations.

## Facts that shape this design

These come from Philippine law and PhilHealth rules, and they change what the user asked
for in two places.

- **HMO and PhilHealth are not discounts.** They are *payers*. A senior citizen can be a
  PhilHealth member at the same time, so "discount" and "who pays" are two separate
  choices, not one list.
- **Senior citizen (RA 9994) and PWD (RA 10754):** 20% off medical services, diagnostics,
  and doctors' professional fees, plus VAT exemption where VAT applies. A patient who is
  both uses one ID only (no stacking).
- **Order of deductions** (PhilHealth and the Court of Appeals): VAT exemption first, then
  the 20% senior/PWD discount, then the PhilHealth benefit. What is left is the patient's
  share.
- **No double discount with promos.** If the hospital ever runs a promo, a senior/PWD
  gets the promo or the 20%, whichever is higher.
- **PhilHealth rarely pays for a regular hospital outpatient consult.** Outpatient
  consults and basic labs are covered through **YAKAP** (formerly Konsulta) only at an
  accredited YAKAP provider where the patient is registered. So PhilHealth is a
  per-service setting that defaults to ₱0.
- **HMOs work through a Letter of Authorization (LOA)** or eligibility check. When the HMO
  approves, the patient pays ₱0 (or a co-pay). Front desk verifies with the HMO; there is
  no receipt to check.
- **A receipt screenshot proves nothing by itself.** Screenshots are easy to edit or reuse.
  Front desk must check the hospital's own GCash/Maya/bank account for the transaction,
  record its reference number, and the database must refuse the same reference number
  twice.
- **Emergencies are never behind payment.** RA 10932 makes it unlawful to require any
  deposit or advance payment for emergency care. Cami must never ask an emergency patient
  for payment; the existing urgency check stays first.
- **Use a merchant QR Ph, not a personal wallet QR.** QR Ph works with GCash, Maya, and
  most bank apps. Since July 2026, BSP separates QR Ph (person-to-merchant) from InstaPay
  QR (person-to-person).

## Patient flow (chat)

```mermaid
flowchart TD
  A[Patient: book something] --> B{What kind?}
  B -->|Consultation| C[Specialty → doctor → slot<br/>existing Paths A/B]
  B -->|Lab / imaging / package| D[Pick service(s) → date or slot]
  C --> E[Requirements shown<br/>e.g. fasting, doctor's request]
  D --> E
  E --> F[Discount: Senior / PWD / None]
  F --> G[Who pays: Myself / HMO / PhilHealth*]
  G --> H[Summary card with price breakdown<br/>Confirm]
  H -->|Confirm| I[Appointment = requested<br/>Payment record created]
  I --> J{Amount due}
  J -->|₱0, HMO| K[HMO pending → front desk checks LOA]
  J -->|> ₱0| L[Cami: payment needed<br/>QR Ph card + amount + ref code + deadline]
  L --> M[Patient uploads receipt photo]
  M --> N[Front desk checks hospital account]
  N -->|Money arrived| O[Payment verified → front desk confirms]
  N -->|Not found / wrong amount| P[Receipt rejected → Cami asks to resend]
  P --> M
  K -->|Approved| O
  K -->|Denied| L
  L -->|Deadline passes| Q[Request cancelled: payment not received]
```

`*` PhilHealth is only offered when the chosen service has a PhilHealth benefit set.

### What Cami says (templated, never LLM-written)

| Moment | Example text |
|---|---|
| Discount question | "Do any of these apply to you? You'll need to show the ID at the front desk." [Senior citizen 60+] [PWD] [None] |
| Payer question | "How will this be paid?" [I'll pay (GCash, Maya, bank)] [My HMO] [PhilHealth] |
| Summary | Card with service, doctor, time, and the breakdown: price, VAT exemption, 20% discount, PhilHealth, HMO, **amount to pay** |
| Payment request | "Almost done! To hold your slot, please pay **₱560.00** by **4:30 PM today**. Scan the QR with GCash, Maya, or your bank app and put **CC-7F3K2** in the message/notes. Then send me a photo of your receipt here." + QR card |
| Receipt received | "Got your receipt, thank you! The front desk will check it and I'll let you know here." |
| Verified | "Payment received ✔. Your appointment is now waiting for front desk confirmation." (then the existing confirmation message) |
| Rejected | "The front desk couldn't match your payment: *amount is different from ₱560.00*. Please check and send the correct receipt." |
| Expired | "Your request for Dr. … on … was cancelled because payment wasn't received in time. You can book again anytime." |
| HMO pending | "Thanks! The front desk will check your Maxicare coverage. Please request an LOA in your HMO app and bring your HMO card and a valid ID." |
| HMO denied | "Your HMO couldn't cover this visit. You can still pay **₱700.00** here to keep the slot." + QR card |

The LLM never states prices, amounts, or payment outcomes. The receipt image is **never**
sent to the LLM or any AI provider (privacy, and no prompt injection through images).

## Business rules

### Prices

- Money is stored as integer **centavos** (`₱560.00` = `56000`). No floats anywhere.
- Consultation fee = the doctor's own fee if set, otherwise the specialty's default fee
  (doctors set their own professional fees in the Philippines).
- A service with no price (`price_centavos is null`) is shown as "price on request" and
  cannot be booked in chat.
- The price is **snapshotted** when the patient confirms. A later price change never
  changes an existing appointment.
- All shown prices come from the database, like doctors and slots do today.

### Discount and coverage math (`src/lib/billing/compute.ts`, pure TS)

For each line item, in this exact order:

1. `base` = snapshotted price (VAT-inclusive when the item is VAT-able).
2. `vatExemption` = `base − round(base / 1.12)` if a senior/PWD privilege applies **and**
   the item is VAT-able; otherwise 0. Most hospital services are not VAT-able; a
   VAT-registered doctor's fee may be. The hospital's accountant sets the flag.
3. `privilegeDiscount` = `round((base − vatExemption) × 20%)` for senior or PWD; 0 otherwise.
4. `philhealth` = `min(service PhilHealth benefit, what's left)` if PhilHealth was chosen.
5. `hmo` = `what's left − co-pay` if HMO was chosen and the service is HMO-coverable.
6. `amountDue` = what's left.

Rounding: half-up to the centavo, integer math only. One privilege per booking (senior
**or** PWD). Promo discounts are out of scope; if added later, senior/PWD gets the higher of
the promo and the 20%.

Worked examples (become test vectors):

| Case | Base | VAT ex. | 20% | PhilHealth | HMO | **Pays** |
|---|---|---|---|---|---|---|
| Cardiology consult, no discount, self-pay | 700.00 | 0 | 0 | 0 | 0 | **700.00** |
| Cardiology consult, senior, self-pay | 700.00 | 0 | 140.00 | 0 | 0 | **560.00** |
| VAT-able ₱1,120 fee, PWD, self-pay | 1,120.00 | 120.00 | 200.00 | 0 | 0 | **800.00** |
| Ultrasound ₱1,500 with ₱500 PhilHealth benefit, senior | 1,500.00 | 0 | 300.00 | 500.00 | 0 | **700.00** |
| IM consult, HMO full coverage | 500.00 | 0 | 0 | 0 | 500.00 | **0.00** |

### Payment

- Confirm creates, in **one transaction**: the `requested` appointment (existing booking
  function), the charge snapshot with line items, and a payment row.
- Payment statuses:

  | Status | Meaning |
  |---|---|
  | `not_required` | Amount due is ₱0 without HMO (e.g. fully covered by PhilHealth) |
  | `hmo_pending` | Waiting for front desk to check HMO eligibility/LOA |
  | `awaiting_payment` | QR sent, no receipt yet |
  | `submitted` | Receipt uploaded, waiting for front desk |
  | `rejected` | Receipt didn't match; patient may resend |
  | `verified` | Front desk found the money in the hospital's account |
  | `hmo_approved` | HMO covers it; LOA number recorded |
  | `expired` | Deadline passed without a valid payment |
  | `refund_due` / `refunded` | Paid, then cancelled |
  | `collect_at_counter` | Front-desk bookings (`/front-desk/book`); cashier collects as today |

- **Front desk can confirm** an appointment only when payment is `verified`,
  `hmo_approved`, `not_required`, or `collect_at_counter`. The confirm SQL function enforces
  this, not just the UI.
- **Verify** requires: the transaction reference number from the hospital's account, the
  amount received, and the time received. Refused if the reference number was already used
  (unique index) or the amount received is less than the amount due.
- **Reject** requires a preset reason: *not found in our account*, *amount is different*,
  *receipt is unreadable*, *receipt was already used*, *other (write reason)*.
- A patient may submit at most **3 receipts** per payment (setting); after that Cami tells
  them to call or visit the front desk.
- **Deadline:** `payment.deadline_minutes` after Confirm (default **120**), but never later
  than 2 hours before the appointment. Slots that start sooner than that can't be
  self-booked with online payment (Cami offers a later slot).
- A `submitted` receipt never expires on its own. The patient may have paid; a person
  decides.
- **Refunds:** when a `verified` appointment is cancelled, payment becomes `refund_due`.
  Front desk records the refund reference when sent, and the status becomes `refunded`.
  Refund policy is decision D4.
- Patients can pay later from **My appointments** in the chat (payment card with the same
  QR, amount, and reference code), not only right after booking.

### Services beyond consultation

The `services` table (ADM-07) becomes bookable:

| `booking_mode` | Meaning | Example |
|---|---|---|
| `none` | Information only (today's default) | Pharmacy, ER |
| `doctor_consultation` | Goes through specialty/doctor slots | Outpatient consults |
| `walk_in` *(exists)* | Patient picks a **date**; served in order of arrival during service hours; daily cap | CBC, urinalysis, chest X-ray |
| `scheduled` *(new)* | Patient picks a **time slot** from the service's own schedule; capacity per slot | Ultrasound, 2D echo, CT scan |

- New `services` fields: `category` (`laboratory`, `imaging`, `cardiac_diagnostics`,
  `procedure`, `package`, `other`), `price_centavos`, `vatable`,
  `philhealth_benefit_centavos` (default 0), `hmo_coverable` (default true),
  `requires_doctor_request`, `daily_capacity` (walk-in).
- New `service_schedules`: service, weekday, start/end time, slot minutes, capacity per
  slot, effective dates. Same Manila and effective-date rules as doctor periods.
- Lab services can be **multi-selected** in one booking (one charge, several line items),
  because a doctor's request usually lists several tests. Consultations stay one per
  booking.
- Published requirements (ADM-08) for the chosen service are shown **before** payment
  (fasting, full bladder, doctor's request form), so nobody pays and then can't do the
  test.
- The emergency room and pharmacy are never bookable or payable in chat.

## Data model (new migrations from `0032`)

| Table / function | Slice | Purpose |
|---|---|---|
| `specialties.default_consultation_fee_centavos`, `doctors.consultation_fee_centavos` | PAY-01 | Consultation pricing |
| `services` new columns (above) | PAY-01 | Service pricing and booking mode |
| `hmo_providers` | PAY-01 | Admin-managed accredited HMOs: name, active, co-pay, notes |
| `appointment_charges` | PAY-03 | One per appointment: privilege, payer, HMO provider + member no., totals, `reference_code` (unique, e.g. `CC-7F3K2`) |
| `appointment_charge_items` | PAY-03 | Line items with snapshotted price and each deduction |
| `payments` | PAY-03 | Status, amount due, deadline, attempts, verify/reject/refund fields, `transaction_reference` (unique where not null) |
| `payment_receipts` | PAY-04 | One row per upload: storage path, content type, size, uploaded at, outcome |
| `payment_events` | PAY-03 | Append-only history (who, what, from → to, reason), like `appointment_audit_logs` |
| `service_schedules` | PAY-07 | Schedules for `scheduled` services |
| `appointments.service_id`, `appointments.kind`, nullable `doctor_id` when `kind = 'service'` | PAY-07 | Non-doctor bookings (decision D3) |
| `cammi_connect_book_with_charge` | PAY-03 | Wraps the existing booking function + charge + payment in one transaction |
| `cammi_connect_submit_payment_receipt` | PAY-04 | Owner check, attempt limit, status move to `submitted` |
| `cammi_connect_verify_payment`, `cammi_connect_reject_payment_receipt` | PAY-05 | Front desk actions, audited |
| `cammi_connect_confirm_appointment` (replaced in a new migration) | PAY-05 | Refuses unless payment status allows it |
| `cammi_connect_decide_hmo` | PAY-06 | Approve (LOA no.) or deny (→ `awaiting_payment`) |
| `cammi_connect_book_service` | PAY-07 | Capacity-checked booking for walk-in/scheduled services |
| `cammi_connect_expire_unpaid` | PAY-08 | Cancels `requested` appointments with overdue `awaiting_payment`/`rejected` payments |

All new tables follow ADR-0003: RLS on, no permissive policies, `anon`/`authenticated`
revoked, functions executable by `service_role` only.

**Settings** (ADM-15 allow-list): `payment.enabled`, `payment.qr_image_path`,
`payment.account_name`, `payment.deadline_minutes` (120), `payment.max_receipts` (3),
`payment.refund_cutoff_hours` (24), `billing.privilege_discount_bps` (2000 = 20%,
read-only display; the law fixes it).

**Storage** (decision D1): private Supabase Storage bucket `payment-receipts`; path
`{patient_id}/{payment_id}/{random}.{ext}`. Uploads go through a Route Handler
(`POST /api/v1/payments/[id]/receipt`), never directly from the browser with a key.

## Front desk changes

- Request queue: payment badge on every card (*Awaiting payment*, *Receipt to check*,
  *HMO to check*, *Paid*, *Overdue*) and a "Receipt to check" filter. Receipts to check sort
  first.
- Request details: **Payment** panel with the breakdown, reference code, deadline,
  attempts, and the receipt in a dialog (signed URL, 60-second expiry). Buttons: **Verify
  payment** (reference no., amount, time received), **Reject receipt** (preset reasons),
  and for HMO **Approve coverage** (LOA no.) / **Deny coverage**.
- **Confirm** is disabled with the reason shown ("Payment not verified yet") until payment
  allows it.
- At check-in, front desk records the senior/PWD ID number (needed on the hospital's
  official receipt) and checks the ID. If the patient isn't eligible, the difference is
  collected at the counter. ID photos are never collected in chat.
- Refunds: "Refund due" list; **Mark refunded** with the refund reference.

## Security and privacy

- Uploads: JPEG, PNG, or WebP only, checked by file signature (magic bytes), not by
  extension or the browser's content type; max **5 MB**; 5 uploads per 10 minutes per
  patient. Stored under a random name.
- Only the owning patient, front desk, and admin can see a receipt. Doctors never see
  payment data. Every receipt view by staff is audited (`payment.receipt_viewed`).
- Receipts are deleted from storage **90 days** after the payment is closed (decision D5);
  the `payments` row and audit history stay.
- HMO member numbers are shown masked (`••••4417`) everywhere except the front desk detail.
- No receipt content, amounts, or reference numbers go into server logs (existing
  fixed-string logging rule).
- The LLM never receives receipt images, payment data, or ID numbers.

## Slices

Each slice uses TDD and stops for review at its "Done when".

| Slice | Goal | Done when |
|---|---|---|
| PAY-01 | **Price catalogue.** Migration for fees, service fields, `hmo_providers`, settings keys; admin forms; seed with the recommended synthetic prices | Admin can set every price; no patient-facing change |
| PAY-02 | **Billing math.** `src/lib/billing/` compute + formatting, worked examples as tests | All test vectors pass; no UI |
| PAY-03 | **Discount, payer, and price in chat booking.** New steps, summary card with breakdown, atomic booking with charge + payment | A consult booked in chat has a correct charge snapshot and `awaiting_payment` |
| PAY-04 | **Pay in chat.** QR card, receipt upload route, storage, "pay later" in My appointments (needs D1) | Patient can upload a receipt; status `submitted` |
| PAY-05 | **Front desk verification.** Badges, receipt viewer, verify/reject, confirm gating, Cami status messages | Unpaid requests cannot be confirmed; patient sees the outcome in chat |
| PAY-06 | **HMO and PhilHealth paths** | HMO approve/deny works end to end; PhilHealth only offered when a benefit exists |
| PAY-07 | **Lab, imaging, and package booking** (walk-in date + scheduled capacity) | Patient books and pays for a CBC + urinalysis and an ultrasound slot |
| PAY-08 | **Expiry, refunds, revenue numbers** (optional) | Overdue requests cancel automatically; refunds tracked; admin sees collected vs refunded |

Order: 01 → 02 → 03 → 04 → 05 → 06. PAY-07 can start after 03, in parallel with 04–06.

## Acceptance criteria

- [ ] Every price Cami shows comes from the database; the LLM never states a price.
- [x] The breakdown follows VAT exemption → 20% senior/PWD → PhilHealth → HMO, and matches
      the worked examples. *(PAY-02, math level; PAY-03, chat summary and SQL snapshot)*
- [x] Senior and PWD can't both be applied to one booking. *(PAY-02, one `privilege`
      choice; PAY-03, one chat answer and one `privilege` column)*
- [x] PhilHealth is offered only for services with a benefit above ₱0. *(PAY-03: never
      offered for consultations; PAY-06: `philhealthOffered` over the chosen items, unit
      tested with service lines, and the server refuses PhilHealth without a benefit;
      chat-level booking of services comes with PAY-07)*
- [x] Confirm creates the appointment, charge, and payment together or not at all.
      *(PAY-03, local SQL smoke)*
- [x] Cami sends the QR card with exact amount, reference code, and deadline. *(PAY-04)*
- [x] Only JPEG/PNG/WebP up to 5 MB are accepted, checked by file signature. *(PAY-04,
      route tests and bucket limits in local Storage)*
- [x] Another patient's payment can't be viewed or uploaded to (reported as not found).
      *(PAY-04: upload verified in tests and local SQL; PAY-05: only active front desk or
      admin staff can view receipts, re-checked in SQL; patients have no receipt view)*
- [x] The same transaction reference number can't verify two payments. *(PAY-05, local SQL)*
- [x] An appointment can't be confirmed while its payment is unverified (enforced in SQL).
      *(PAY-05, local SQL)*
- [x] A rejected receipt lets the patient resend, up to the limit. *(PAY-04 limit; PAY-05
      reject then resubmit, local SQL)*
- [x] HMO denial switches to self-pay and Cami sends the QR. *(PAY-06, local SQL and
      service/component tests)*
- [x] Overdue unpaid requests are cancelled and release the slot; submitted receipts don't
      expire on their own. *(PAY-08, local SQL and pg_cron; hosted pg_cron is a manual step)*
- [x] Cancelling a paid appointment creates a refund to track. *(PAY-05, local SQL;
      Mark refunded with a reference)*
- [x] Patients can book lab tests (multi-select), imaging slots, and packages, and see
      their requirements before paying. *(PAY-07: chat flow and card tests, local SQL
      smoke; the running-app smoke in db/README.md (0038) is still manual)*
- [ ] Emergency-sounding messages never get a payment request.
- [x] Doctors never see payment data; receipt views are audited. *(PAY-05, static test and
      local SQL)*

## Decisions (approved 2026-11-16)

The project owner approved every recommended default below.

| # | Decision | Needed by | Approved |
|---|---|---|---|
| D1 | Receipt storage (`ADR-0005`, still undecided) | PAY-04 | Supabase Storage private bucket, server-side upload, 60-second signed URLs for viewing |
| D2 | Payment deadline and how expiry runs | PAY-03 / PAY-08 | 120 minutes. Until PAY-08: front desk sees "Overdue" and rejects manually. PAY-08: Supabase `pg_cron` every 5 minutes calling `cammi_connect_expire_unpaid` |
| D3 | Where non-doctor bookings live | PAY-07 | Extend `appointments` (`kind`, `service_id`, nullable `doctor_id` only for services) so the front desk queue, audit, and analytics keep working; amend ADR-0007 |
| D4 | Refund policy | PAY-05 | Cancel ≥ 24 h before → full refund; later → no refund but free rebooking within 30 days; hospital cancels → always full refund |
| D5 | Receipt retention | PAY-04 | Delete images 90 days after the payment closes; keep the payment record |
| D6 | "Pay at the hospital" option for patients without e-wallets (e.g. many seniors) | PAY-03 | Offer it, but the slot is held only until the deadline, same as QR, then cancelled if unpaid |
| D7 | Is the hospital a YAKAP provider, and which HMOs are accredited? | PAY-06 | Seed PhilHealth benefit ₱0 everywhere and a sample HMO list (Maxicare, Intellicare, MediCard, PhilCare) marked synthetic |
| D8 | Who owns real prices | PAY-01 | Seed recommended synthetic rates; the hospital's billing office replaces them before go-live |
| D9 | How Cami tells the patient about front desk decisions | PAY-05 | Server appends a templated assistant message to the patient's latest conversation; no SMS/email in this ticket |
| D10 | Automatic verification later | after PAY-08 | Out of scope now. Upgrade path: a payment gateway with dynamic QR Ph and webhooks (e.g. PayMongo) would make verification automatic and remove receipt uploads |

## Out of scope

Payment gateway integration and webhooks, OCR of receipts, BIR official receipts (the
cashier still issues them), inpatient billing, PhilHealth eClaims, promo codes,
installments, and SMS/email notifications.

## Sources

- [PhilHealth: order of deductions (VAT → 20% → PhilHealth)](https://www.philhealth.gov.ph/news/2023/seniorpwd_discounts.pdf)
- [Court of Appeals ruling on hospital SC/VAT computation (Inquirer)](https://newsinfo.inquirer.net/?p=2249756)
- [PhilHealth Circular 56-2012 with sample computations](https://www.philhealth.gov.ph/circulars/2012/circ56_2012.pdf)
- [RA 9994 IRR: no double discount](https://jur.ph/law/summary/approving-adopting-implementing-rules-republic-act-9994-expanded-senior-citizens-act)
- [PhilHealth YAKAP (formerly Konsulta)](https://www.philhealth.gov.ph/news/up/article/2025/news_6889cbf12d887.php)
- [HMO LOA process (ClinicFinderPH)](https://www.clinicfinderph.com/blog/hmo-vs-philhealth-comparison)
- [RA 10932 Anti-Hospital Deposit Law](https://jur.ph/law/facts/anti-hospital-deposit-law-amendments-republic-act-10932)
- [QR Ph and the 2026 BSP changes (PayMongo)](https://www.paymongo.com/blog/how-to-get-qr-ph-code)
