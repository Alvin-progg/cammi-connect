# CamiConnect QA report (pre-presentation)

Date: 2026-11-24. Environment: local dev server (`npm run dev`, localhost:3000) against the hosted Supabase project. Synthetic data only. Browser pass via Claude in Chrome, desktop width.

## 1. Automated checks

| Check | Result |
|---|---|
| `npm test` | Pass: 250 files, 2287 tests |
| `npm run lint` | Pass (exit 0) |
| `npm run typecheck` | Pass (exit 0) |
| `npm run build` | **Fail**: Next.js security advisory check blocks the build on 16.4.2 (`SecurityFatalError`). Compile itself succeeded. Fix needs a Next.js upgrade, which needs approval. |
| `npm run check:bundle` | Not run (needs a successful build) |

## 2. Blockers (fix before the demo)

1. **Next.js version blocks production build.** `npm run build` exits 1 on the advisory check. Options: upgrade Next.js (dependency change, needs approval), or confirm the advisory does not apply. Until then there is no production build to demo from.
2. **`Date.now()` prerender error on every route.** Dev console shows `Route "<path>": Next.js encountered the unstable value Date.now() while prerendering` on `/login`, `/admin/*` pages, and others. The Next dev "1 Issue" badge stays on screen. Source not found in `src/` by grep; likely a dependency or a shared call under `cacheComponents`. Needs a root-cause pass before the build can be trusted.
3. **Stray "Dan" specialty is active and patient-visible.** Patients see a "Dan" chip in chat booking, and "Dr. Alvin" is linked to it. Deactivate or rename it in `/admin/specialties` before the demo.

## 3. Should fix before the demo

4. **Request details allow Confirm on a past request.** Request `…000202` (Synthetic Patient B, Nov 17) shows "Schedule check: The requested time has passed" yet the "Confirm request" button is still enabled. Disable it when the check fails.
5. **Request status contradicts its history.** Same request shows "Pending confirmation" but its history reads Confirmed (Oct 25) then Rejected (Nov 8, "Doctor unavailable"). Check whether this is seed data or a real transition bug.
6. **Benefits "Recent decisions" shows raw action keys.** `benefit.hmo_verify`, `benefit.document_viewed`, `benefit.pwd_verify` appear instead of readable labels (e.g. "HMO verified").
7. **Stale "pay by" on a pending request with a receipt.** My Appointments shows Paolo Royes (Dec 2) "Receipt sent", pay-by Nov 24 10:32 AM, still "Pending confirmation" after the deadline. Check that the expiry job (pg_cron, `0039`) is installed and running, and what the patient should see.
8. **Offensive test chat history in the patient sidebar.** A past chat titled with an offensive phrase is visible in "Previous conversations". Delete the test chat rows before the demo (needs your approval).
9. **Cami's services answer is partial.** "What services does the hospital offer?" returns only the pharmacy and points to the website. Check the knowledge corpus coverage for services.

## 4. Polish (UX)


11. **Availability heatmap is unreadable at a glance.** Month calendar dots are very small.
12. **Native form controls look unstyled.** "Choose File" inputs (receipt, PWD, HMO card) and native `<select>` (HMO provider) break the visual language. Use the shared `Field` styling.
13. **Front desk sidebar is narrow and icon-heavy** compared to the staff shell used by admin. Check consistency.
14. **Admin sidebar differs between pages.** `/admin/hmo-providers` and `/admin/knowledge-base` show a different sidebar grouping (no "Analytics" under Overview, extra "Clinical" group) than `/admin` and `/admin/analytics`. Check the nav config.
15. **Chat sidebar history is noisy.** Many near-identical "I'd like to book an appointment" entries. Truncated titles make them hard to tell apart.
16. **Chat ordering after Confirm.** The "Confirm booking" bubble appears below the old summary card, after the payment card. Check message ordering in `chat-shell.tsx`.

## 5. What works (verified in browser)

- Login, role redirects, and role guards: patient gets "Access denied" on `/admin` and `/front-desk`.
- Admin pages render with no console errors other than the `Date.now()` item: dashboard, users, departments, specialties, doctors, schedules, services, requirements, HMO providers, knowledge base (coverage table), settings (Appointment tab), analytics, audit log, appointments monitoring.
- Front desk pages render: overview (cards, pending list, today's schedule, recent activity), requests board, request details (status history, decide panel), daily schedule, walk-in booking shell, benefits verification queue.
- Doctor pages render: week view, availability (calendar, weekly hours), statistics (cards and per-day table), profile.
- Patient chat: hospital Q&A answers with sources; "book an appointment" shows specialty chips; doctor list by specialty; slot picker with Manila times; discount question; payment question; summary with price breakdown; confirm; payment card with QR, reference code, and pay-by time.
- Receipt upload (synthetic 1x1 PNG): "Receipt sent" badge and Cami's templated "Got your receipt" reply.
- My Appointments: upcoming and past lists with status, amount, reference, and pay-by.
- Account page and benefits page render with PWD and HMO sections.

Test records created during the pass (hosted DB, demo data): one booking, reference `CC-UBYZ6`, Dr. Maya Santos, Thu Nov 26 2026 10:00–10:30, patient "test", status Pending confirmation with a receipt sent. Clean up or leave for the demo, your call.

## 6. Not checked

- Front desk actions: confirm or reject, payment verify, HMO decision, reschedule, cancel, check-in, no-show, walk-in booking submit, ⌘K palette, Print list.
- Doctor actions: complete a checked-in visit, block time, notifications modal.
- Admin actions: create or edit any entity, role changes, deactivate, settings save, knowledge publish or reprocess, service and requirement publish, CSV exports.
- Patient: PWD and HMO submit, cancel from My Appointments, password change, registration.
- Toggles: `payment.enabled` off, `chatbot.enabled` off.
- Phone-width layout. The window resize did not reliably switch the page to phone width, so this needs a manual check on a real phone or a device emulator.
- Email flows (registration link, invites, reset). No inbox available.
- Accessibility (keyboard focus order, contrast) beyond what the screenshots show.

## 7. Suggested demo path (once blockers 1–3 are fixed)

1. Patient: log in, ask "What documents do I need to bring?", book with a doctor, pick a slot, confirm, upload a receipt.
2. Front desk: open Overview, open the pending request, verify payment, confirm.
3. Doctor: open the week view, check the day's appointments.
4. Admin: open the dashboard with a filter, open analytics, export a CSV.
