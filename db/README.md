# Hosted Supabase setup

This slice uses the hosted Supabase project only. There is no local or CI database,
no `DATABASE_URL`, and no ORM. Schema changes are hand-written SQL applied through the
Supabase SQL editor. See `specs/decisions/ADR-0003-database-connections-and-rls.md`.

## Environment

`.env.local` is gitignored. It needs:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SEED_DOCTOR_EMAIL=doctor@example.test
# Optional: lets the seed create the doctor auth user if it does not exist.
SEED_DOCTOR_PASSWORD=...
# Optional: overrides the synthetic doctor display name.
SEED_DOCTOR_NAME=Dr. Maya Santos
# Optional: provisions a synthetic administrator for /admin.
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=...
SEED_ADMIN_NAME=Synthetic Administrator
# AI providers (AI-APT-001, ADR-0006). Server-only; never NEXT_PUBLIC_*.
GEMINI_API_KEY=...
# Optional: defaults shown.
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768
OPENCODE_ZEN_API_KEY=...
# Pay-as-you-go (needs Console credit): https://opencode.ai/inference/openai/v1
# OpenCode Go subscription (chosen, ADR-0006): https://opencode.ai/inference/go/openai/v1
OPENCODE_ZEN_BASE_URL=https://opencode.ai/inference/go/openai/v1
# A model served on chat-completions (e.g. glm-5.3-flash); free-tier models only
# work through the OpenCode client.
OPENCODE_ZEN_MODEL=...
# Optional: per-attempt timeout and extra attempts for transient failures.
LLM_TIMEOUT_SECONDS=20
LLM_MAX_RETRIES=2
```

- The publishable key is used for Auth in the browser/server session client.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It bypasses RLS. Never expose it to the
  browser, logs, screenshots, or chat.
- The Data API must be enabled for the project so the service-role client can reach the
  tables.
- Do not paste secrets into issue trackers or chat.
- `GEMINI_API_KEY` and `OPENCODE_ZEN_API_KEY` are server-only, like the service-role key.
  The app validates them lazily, only when a provider is first called.

### Provider smoke test

```bash
npm run smoke:providers
```

It makes one Gemini embedding call (expects a vector of `EMBEDDING_DIMENSIONS`) and one
OpenCode Zen chat completion, first with `response_format: json_object` and, if that is
rejected, without it. It prints only pass/fail lines and HTTP statuses. Record the
results in ADR-0006 "Smoke results". Each run uses a small amount of provider quota.

## 1. Apply the schema

Open the Supabase dashboard for the project, go to **SQL Editor**, paste the contents of
`db/migrations/0001_profiles_appointments.sql`, and run it once. Then run
`db/migrations/0002_doctor_dashboard_suite.sql` once, then
`db/migrations/0003_doctor_specialty_schedules.sql` once, then
`db/migrations/0004_chat.sql` once.

`0001_profiles_appointments.sql`:

- creates `public.profiles` and `public.appointments`;
- creates the `user_role` and `appointment_status` enums;
- adds indexes and `updated_at` triggers;
- creates a trigger that links new auth users to patient profiles;
- backfills existing auth users;
- enables RLS with no permissive policies;
- revokes `anon`/`authenticated` table access.

`0002_doctor_dashboard_suite.sql`:

- creates `departments`, `appointment_status_history`, `doctor_schedules`,
  `doctor_blocked_slots`, and `doctor_notifications`;
- extends `profiles` (department, specialty, phone, clinic note) and `appointments`
  (cancellation reason/role, reschedule source);
- maintains `appointments.scheduled_end_at` by trigger (needed because
  `timestamptz + interval` is not IMMUTABLE) and adds the
  `appointments_no_active_overlap` exclusion constraint that rejects overlapping
  active appointments per doctor (requires the `btree_gist` extension);
- applies the same RLS/revoke/grant model as 0001.

`0003_doctor_specialty_schedules.sql` (DOC-SCH-001):

- adds `description`/`is_active` to `departments`, a `specialties` catalogue, a
  `doctors` table (1:1 with doctor profiles), and `doctor_specialties`; backfills them
  from existing doctor profiles and the old free-text `profiles.specialty`;
- lets a weekday hold several `doctor_schedules` periods with `effective_from` /
  `effective_until`, enforced by the `doctor_schedules_no_active_overlap` constraint;
- renames `doctor_blocked_slots` to `schedule_exceptions` (with `start_datetime`,
  `end_datetime`, and an `exception_type`);
- points `appointments`, `doctor_schedules`, and `schedule_exceptions` at `doctors(id)`;
- adds `cammi_connect_save_doctor` and `cammi_connect_book_appointment`, executable
  by `service_role` only;
- applies the same RLS/revoke/grant model.

It drops no data. Deploy the matching application code at the same time, because the
renamed table and dropped `doctor_schedules_day_unique` constraint break older code.

`0004_chat.sql` (AI-APT-001 S1):

- creates `chat_conversations` (per patient, with a `booking_state` used by later
  slices) and `chat_messages` (`user`/`assistant` text, cascade-deleted with their
  conversation);
- adds the indexes for the conversation list, thread order, and retention purge;
- applies the same RLS/revoke/grant model.

### Chat retention (ADR-0008)

`chat_messages` are kept for 90 days. There is no automated job; run this purge
manually in the SQL editor:

```sql
delete from public.chat_messages
where created_at < now() - interval '90 days';

delete from public.chat_conversations c
where not exists (
  select 1 from public.chat_messages m where m.conversation_id = c.id
);
```

If the tables already exist, do not rerun a modified migration blindly. Create a new
numbered migration instead.

## 2. Create the doctor account

Either create a synthetic doctor in **Authentication → Users** and set
`SEED_DOCTOR_EMAIL` to that email, or set `SEED_DOCTOR_PASSWORD` and let the seed create
the user with a confirmed email. The password is for local synthetic testing only; do
not use a real clinician's credentials.

The auth-user trigger initially creates a patient profile. The seed then updates that
profile to `role = doctor`. Doctor accounts are not available through public
registration.

## 3. Create the admin account (optional)

Set `SEED_ADMIN_EMAIL` (and `SEED_ADMIN_PASSWORD` if the auth user does not exist yet).
The seed promotes that account's profile to `role = admin`. Admin accounts are not
available through public registration.

## 4. Seed synthetic data

```bash
npm run db:seed
```

The seed:

- links the doctor auth user to a doctor profile (Internal Medicine, phone, clinic note);
- upserts four synthetic patients and two synthetic colleague doctors;
- upserts departments, four specialties, three doctors with one or two specialties
  each, split consultation periods (including 60-minute slots), one blocked period and
  one whole-day leave exception, and three doctor notifications;
- deactivates (never deletes) other active schedule periods of the seed doctors;
- promotes the `SEED_ADMIN_EMAIL` account to admin when set;
- upserts today/tomorrow/upcoming/past appointments in `Asia/Manila`, including every
  approved status and cross-doctor appointments at the same time;
- is idempotent for these rows, but re-running it resets them.

No real patient data is used.

## 5. Smoke test

1. Start the app: `npm run dev`.
2. Sign in with the seed doctor account; it lands on the doctor dashboard (Board view).
3. Confirm the URL is `http://localhost:3000/doctor`.
4. Confirm only that doctor's appointments appear, grouped by status column.
5. Switch ranges (Today / Upcoming / History) and filter by status and specific date.
6. Confirm a requested appointment; complete or mark no-show a confirmed one; cancel
   with a reason; reschedule to a time inside regular hours — and confirm a reschedule
   outside hours, over a blocked slot, or over another appointment is rejected.
7. Open the Availability tab: add a second period on a weekday, try an overlapping
   period and confirm it is rejected, set an effective-until date, add a leave
   exception and remove it, and page through the calendar months.
8. Open Notifications: mark one read, then mark all as read; check the upcoming
   reminders callout.
9. Open Statistics: switch periods and compare the KPI cards with the daily table.
10. Open Profile: update the contact number and clinic note.
11. Sign in with a patient account and confirm `/doctor` shows the neutral access-denied
    page.
12. Sign out and confirm `/doctor` redirects to `/login?next=%2Fdoctor`.
12a. Chat (AI-APT-001 S1): register or sign in as a patient and confirm you land on
    `/chat` with the greeting and three suggestion cards. Send "How do I book?" and
    confirm the "can't help with that here yet" reply; send "I have chest pain" and
    confirm the safe decline with the emergency notice. Reload and confirm the thread
    and its entry in the history drawer persist. Confirm a doctor account sees the
    access-denied page at `/chat`, and that a signed-out
    `curl -i -X POST http://localhost:3000/api/v1/chat` returns 401.
13. Sign in as the seed admin and open `/admin`: add and deactivate a department and a
    specialty; add a directory-only doctor with two specialties; filter doctors by
    department and by specialty; open a doctor's schedule and add a period and an
    exception. Confirm a doctor or patient account sees the access-denied page at
    `/admin`.
14. In the SQL editor, check the booking function with synthetic IDs (the seed main
    doctor's profile ID and a seed patient ID) and a future Manila slot inside the
    doctor's hours:

    ```sql
    select public.cammi_connect_book_appointment(
      '<doctor-id>', '00000000-0000-4000-8000-000000000001',
      '<YYYY-MM-DD>T08:00:00+08:00', 'Smoke test');
    ```

    Run it a second time with the same slot and confirm it fails with SQLSTATE
    `23P01`. Confirm a time outside hours raises `outside_hours`, a time inside the
    leave exception raises `blocked`, and a past time raises `past`. For the
    concurrency check, run the same call from two SQL editor tabs at once and confirm
    exactly one succeeds. Cancel the smoke-test appointments afterwards.

## Troubleshooting

### Public registration fails with "Too many attempts"

Supabase's built-in email sender is rate-limited. When the limit is reached, the signup
request fails with `over_email_send_rate_limit` (HTTP 429) and no auth user is created.
This is a provider limit, not an application bug.

Options for synthetic development accounts:

- Use the seed with `SEED_DOCTOR_PASSWORD` set. It creates the doctor through the Auth
  admin API with a confirmed email, so no email is sent.
- Wait for the rate limit to reset before trying public registration again.
- Configure custom SMTP in Supabase Auth for reliable email delivery.
- In a development project only, disable **Confirm email** under Auth → Providers → Email
  to create accounts without confirmation emails. Re-enable it before any shared or
  production deployment.

Do not use real patient or clinician email addresses for synthetic testing.

## Known limitations

- The migration is manual and is not verified in CI.
- Unit/component tests mock Supabase; they do not prove RLS, grants, or real query
  behavior.
- The service role bypasses RLS, so a service-layer bug is not contained by the database.
- Slot generation and the booking function exist server-side, but there is no patient
  booking UI yet (DOC-SCH-001 follow-up). Patient cancellation windows are not
  implemented.
- The booking function, its grants, the new constraints, and concurrent booking are
  verified only by the manual smoke test above.
- There is no local database for integration or E2E tests yet.
