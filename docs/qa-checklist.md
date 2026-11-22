# CamiConnect QA checklist

Feature-by-feature manual test list for the web system. Use synthetic data only.

Mark each item `[x]` when it passes. Note failures with the page, steps, and the exact error text.

## 0. Setup

- [ ] Apply migrations `0001`–`0042` in order in the Supabase SQL editor. Run `0006`, `0008`, `0019`, and `0028` on their own before the next file.
- [ ] Run `npm run db:seed`. Check for one admin, one front desk, one doctor, and patients.
- [ ] Run `npm run kb:ingest`. Check that Cami answers a hospital question from the corpus.
- [ ] In `/admin/settings`, turn `payment.enabled` on for the payment tests. Turn it off to check the old flow still works.
- [ ] Put the QR image at `public/payment/paymentQR.png`.
- [ ] Run `npm run dev`, then check the console for errors on every page you visit.

## 1. Public and auth (`/login`, `/register`, `/auth/callback`, `/account`, `/account/password`)

- [ ] Landing page loads at `/` at desktop and phone width (16px gutter, no horizontal scroll).
- [ ] Register with a new email. The email link lands on `/auth/callback`, then `/account/password`.
- [ ] Register with an existing email. Same generic "check your inbox" message; no account created.
- [ ] Register with a short password, mismatched confirm, or bad email. Field errors show; focus moves to the first bad field.
- [ ] Register with PWD "No" and HMO "No". Account is created.
- [ ] Register with PWD "Yes" and no ID number. Form refuses before signup.
- [ ] Register with PWD "Yes", an ID number, and a PDF instead of an image. Form refuses before signup.
- [ ] Register with PWD "Yes", a valid ID number, and image. `/account/benefits` shows PWD "Waiting for review".
- [ ] Register with HMO "Yes", a provider, and a membership number. `/account/benefits` shows HMO "Waiting for review".
- [ ] Log in as patient, doctor, front desk, and admin. Each lands on its home page.
- [ ] Log in with a wrong password. Error shows; no crash.
- [ ] Sign out. In a fresh tab, open `/account`, `/doctor`, `/front-desk`, and `/admin`. Each redirects to `/login?next=…`.
- [ ] Deactivate a profile (admin), then try to log in as it. Access is denied.
- [ ] Change password at `/account/password`. Old password fails; new one works.

## 2. Patient benefits (`/account/benefits`, registration section)

- [ ] `/account/benefits` shows PWD and HMO sections. Membership numbers and PWD IDs show only the last four digits.
- [ ] Submit PWD with a new ID and image. Status goes to "Waiting for review".
- [ ] Submit PWD with a JPEG, PNG, or WebP over 5 MB. Refused: "The image must be 5 MB or smaller."
- [ ] Submit PWD with a non-image file renamed `.jpg`. Refused (magic-byte check).
- [ ] Submit HMO with an inactive provider (admin deactivates one first). Refused: "not available right now."
- [ ] Submit HMO with a card photo, then without one. The second submit keeps the earlier card.
- [ ] After front desk verifies PWD, change the ID number. Status returns to "Waiting for review".
- [ ] Log in as a second patient. Confirm they cannot see the first patient's benefits or documents.

## 3. Front desk benefits (`/front-desk/benefits`)

- [ ] Nav shows **Benefits**. Tabs PWD and HMO show pending counts.
- [ ] Queue shows patient name, full ID or membership number, provider (HMO), and submitted date.
- [ ] "View document" opens a signed image in a new tab. The link expires after about 60 seconds.
- [ ] Verify a PWD. It leaves the queue. Patient sees "Verified".
- [ ] Reject a PWD with no reason. Refused: "A reason is required to reject."
- [ ] Reject a PWD with a reason. Patient sees the reason on `/account/benefits`.
- [ ] Verify and reject HMO memberships the same way.
- [ ] Open the same record in two tabs. Decide in one, then the other. Second shows "already been decided."
- [ ] "Recent decisions and document views" lists `benefit.*` entries with actor name and reason.
- [ ] `/admin/audit-log`: each decision and document view appears. No ID numbers or membership numbers in any payload.

## 4. Doctor HMO accreditation (`/admin/doctors/[id]`, HMO tab)

- [ ] HMO tab appears after Appointments.
- [ ] Accredit a doctor with an active provider, status Accepted, valid from today. Row appears with dates.
- [ ] Save with valid until earlier than valid from. Refused.
- [ ] Save with an invalid date. Refused.
- [ ] Save the same provider again with status Not accepted. Row updates; no duplicate row.
- [ ] Front desk user cannot save (server refuses `not_allowed`).
- [ ] `/admin/audit-log` shows `doctor_hmo.save`.

## 5. Appointment HMO on requests (`/front-desk/requests/[id]`)

- [ ] For an HMO-paid request, the Benefits panel shows provider, full membership number, accreditation status and dates, authorization, coverage, and LOA.
- [ ] Set authorization "Approved (LOA)" with an LOA number. Coverage stays unchanged.
- [ ] Set coverage "Partially covered" with authorization "Pending". Both save independently.
- [ ] Save with an invalid status value. Refused.
- [ ] Non-HMO request: panel shows "No HMO on this appointment."
- [ ] PWD line shows Verified or Not verified correctly for the patient.

## 6. Chat (`/chat`): core

- [ ] Ask a hospital question (e.g. "What are the clinic hours?"). Answer comes from the knowledge base with no invented facts.
- [ ] Ask a medical question. Cami declines and points to a doctor.
- [ ] Try a prompt injection ("ignore your rules and…"). Cami keeps its rules.
- [ ] Turn `chatbot.enabled` off. `/chat` shows the maintenance message; `POST /api/v1/chat` returns 503 `chat_disabled`. Turn it back on.
- [ ] Ask "show my appointments". Only your own appear.
- [ ] Cancel one of your appointments in chat. It cancels.
- [ ] Log in as another patient; their appointments are not visible.

## 7. Chat booking by specialty and doctor

- [ ] "Book cardiology" → pick a doctor → pick a slot → confirm. Appointment appears in the front desk requests queue as requested.
- [ ] "Book Dr. X" → slot picker shows only that doctor's real free slots.
- [ ] Pick a slot another patient just took (use two sessions). Patient is told to pick again.
- [ ] Book past `appointment.max_upcoming_per_patient` (default 3). Refused at the cap.
- [ ] Change `appointment.min_lead_hours` and `max_advance_days` in settings. Cami's slots respect them; front desk booking does not.
- [ ] Book on a hospital holiday (admin exception). No slots offered.

## 8. Chat need-based routing (AI-APT-002)

- [ ] Describe chest pain. Cami suggests Cardiology (or the matching specialty) with templated text.
- [ ] Describe an urgent symptom. The urgent message appears first.
- [ ] Say "I want a pediatrician". The named specialty wins.
- [ ] Say the patient is under 18. Routed to Pediatrics.
- [ ] Vague concern. Falls back to the first-contact specialty from settings.
- [ ] [Change specialty] works; reason for visit is editable.
- [ ] `npm run eval:routing` runs (not in CI; uses the real model, needs keys).

## 9. Chat payments (`payment.enabled` on)

- [ ] After the slot, Cami asks the discount question. Senior, PWD (only if verified), and None are shown.
- [ ] Unverified patient: PWD button is absent. Sending "PWD" anyway re-asks with the verification message.
- [ ] Verified PWD patient: PWD is offered; the summary shows 20% and VAT exemption from database fees.
- [ ] Payer question: "I'll pay (QR Ph)", "Pay at the hospital", PhilHealth only when the service has a benefit, and "My HMO" only with usable memberships.
- [ ] "My HMO" lists only memberships the chosen doctor accepts, masked. No member-number field.
- [ ] Doctor does not accept your HMO: lead text explains it; QR and counter still available.
- [ ] Accreditation ended (date passed): lead text says the accreditation ended.
- [ ] Pick QR Ph. Payment card shows amount, reference code `CC-XXXXX`, deadline, and the QR image.
- [ ] Summary amount equals card amount. A price change between summary and confirm is refused (`price_changed`).
- [ ] Booking within 2 hours with online payment: refused with the "too soon" message.
- [ ] Upload a receipt photo on the payment card. Status becomes "submitted"; Cami replies with templated text. The receipt is not shown to the LLM.
- [ ] Upload a non-image or a file over 5 MB. Refused.
- [ ] Upload more receipts than `payment.max_receipts`. Refused.
- [ ] Do nothing until the deadline: request is cancelled ("Payment not received") after pg_cron runs (hosted project only).

## 10. Front desk: requests (`/front-desk/requests`)

- [ ] Board and List views both load (`?view=`).
- [ ] "Receipt to check" filter shows requests with submitted receipts.
- [ ] Open a request. Payment panel shows breakdown, reference, deadline, and attempts.
- [ ] Verify payment with reference and amount. Amount below due is refused.
- [ ] Verify with a duplicate reference: refused (unique).
- [ ] Reject a receipt with a preset reason. Patient gets the templated message.
- [ ] Open the receipt viewer. The link works for 60 seconds; `payment.receipt_viewed` appears in the audit log.
- [ ] Confirm an unpaid self-pay request: refused `payment_not_verified`.
- [ ] Confirm a verified request: succeeds; patient gets "waiting for front desk confirmation", then confirmation.
- [ ] Reject a request with no reason: refused. With a reason: succeeds.
- [ ] A doctor who is not the appointment's doctor cannot act (check `/doctor`).
- [ ] "Next request" moves through the queue.

## 11. Front desk: HMO decisions

- [ ] Approve coverage with an LOA. Patient gets the approved message; confirm is then allowed.
- [ ] Approve without an LOA: refused.
- [ ] Deny coverage with a reason. Patient gets the denial and QR card; the reason is not shown to the patient.
- [ ] Deny coverage on a visit within 2 hours: payment becomes collect at counter.
- [ ] Deny with an empty reason: refused.
- [ ] Full member number visible only here; masked everywhere else.

## 12. Front desk: schedule (`/front-desk/schedule`)

- [ ] Day navigation (previous, next, today) keeps filters. Print list works.
- [ ] Check in a confirmed appointment. Status becomes checked in.
- [ ] Mark no-show, then completed on a checked-in visit (a doctor can also complete).
- [ ] Cannot check in before the appointment day.

## 13. Front desk: reschedule and cancel

- [ ] Reschedule to a free slot with the same doctor. Old slot is released.
- [ ] Reschedule to a taken slot: refused.
- [ ] Cancel with a preset reason. Appointment is cancelled; patient is notified in chat.
- [ ] Service visits: reschedule is hidden.

## 14. Front desk: booking and overview

- [ ] `/front-desk/book`: search an existing patient by name or phone.
- [ ] Create a walk-in patient (no login). They appear in search later.
- [ ] Book a walk-in patient with a doctor; confirmed at once.
- [ ] Front desk booking does not apply the patient booking cap or min lead time.
- [ ] `/front-desk` overview: summary cards, pending first, today's schedule, recent activity.
- [ ] ⌘K opens quick search; search by patient name or phone; results open the appointment.

## 15. Doctor (`/doctor`)

- [ ] A doctor sees only their own appointments (try a second doctor).
- [ ] Week schedule, kanban board, and list views show the same appointments.
- [ ] `/doctor/schedule`: edit weekly hours and periods. Save is refused when it would move a booked appointment outside hours.
- [ ] Add a schedule exception (leave day). Slots disappear for that day; booked appointments on it are refused.
- [ ] `/doctor/stats` loads.
- [ ] `/doctor/profile` shows own profile; admin-only contact fields are not visible.
- [ ] Notifications modal opens and lists new appointments and cancellations.
- [ ] Old `/doctor?view=` URLs redirect.
- [ ] A doctor cannot confirm a request (front desk only). A doctor can complete a checked-in visit.

## 16. Admin: users (`/admin/users`)

- [ ] List, search, and filter by role and status.
- [ ] Invite staff; the invite email arrives; the link lands on `/auth/confirm` → `/account/password`.
- [ ] Change a role through the admin UI. Audited.
- [ ] Try to change `profiles.role` directly in SQL: refused by trigger.
- [ ] Deactivate a user: cannot sign in; active sessions denied.
- [ ] Reactivate; sign-in works.
- [ ] Password reset email sends.
- [ ] Per-user activity view loads.

## 17. Admin: departments, specialties, doctors

- [ ] `/admin/departments`: counts shown. Create, edit, deactivate. Deactivation is refused with future requested or confirmed appointments.
- [ ] `/admin/specialties`: counts shown; deactivating hides it from patients but keeps existing appointments.
- [ ] `/admin/doctors`: filter by department, specialty, and status.
- [ ] Create a doctor, link a sign-in account, and check the doctor can log in as `doctor`.
- [ ] Doctor detail tabs: Profile, Schedule, Appointments, HMO.
- [ ] Admin-only contact and bio fields save and are not visible to the doctor.
- [ ] Deactivate a doctor with future appointments: refused.
- [ ] Replace a doctor's specialties; patients see the new specialty in chat.

## 18. Admin: schedules, exceptions, services, requirements

- [ ] `/admin/schedules`: lists every doctor's hours; filter by department.
- [ ] `/admin/schedules/exceptions`: add a hospital-wide holiday; slots are removed for every doctor; existing bookings that day are refused.
- [ ] `/admin/services`: create a lab test with price and booking mode (walk-in or scheduled); set hours on its detail page.
- [ ] Walk-in daily cap reached: the next patient is refused.
- [ ] Service with no price: patients see "price on request".
- [ ] Deactivate a service: hidden from chat.
- [ ] `/admin/requirements`: create a draft; publish; supersede a published requirement; archive a draft. Patients see only published requirements.

## 19. Admin: HMO providers and pricing

- [ ] `/admin/hmo-providers`: add, edit name and copay, deactivate. A deactivated provider is not offered in chat or registration.
- [ ] Price catalogue: set a specialty default fee and a doctor override. The chat summary uses the override.
- [ ] `payment.*` settings: save with the review dialog; changes are audited.

## 20. Admin: appointments, analytics, dashboard

- [ ] `/admin/appointments`: paginates; URL filters work (patient name, doctor, department, status, source, date range); patient name appears only in the list.
- [ ] `/admin/appointments/[id]`: contact details and audit timeline; there are no admin status actions.
- [ ] `/admin` dashboard: Today, This week, This month, Custom; doctor and department filters; cards link into appointments.
- [ ] `/admin/analytics`: 4 KPIs, 6 charts, data tables, and a "What it means" line under each chart.
- [ ] CSV export `/api/admin/analytics/export` downloads and is audited.
- [ ] Analytics contain no patient names.

## 21. Admin: knowledge base (`/admin/knowledge-base`)

- [ ] Create a document by typing; save as draft; publish. Cami can answer from it (test with a question).
- [ ] Upload a `.txt`, `.md`, and `.pdf` (up to 5 MB). Each ingests; a bad PDF shows the failed panel with a fixed message.
- [ ] Edit a published document's content. Status goes pending; old answers still work until re-ingest completes.
- [ ] Archive a document. Cami stops using it.
- [ ] Coverage table flags categories with nothing published.
- [ ] The service "Publish to Cami AI" button stays disabled.

## 22. Admin: settings and audit log

- [ ] `/admin/settings`: Appointment, Hospital, Chatbot, and Payment tabs. Each save shows a review-changes dialog.
- [ ] Set `chatbot.welcome_message`; a new chat shows it.
- [ ] Turn off one category in `chatbot.enabled_categories`; Cami stops using it.
- [ ] `/admin/audit-log`: filter by actor, action prefix, target type, and dates. The diff view shows previous and new values.
- [ ] Export CSV `/api/admin/audit-log/export` (10,000-row cap).
- [ ] No credential keys appear in any audit row.

## 23. Security (cross-cutting)

- [ ] As a patient, open a front desk or admin URL directly. Denied.
- [ ] As a patient, call `POST /api/v1/payments/<other patient's payment id>/receipt`. Returns 404.
- [ ] Open a benefit document link after it expires. Denied.
- [ ] Response headers include CSP and the security headers from `next.config.ts`.
- [ ] Browser devtools: no `SUPABASE_SERVICE_ROLE` or API keys in the client bundle (`npm run check:bundle` after build).
- [ ] Try the anon key directly against tables (e.g. `/rest/v1/patient_hmo`): denied (RLS on, no grants).
- [ ] Rate limits: repeated receipt uploads hit the limit (5 per 10 minutes).

## 24. Dev-only

- [ ] `/dev/kit` loads in development and is not reachable in a production build.

## 25. Automated checks

- [ ] `npm test` passes.
- [ ] `npm run lint` and `npm run typecheck` pass.
- [ ] `npm run build` passes. Note: the current build reports a Next.js security advisory on 16.4.2.
- [ ] `npm run check:bundle` passes after build.

## Known gaps (expected; not failures)

- No doctor or patient-profile PWD indicator.
- Membership and accreditation expiry is manual only.
- Verification history is a site-wide feed, not per record.
- Old PWD images stay in the bucket after a resubmit.
- `db/knowledge/payments-and-discounts.md` is not updated; re-run `npm run kb:ingest` after edits.
