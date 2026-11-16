# PAY-001 — Chat Payments, Discounts and Coverage, and Non-Consultation Services

- Status: **Approved** 2026-11-16 by the project owner (all decisions D1–D10 at their recommended defaults); not yet built
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
  and seed prices. No patient-facing change. PAY-02 onward not started; no acceptance
  criterion below is ticked yet.

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
- [ ] The breakdown follows VAT exemption → 20% senior/PWD → PhilHealth → HMO, and matches
      the worked examples.
- [ ] Senior and PWD can't both be applied to one booking.
- [ ] PhilHealth is offered only for services with a benefit above ₱0.
- [ ] Confirm creates the appointment, charge, and payment together or not at all.
- [ ] Cami sends the QR card with exact amount, reference code, and deadline.
- [ ] Only JPEG/PNG/WebP up to 5 MB are accepted, checked by file signature.
- [ ] Another patient's payment can't be viewed or uploaded to (reported as not found).
- [ ] The same transaction reference number can't verify two payments.
- [ ] An appointment can't be confirmed while its payment is unverified (enforced in SQL).
- [ ] A rejected receipt lets the patient resend, up to the limit.
- [ ] HMO denial switches to self-pay and Cami sends the QR.
- [ ] Overdue unpaid requests are cancelled and release the slot; submitted receipts don't
      expire on their own.
- [ ] Cancelling a paid appointment creates a refund to track.
- [ ] Patients can book lab tests (multi-select), imaging slots, and packages, and see
      their requirements before paying.
- [ ] Emergency-sounding messages never get a payment request.
- [ ] Doctors never see payment data; receipt views are audited.

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
