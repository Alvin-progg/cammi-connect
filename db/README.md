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
```

- The publishable key is used for Auth in the browser/server session client.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It bypasses RLS. Never expose it to the
  browser, logs, screenshots, or chat.
- The Data API must be enabled for the project so the service-role client can reach the
  tables.
- Do not paste secrets into issue trackers or chat.

## 1. Apply the schema

Open the Supabase dashboard for the project, go to **SQL Editor**, paste the contents of
`db/migrations/0001_profiles_appointments.sql`, and run it once. Then run
`db/migrations/0002_doctor_dashboard_suite.sql` once.

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

## 3. Seed synthetic data

```bash
npm run db:seed
```

The seed:

- links the doctor auth user to a doctor profile (Internal Medicine, phone, clinic note);
- upserts four synthetic patients and two synthetic colleague doctors;
- upserts departments, weekly consultation hours, one blocked slot, and three doctor
  notifications;
- upserts today/tomorrow/upcoming/past appointments in `Asia/Manila`, including every
  approved status and cross-doctor appointments at the same time;
- is idempotent for these rows, but re-running it resets them.

No real patient data is used.

## 4. Smoke test

1. Start the app: `npm run dev`.
2. Sign in with the seed doctor account; it lands on the doctor dashboard (Board view).
3. Confirm the URL is `http://localhost:3000/doctor`.
4. Confirm only that doctor's appointments appear, grouped by status column.
5. Switch ranges (Today / Upcoming / History) and filter by status and specific date.
6. Confirm a requested appointment; complete or mark no-show a confirmed one; cancel
   with a reason; reschedule to a time inside regular hours — and confirm a reschedule
   outside hours, over a blocked slot, or over another appointment is rejected.
7. Open the Schedule tab: save a weekday's hours, block a time, remove it, and page
   through the calendar months.
8. Open Notifications: mark one read, then mark all as read; check the upcoming
   reminders callout.
9. Open Statistics: switch periods and compare the KPI cards with the daily table.
10. Open Profile: update the contact number and clinic note.
11. Sign in with a patient account and confirm `/doctor` shows the neutral access-denied
    page.
12. Sign out and confirm `/doctor` redirects to `/login?next=%2Fdoctor`.

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
- Patient self-booking, patient cancellation windows, slot generation for patients, and
  admin provisioning are not implemented.
- There is no local database for integration or E2E tests yet.
