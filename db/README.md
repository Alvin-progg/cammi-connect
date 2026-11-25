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
# Optional: provisions synthetic front desk staff for /front-desk (needs 0008).
SEED_FRONT_DESK_EMAIL=frontdesk@example.test
SEED_FRONT_DESK_PASSWORD=...
SEED_FRONT_DESK_NAME=Synthetic Front Desk
# AI providers (AI-APT-001, ADR-0006). Server-only; never NEXT_PUBLIC_*.
GEMINI_API_KEY=...
# Optional: defaults shown.
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768
GROQ_API_KEY=...
# A Groq chat model that supports response_format json_object (see ADR-0006).
GROQ_MODEL=...
# Optional: default shown.
GROQ_BASE_URL=https://api.groq.com/openai/v1
# Optional: per-attempt timeout and extra attempts for transient failures.
LLM_TIMEOUT_SECONDS=20
LLM_MAX_RETRIES=2

# Optional: notification emails (0046/0047). Leave all unset to keep email off.
SMTP_HOST=smtp.example.com
# Optional: default shown. 465 uses implicit TLS; other ports use STARTTLS.
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="CamiConnect <no-reply@example.com>"
# Origin used for links in emails.
APP_BASE_URL=https://your-app.example.com
```

- The publishable key is used for Auth in the browser/server session client.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It bypasses RLS. Never expose it to the
  browser, logs, screenshots, or chat.
- The Data API must be enabled for the project so the service-role client can reach the
  tables.
- Do not paste secrets into issue trackers or chat.
- `GEMINI_API_KEY` and `GROQ_API_KEY` are server-only, like the service-role key.
  The app validates them lazily, only when a provider is first called.

### Provider smoke test

```bash
npm run smoke:providers
```

It makes one Gemini embedding call (expects a vector of `EMBEDDING_DIMENSIONS`) and one
Groq chat completion, first with `response_format: json_object` and, if that is
rejected, without it. It prints only pass/fail lines and HTTP statuses. Record the
results in ADR-0006 "Smoke results". Each run uses a small amount of provider quota.

## 1. Apply the schema

Open the Supabase dashboard for the project, go to **SQL Editor**, paste the contents of
`db/migrations/0001_profiles_appointments.sql`, and run it once. Then run
`db/migrations/0002_doctor_dashboard_suite.sql` once, then
`db/migrations/0003_doctor_specialty_schedules.sql` once, then
`db/migrations/0004_chat.sql` once, then `db/migrations/0005_knowledge.sql` once.
Then run `db/migrations/0006_appointment_status_values.sql` **on its own**, and only
after it has finished, run `db/migrations/0007_appointment_lifecycle_audit.sql`.
Then run `db/migrations/0008_front_desk_role.sql` **on its own**.
PostgreSQL cannot use a new enum value in the transaction that added it.
Then run `db/migrations/0009_front_desk_confirm_reject.sql` once, then
`db/migrations/0010_front_desk_attendance.sql` once, then
`db/migrations/0011_front_desk_reschedule_cancel.sql` once, then
`db/migrations/0012_front_desk_booking.sql` once, then
`db/migrations/0013_admin_foundation.sql` once, then
`db/migrations/0014_admin_user_management.sql` once, then
`db/migrations/0015_admin_departments.sql` once, then
`db/migrations/0016_admin_specialties.sql` once, then
`db/migrations/0017_admin_doctors.sql` once, then
`db/migrations/0018_admin_schedules.sql` once, then
`db/migrations/0019_schedule_exception_holiday.sql` **on its own** (it adds an enum
value that 0020 uses), then `db/migrations/0020_admin_schedule_exceptions.sql` once,
then `db/migrations/0021_admin_services.sql` once, then
`db/migrations/0022_admin_requirements.sql` once, then
`db/migrations/0023_fix_admin_save_create.sql` once, then
`db/migrations/0024_requirement_resupersede.sql` once, then
`db/migrations/0025_admin_knowledge_documents.sql` once, then rerun
`npm run kb:ingest` so the corpus documents get their content and category, then
`db/migrations/0026_admin_knowledge_ingestion.sql` once, then
`db/migrations/0027_admin_system_settings.sql` once, then
`db/migrations/0028_doctor_notification_confirmed.sql` on its own, then
`db/migrations/0029_doctor_notification_trigger.sql` once, then
`db/migrations/0030_query_indexes.sql` once, then
`db/migrations/0031_patient_booking_cap.sql` once, then
`db/migrations/0032_specialty_routing_hints.sql` once, then
`db/migrations/0033_price_catalogue.sql` once, then
`db/migrations/0034_chat_booking_charges.sql` once, then
`db/migrations/0035_payment_receipts.sql` once, then
`db/migrations/0036_payment_verification.sql` once.
After 0014, re-run
`npm run db:seed`: the seed now sets staff roles through
`cammi_connect_bootstrap_staff_role`. 0015 fails to build its index if two
department names differ only by case, and 0016 likewise for specialty names;
rename one first.

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

`0005_knowledge.sql` (AI-APT-001 S2):

- enables the `vector` extension in the `extensions` schema (if pgvector was
  already enabled in another schema, move it or adjust the `extensions.` prefixes
  before running);
- creates `knowledge_documents` and `knowledge_chunks` (768-dimension embeddings with
  an HNSW cosine index);
- adds `cammi_connect_match_knowledge_chunks` (published chunks only) and
  `cammi_connect_replace_document_chunks` (atomic re-ingestion of one document),
  executable by `service_role` only (ADR-0003);
- applies the same RLS/revoke/grant model.

`0006_appointment_status_values.sql` (FD-001 PR 1):

- adds `rejected` and `checked_in` to `appointment_status`. Nothing else, so it can
  commit before 0007 uses the values.

`0007_appointment_lifecycle_audit.sql` (FD-001 PR 1):

- adds the `booking_source` enum and the `appointments` columns `booking_source`,
  `created_by_profile_id`, `confirmed_by_profile_id`, `confirmed_at`,
  `rejection_reason`, and `specialty_id`, backfilling the source and creator from the
  creation history row;
- requires a `rejection_reason` on `rejected` rows;
- recreates `appointments_no_active_overlap` so `checked_in` also holds the slot;
- adds the `appointments_guard_ai_booking` trigger: an `ai_chatbot` row can only be
  inserted as `requested` (`ai_requires_confirmation`);
- creates `appointment_audit_logs`, backfilled from `appointment_status_history`. It is
  append-only: a trigger raises `audit_log_immutable` on UPDATE, DELETE, and TRUNCATE,
  and `service_role` has SELECT and INSERT only;
- makes `appointment_status_history` read-only (deprecated; a later migration drops
  it);
- replaces `cammi_connect_book_appointment` with a six-argument version that takes the
  booking source and creator and writes the `created` audit row.

Deploy the matching application code at the same time: older code writes
`appointment_status_history` and calls the four-argument booking function, and both
now fail.

`0008_front_desk_role.sql` (FD-001 PR 2):

- adds `front_desk` to `user_role`. Nothing else. Authorization stays in the server
  layer (`getFrontDeskSession`, ADR-0003); no RLS policies are added.

`0009_front_desk_confirm_reject.sql` (FD-001 PR 4):

- adds `cammi_connect_confirm_appointment(appointment, staff)`. In one transaction it
  locks the appointment and the doctor, checks the request is still `requested`, that
  the doctor is active, and that the time is in the future, inside the doctor's
  current hours and clear of schedule exceptions. It then sets `confirmed`,
  `confirmed_by_profile_id` and `confirmed_at`, and writes the `confirmed` audit row;
- adds `cammi_connect_reject_appointment(appointment, staff, reason)`, which requires
  a non-blank reason, sets `rejected` and `rejection_reason`, and writes the
  `rejected` audit row. Rejected rows are kept;
- both raise `P0001` with a code (`not_found`, `not_pending`, `inactive_doctor`,
  `past`, `outside_hours`, `blocked`, `reason_required`) and are executable by
  `service_role` only.

`0010_front_desk_attendance.sql` (FD-001 PR 5):

- adds `cammi_connect_record_attendance(appointment, staff, status)`. In one
  transaction it locks the appointment, accepts only `checked_in`, `completed`, or
  `no_show`, allows only `confirmed → checked_in | completed | no_show` and
  `checked_in → completed`, refuses an appointment whose Manila date is after today,
  then sets the status and writes the audit row with the staff member (the row's
  `created_at` is the recorded time);
- raises `P0001` with `not_found`, `invalid_status`, `invalid_transition`, or
  `not_yet`, and is executable by `service_role` only.

`0011_front_desk_reschedule_cancel.sql` (FD-001 PR 6):

- adds `cammi_connect_reschedule_appointment(appointment, staff, scheduled_at,
  reason)`. In one transaction it requires a non-blank reason, locks the appointment
  and the doctor, allows only `requested` or `confirmed`, refuses the current time,
  then checks that the new time is in the future, on one of the doctor's slots (same
  grid check as booking), and clear of schedule exceptions. It sets `scheduled_at`,
  `duration_minutes`, and `rescheduled_from_at`, keeps the doctor and status, and
  writes a `rescheduled` audit row with `previous_values` and `new_values`
  (`scheduled_at`, `duration_minutes`). A slot already held by another appointment
  fails on `appointments_no_active_overlap` (`23P01`) and nothing changes;
- adds `cammi_connect_cancel_appointment(appointment, staff, reason)`, which requires
  a non-blank reason, allows only `requested` or `confirmed`, sets `cancelled`,
  `cancellation_reason`, and `cancelled_by_role = 'front_desk'`, and writes the
  `cancelled` audit row. Cancelled rows are kept;
- both raise `P0001` with a code (`reason_required`, `not_found`,
  `not_reschedulable`, `unchanged`, `inactive_doctor`, `past`, `outside_hours`,
  `blocked`, `not_cancellable`) and are executable by `service_role` only.

`0012_front_desk_booking.sql` (FD-001 PR 7):

- adds `cammi_connect_front_desk_book_appointment(patient, doctor, specialty,
  scheduled_at, reason, staff)`. In one transaction it requires a `role = 'patient'`
  profile, locks the active doctor, checks the optional specialty against
  `doctor_specialties`, then checks that the time is in the future, on one of the
  doctor's slots (same grid check as booking), and clear of schedule exceptions. It
  inserts the appointment already `confirmed` with `booking_source = 'front_desk'`,
  `created_by_profile_id` and `confirmed_by_profile_id` set to the staff member,
  `confirmed_at`, and `specialty_id`, and writes one `created` audit row
  (`previous_status` null, `new_status` `confirmed`). A slot already held fails on
  `appointments_no_active_overlap` (`23P01`) and nothing is written;
- raises `P0001` with `invalid_patient`, `inactive_doctor`, `specialty_mismatch`,
  `past`, `outside_hours`, or `blocked`, and is executable by `service_role` only;
- walk-in patients need no function: the server inserts a `profiles` row with
  `role = 'patient'`, `auth_user_id = null`, a name, and a normalized phone.

`0013_admin_foundation.sql` (ADM-00):

- adds `profiles.is_active` (default `true`). The server's session guards deny an
  inactive profile for every role; nothing is deleted;
- creates `audit_logs` (actor profile, dotted `action`, `target_type`, `target_id`,
  `previous_values`, `new_values`, `reason`), append-only through the same
  `audit_log_immutable` triggers as `appointment_audit_logs`, with RLS on, no
  policies, and `select, insert` for `service_role` only. The server strips
  credential-like keys from the payloads before insert.

`0014_admin_user_management.sql` (ADM-01):

- adds the `profiles_guard_role_change` trigger: a plain `update` that changes
  `profiles.role` fails with `role_change_forbidden`. Roles change only inside the
  functions below and `cammi_connect_save_doctor` (recreated with the same body plus
  the flag), which set the transaction-local `cammi_connect.role_change` flag;
- adds `cammi_connect_admin_set_user_role`, `cammi_connect_admin_set_user_active`,
  `cammi_connect_admin_update_user_profile`, and `cammi_connect_admin_provision_staff`.
  Each locks the actor and target rows, checks that the actor is an active admin,
  refuses self-changes and role changes on accounts with a `doctors` row, and writes
  its `audit_logs` row in the same transaction. They raise `P0001` with `not_admin`,
  `reason_required`, `not_found`, `unchanged`, `self_change`, `doctor_record`,
  `invalid_role`, `already_provisioned`, or `full_name_required`;
- adds `cammi_connect_admin_list_users` and `cammi_connect_admin_get_user`
  (`security definer`, to join `auth.users` for email and last sign-in; no password or
  token columns are selected);
- adds `cammi_connect_bootstrap_staff_role`, used only by the seed script to create the
  first admin and the seed staff accounts;
- every function is executable by `service_role` only.

`0015_admin_departments.sql` (ADM-02):

- adds `departments.updated_at` (with the shared updated-at trigger) and a
  case-insensitive unique index on the department name;
- adds `cammi_connect_admin_save_department` (create or update; `duplicate` on a name
  or code clash) and `cammi_connect_admin_set_department_active`. Deactivation raises
  `has_future_appointments` while any of the department's doctors has a future
  `requested` or `confirmed` appointment. Both re-check that the actor is an active
  admin (`cammi_connect_require_admin_actor`) and write `department.*` audit rows in
  the same transaction. Departments are never deleted, and `doctors.department_id`
  is never cleared;
- adds the read functions `cammi_connect_department_appointment_stats(from, to)`
  (counts per department and status, by the doctor's current department) and
  `cammi_connect_department_future_conflicts(department)` (the blocking appointments,
  with no patient data);
- every function is executable by `service_role` only.

`0016_admin_specialties.sql` (ADM-03):

- adds `specialties.updated_at` (with the shared updated-at trigger) and a
  case-insensitive unique index on the specialty name;
- adds `cammi_connect_admin_save_specialty` (create or update; `duplicate` on a name
  clash) and `cammi_connect_admin_set_specialty_active`. Both re-check that the actor
  is an active admin and write `specialty.*` audit rows in the same transaction.
  Deactivation is never blocked and leaves `doctor_specialties` and
  `appointments.specialty_id` alone: it only hides the specialty from patients;
- every function is executable by `service_role` only.

`0017_admin_doctors.sql` (ADM-04):

- adds admin-managed `doctors.contact_email`, `contact_phone`, and `bio` (admin pages
  only; the patient and Cami directory never selects them) and a `NOT VALID` check that
  every new or edited doctor has a department;
- adds a trigger that rejects a `doctors` row whose profile is not a `doctor`;
- adds `cammi_connect_admin_save_doctor` (create or update with the specialty set),
  `cammi_connect_admin_set_doctor_specialties` (replaces the set in one transaction),
  `cammi_connect_admin_link_doctor_account`, and `cammi_connect_admin_set_doctor_active`.
  Each re-checks that the actor is an active admin and writes `doctor.*` audit rows in
  the same transaction. Deactivation is refused while the doctor has future requested or
  confirmed appointments;
- linking: a linkable account is an active `doctor` profile with a login and no doctor
  record (for example one invited at `/admin/users`). On create, the doctor record is
  made on that profile. For an existing doctor without a login, the account's
  `auth_user_id` moves onto the doctor's profile and the emptied account profile is
  deactivated; this is refused if anything already references the account profile;
- adds the read functions `cammi_connect_doctor_future_conflicts` (no patient data) and
  `cammi_connect_admin_list_linkable_doctor_accounts`;
- leaves `cammi_connect_save_doctor` in place; the app no longer calls it;
- every function is executable by `service_role` only.

`0018_admin_schedules.sql` (ADM-05):

- adds `cammi_connect_save_schedule_period`, the one path for creating or editing a
  weekly consultation period, for doctors (own schedule) and admins. It re-checks that
  the actor is an active admin or the active doctor whose schedule it is, and locks the
  `doctors` row as the booking functions do;
- refuses (`orphans_appointments`) an edit that would move an upcoming requested,
  confirmed, or checked-in appointment outside the doctor's hours. An appointment that
  was already outside the hours before the edit does not block it. Overlaps still raise
  the `doctor_schedules_no_active_overlap` exclusion violation;
- writes `schedule.create`, `schedule.update`, or `schedule.deactivate` to `audit_logs`
  in the same transaction; an unchanged save writes nothing;
- adds the helper `cammi_connect_doctor_appointments_outside_hours`;
- every function is executable by `service_role` only.

`0019_schedule_exception_holiday.sql` and `0020_admin_schedule_exceptions.sql` (ADM-06):

- 0019 adds the `holiday` exception type. Run it on its own, before 0020;
- 0020 lets `schedule_exceptions.doctor_id` be null for a hospital-wide holiday (a
  check keeps null doctor and type `holiday` together); holidays apply to every doctor;
- adds `cammi_connect_exception_blocks` and redefines `cammi_connect_book_appointment`,
  `cammi_connect_confirm_appointment`, `cammi_connect_reschedule_appointment`, and
  `cammi_connect_front_desk_book_appointment` to use it, so holidays raise `blocked`.
  Nothing else in those functions changes;
- adds `cammi_connect_add_schedule_exception` and
  `cammi_connect_remove_schedule_exception`, the one path for exception changes. They
  re-check the actor (an active admin, or the active doctor for their own exceptions;
  holidays are admin only), refuse (`has_appointments`) an exception that covers a
  requested, confirmed, or checked-in appointment, and write
  `schedule_exception.create` / `schedule_exception.delete` to `audit_logs` in the same
  transaction. Adding a holiday locks every `doctors` row, so no booking lands mid-check;
- every function is executable by `service_role` only.

`0021_admin_services.sql` (ADM-07):

- adds `services` (name, description, optional department, `requires_appointment`,
  and `booking_mode` `none` / `doctor_consultation` / `walk_in`), with a
  case-insensitive unique name. Services are informational only: there is no
  service-level scheduling or capacity (decision D9). RLS is on with no policies and
  `anon`/`authenticated` have no access;
- adds `cammi_connect_admin_save_service` (create or update; `duplicate` on a name
  clash, `inactive_department` when a new or changed department is inactive; a service
  may keep a department deactivated after assignment) and
  `cammi_connect_admin_set_service_active`. Both re-check that the actor is an active
  admin and write `service.*` audit rows in the same transaction. Services are never
  deleted;
- every function is executable by `service_role` only.

`0022_admin_requirements.sql` (ADM-08):

- adds `service_requirements` (title, description, exactly one of `service_id` /
  `specialty_id`, `is_mandatory`, Manila `effective_from` / `effective_to` (both
  inclusive), `status` `draft` / `published` / `archived`, and `superseded_by`). RLS is
  on with no policies and `anon`/`authenticated` have no access. Requirements are never
  deleted;
- adds `cammi_connect_admin_save_requirement` (drafts only, `not_draft` otherwise;
  `inactive_target` when a new or changed service/specialty is inactive),
  `cammi_connect_admin_publish_requirement` (draft → published),
  `cammi_connect_admin_archive_requirement` (draft or published → archived), and
  `cammi_connect_admin_supersede_requirement`, which ends a published requirement the day
  before the given date and clones it into a new draft from that date (`invalid_date`
  unless the date is after its start and no later than its end; `already_superseded`
  the second time). Each re-checks the admin actor and writes `requirement.*` audit
  rows in the same transaction (supersede writes `requirement.update` for the old row
  and `requirement.create` for the copy);
- every function is executable by `service_role` only.

`0023_fix_admin_save_create.sql`:

- redefines `cammi_connect_admin_save_department`, `_save_specialty`, `_save_service`,
  and `_save_requirement`. Their untyped `record` variable for the previous values was
  unassigned on create, so every create failed with `55000 record "v_previous" is not
  assigned yet`. It is now a typed row of the table; nothing else changes.

`0024_requirement_resupersede.sql` (ADM-08):

- redefines `cammi_connect_admin_supersede_requirement` so a published requirement
  whose newer version was archived can be superseded again (`already_superseded` only
  while that version is a draft or published). The new copy gets the original end date,
  taken from the archived copy, and `superseded_by` moves to it.

`0025_admin_knowledge_documents.sql` (ADM-13):

- extends `knowledge_documents` with `category`, `content`, `status`
  (draft/published/archived), `processing_status` (pending/processing/ready/failed),
  `processing_error`, `source_file_name`, and publish/archive/creator columns. Existing
  rows become published (or archived if they were unpublished) with processing `ready`.
- `cammi_connect_match_knowledge_chunks` now searches only `status = 'published'`
  documents, and `knowledge_documents.is_published` is dropped.
- `cammi_connect_replace_document_chunks` also stores `content` and `category`; a new
  corpus document is published, an existing one keeps its status.
- adds the audited `cammi_connect_admin_save_knowledge_document` and
  `cammi_connect_admin_set_knowledge_document_status` (publish, archive, restore), used by
  `/admin/knowledge-base`. Editing a published document's content bumps its version and
  sets processing to `pending`; its old chunks stay searchable until ADM-14 re-ingests it.

`0026_admin_knowledge_ingestion.sql` (ADM-14):

- adds the audited `cammi_connect_admin_reprocess_knowledge_document` (published
  documents only; sets processing back to `pending`, audit action `knowledge.reprocess`).
- adds `cammi_connect_store_knowledge_chunks`, which swaps a document's chunks in one
  transaction and sets processing to `ready`. It raises `stale` and changes nothing when
  the document is no longer published at the embedded version.
- redefines `cammi_connect_admin_set_knowledge_document_status`: archiving also deletes
  the document's chunks, so archived text can't come back if a later re-publish fails.
- Publish, edit, and Reprocess at `/admin/knowledge-base` now chunk and embed the
  document inline (needs `GEMINI_API_KEY` in the app's environment). A failed run sets
  processing to `failed` with a fixed message and leaves the previous chunks searchable.

`0027_admin_system_settings.sql` (ADM-15):

- adds `system_settings` (one row per allow-listed key; a missing key uses the default
  in `src/lib/settings/schema.ts`, so nothing is seeded). RLS on, no policies, no
  anon/authenticated access.
- adds the audited `cammi_connect_admin_save_settings` (active admins only; raises
  `unknown_key` for a key off the allow-list and `unchanged` when no value changed). It
  writes one `settings.update` audit row with the previous and new value of each changed
  key; a previous value of `null` means the key was using its default.
- replaces `cammi_connect_match_knowledge_chunks` with a version that takes an optional
  `categories text[]` (null searches every category). The old three-argument function is
  dropped. Cami passes `chatbot.enabled_categories`.
- Smoke test: as an admin, change the welcome message at `/admin/settings?tab=chatbot`,
  review and save, and check `/chat` shows it and `audit_logs` has a `settings.update`
  row. Turn the chatbot off: `/chat` shows the maintenance message and
  `POST /api/v1/chat` answers 503 `chat_disabled`. Set the lead time to 24 hours: Cami
  offers no slot in the next 24 hours. "Send cancellation policy to knowledge base"
  opens a new draft document. A patient account is denied at `/admin/settings`.

`0028_doctor_notification_confirmed.sql` and `0029_doctor_notification_trigger.sql`
(doctor notifications):

- 0028 adds `confirmed` to `doctor_notification_type`. Run it on its own; a new enum
  value cannot be used in the transaction that adds it.
- 0029 adds the `appointments_notify_doctor` trigger. Every appointment insert or update
  writes at most one `doctor_notifications` row: a new request, a front desk booking or
  confirmation, a reschedule, or a cancellation not made by the doctor. Rejections,
  check-ins, completions, and no-shows do not notify. Before this, only the seed wrote
  notifications. Re-running `npm run db:seed` now also creates trigger notifications for
  the seeded appointments.
- Smoke test: book through Cami as a patient, then open the bell on `/doctor` as that
  doctor; a "New request" item is there. Confirm it at `/front-desk/requests` and a
  "Confirmed by the front desk" item appears. Reschedule and cancel it from the front
  desk and check a notification for each. Open one: it is marked read and the badge drops.

`0030_query_indexes.sql` (query indexes): plain indexes for queries that filter only by
date, status, or actor (front desk queue and schedule, admin monitoring, analytics,
dashboard feeds, audit log filters). No data change; safe to re-run. Optional check:
`explain select id from appointments where scheduled_at >= now() and scheduled_at < now() + interval '1 day';`
On a small table the planner may still choose a sequential scan, which is expected.

`0031_patient_booking_cap.sql` (per-patient booking cap): replaces
`cammi_connect_book_appointment` so a patient booking is refused with
`too_many_upcoming` when the patient already has `appointment.max_upcoming_per_patient`
(default 3) upcoming requested/confirmed appointments, and adds that key to the
settings allow-list. The front desk booking function is unchanged. Safe to re-run.
- Smoke test: as a synthetic patient, book 3 future appointments through Cami. The 4th
  booking shows "You already have the maximum number of upcoming appointments…". As
  front desk, book a 4th for the same patient at `/front-desk/book`: it succeeds. As an
  admin, set the cap to 5 at `/admin/settings`; the patient can book again, and
  `/admin/audit-log` shows a `settings.update` row. Cancel the smoke-test appointments
  afterwards.

`0032_specialty_routing_hints.sql` (AI-APT-002 specialty routing hints): adds
`specialties.routing_hints` (at most 1,000 characters), replaces the audited specialty
save function with a five-argument version that stores the hints and records them in
the audit payload (the old four-argument function is dropped), and adds
`chatbot.first_contact_specialty_adult` and `chatbot.first_contact_specialty_child` to
the settings allow-list. Safe to re-run. Re-run `npm run db:seed` to load the synthetic
routing hints for the four seed specialties.
- Smoke test: as an admin, add routing hints to a specialty at `/admin/specialties/[id]`;
  `/admin/audit-log` shows a `specialty.update` row with the previous and new
  `routing_hints`. As a patient, tell Cami "Kumakabog dibdib ko minsan kahit nakaupo":
  Cami replies "A Cardiology doctor can check this for you" with doctor cards and
  **Change specialty**. "Masakit dibdib ko ngayon, hirap huminga" gets the emergency
  notice and no cards.

`0033_price_catalogue.sql` (PAY-01 price catalogue): adds integer-centavo fees
(`specialties.default_consultation_fee_centavos`, `doctors.consultation_fee_centavos`),
the service pricing columns (`category`, `price_centavos`, `vatable`,
`philhealth_benefit_centavos`, `hmo_coverable`, `requires_doctor_request`,
`daily_capacity`) with booking mode `scheduled`, and the `hmo_providers` table. The
specialty, doctor, and service save functions are replaced with versions that take the
prices and audit them (old signatures dropped); new audited HMO save and
activate/deactivate functions; and the `payment.*` keys on the settings allow-list
(`billing.privilege_discount_bps` stays off it, the 20% is fixed by law). Any negative
amount is refused with `invalid_price`. Nothing patient-facing reads these yet. Safe to
re-run. Re-run `npm run db:seed` for the synthetic prices from
`docs/pricing-recommendation.md` and the four sample HMOs (PhilHealth benefit ₱0
everywhere); the hospital's billing office replaces them before go-live.
- Smoke test: as an admin, set a specialty's default fee at `/admin/specialties/[id]`, a
  doctor's fee at `/admin/doctors/[id]`, and a service's price at `/admin/services/[id]`;
  `/admin/audit-log` shows each update with previous and new centavos. Entering `-1`
  shows a validation error. Create, edit, and deactivate an HMO at `/admin/hmo-providers`.
  The **Payment** tab at `/admin/settings` saves the deadline and shows the 20% discount
  read-only. As a patient, Cami shows no prices.

`0034_chat_booking_charges.sql` (PAY-03 charges in chat booking): adds the
`payment_status` enum (every PAY-001 status), `appointment_charges` (one per
appointment, unique `CC-XXXXX` reference code), `appointment_charge_items` (snapshotted
price and each deduction), `payments` (one per charge; `transaction_reference` unique
ignoring case and spaces), the append-only `payment_events`, and
`cammi_connect_book_with_charge`. That function books through
`cammi_connect_book_appointment` (so the 0031 cap and availability checks still apply)
and writes the charge, line, payment, and `created` event in the same transaction. It
reads the fee itself (doctor fee, else specialty default), recomputes the breakdown,
and refuses `price_changed` if the amount differs from the summary the patient saw;
`price_on_request` for a null fee; `payment_too_soon` when a self-pay visit starts
within 2 hours. The deadline is now + `payment.deadline_minutes` (default 120), clamped
to 2 hours before the visit; HMO (`hmo_pending`) and ₱0 (`not_required`) bookings get
none. `payment.enabled` is checked by the chat server: with it off, Cami books as before
with no charge. Safe to re-run.
- Local SQL check (Docker, `scripts/db-local-apply.sh`, synthetic rows): Cardiology ₱700
  none/self → `awaiting_payment`, 70000, deadline now + 120 min; senior → 56000 (14000
  off); doctor fee ₱500 over a ₱700 specialty default with full HMO → `hmo_pending`, 0,
  no deadline; a visit 3.5 h away → deadline 2 h before it. Refusals (`price_changed`,
  `payment_too_soon`, `price_on_request`, slot taken 23P01, PhilHealth on a consult,
  blank member number, inactive HMO, the 4th booking at the cap) leave the appointment,
  charge, payment, and event counts unchanged. A duplicate reference code or
  transaction reference is refused, `payment_events` rejects update and delete, and
  `anon`/`authenticated` have no table or execute access.
- Smoke test: as an admin, tick "Online payment in chat is on" on the Payment tab at
  `/admin/settings`. As a synthetic patient, book a Cardiology doctor with Cami: after the time, Cami asks about
  Senior/PWD/None and then who pays (no PhilHealth button for a consult). Choose Senior
  and "I'll pay": the summary shows Price ₱700.00, 20% discount −₱140.00, Amount to pay
  ₱560.00. Confirm: Cami replies "Almost done! To hold your slot, please pay ₱560.00 by
  …" with a `CC-` code, and in SQL the appointment has one `appointment_charges` row,
  one item, a `payments` row in `awaiting_payment`, and one `created` event. Book again
  with My HMO and a member number: the summary shows the HMO with the number masked, and
  the payment is `hmo_pending`. Turn payments off again: booking works as before with no
  charge. Cancel the smoke-test appointments afterwards.

`0035_payment_receipts.sql` (PAY-04 pay in chat): creates the private Storage bucket
`payment-receipts` (not public, 5 MB per object, `image/jpeg`/`image/png`/`image/webp`
only; idempotent upsert into `storage.buckets`, so it also runs on the local stack whose
storage schema `scripts/db-local-apply.sh` does not reset), adds no storage policies (only
the server's service-role client can read or write it), the `payment_receipts` table (one
row per accepted upload: payment, patient, storage path, content type, size, uploaded at,
outcome `pending`), and `cammi_connect_submit_payment_receipt`. That function refuses
`payment_not_found` (no such payment, or another patient's), `payment_not_open` (not
`awaiting_payment`/`rejected`, or the appointment is no longer `requested`),
`receipt_limit_reached` (`payment.max_receipts`, default 3), `receipt_rate_limited` (5
uploads in 10 minutes per patient, counted from `payment_receipts`), and
`invalid_receipt` (path outside `{patient_id}/{payment_id}/`, bad type or size); otherwise
it records the receipt, moves the payment to `submitted`, adds 1 to `attempts`, and writes
a `receipt_submitted` event, in one transaction. Uploads go only through
`POST /api/v1/payments/[id]/receipt`. Safe to re-run.
- Local SQL check (Docker, synthetic rows in a rolled-back transaction, as
  `service_role`): another patient's payment → `payment_not_found`; a path outside the
  folder → `invalid_receipt`; first upload → `submitted`, attempts 1; a second while
  `submitted` → `payment_not_open`; after setting `rejected` the 2nd and 3rd uploads pass
  and the 4th → `receipt_limit_reached`; the 6th upload by the same patient within 10
  minutes (on another payment) → `receipt_rate_limited`; one `receipt_submitted` event per
  accepted upload. `anon`/`authenticated` have no table or execute access, and the file
  applies twice without error.
- Local Storage check (service-role and anon keys from `supabase status -o env`, in a
  throwaway script): the service role uploads a JPEG; uploading to the same path again,
  a `image/gif` object, or a 5 MB + 1 byte object is refused; the anon key can neither
  download nor upload, and the public URL answers 400; remove works.
- Smoke test: as an admin, on the Payment tab set **QR Ph image path** to
  `/payment/paymentQR.png` (replace the image with the hospital's merchant QR Ph before
  go-live) and an account name. As a synthetic patient, book with "I'll pay": the reply asks to scan the
  QR and send a photo of the receipt, and the card shows the QR, account name, amount,
  `CC-` code, deadline, and a **Photo of your receipt** field. Send a small JPEG: Cami adds
  "Got your receipt, thank you! …", the card shows "Receipt sent", and in SQL the payment
  is `submitted` with one `payment_receipts` row whose object is in the bucket under
  `{patient_id}/{payment_id}/`. A `.gif` or a text file renamed `.jpg` is refused with
  "Please send a JPEG, PNG, or WebP photo."; another patient's payment ID answers 404.
  Book another QR payment and open **My appointments**: the request shows the same payment
  card with the upload. Clear the QR path: the card says to pay at the cashier and has no
  upload. Cancel the smoke-test appointments afterwards.

`0036_payment_verification.sql` (PAY-05 front desk verification): replaces
`cammi_connect_confirm_appointment` so it also refuses `payment_not_verified` unless the
appointment's payment is `verified`, `hmo_approved`, `not_required`, or
`collect_at_counter`. An appointment with **no payment row** is not gated: front-desk
bookings (0012 creates them already confirmed, with no charge), bookings from before
payments existed, and chat bookings made with `payment.enabled` off. Adds
`cammi_connect_verify_payment` (from `awaiting_payment`, `submitted`, or `rejected`;
needs a transaction reference that no other payment used, ignoring case and spaces, an
amount received of at least the amount due, and a time received not in the future),
`cammi_connect_reject_payment_receipt` (a `submitted` receipt; reason codes
`not_found`, `amount_different`, `unreadable`, `already_used`, `other`),
`cammi_connect_mark_refunded` (removed by `0040`), and
`cammi_connect_record_receipt_view` (returns the latest receipt's path for a 60-second
signed URL and writes `receipt_viewed` plus an `audit_logs` `payment.receipt_viewed`
row). All four re-check that the staff profile is an active `front_desk` or `admin`
(`not_allowed`); verify and reject also need the request to still be `requested`
(`not_pending`). Removed by `0040`: the `appointments_payment_refund` trigger applied D4 on every cancel or
reject path: a `verified` payment becomes `refund_due`, except a patient's own
cancellation less than `payment.refund_cutoff_hours` (24) before the visit, which keeps
`verified` and records a `no_refund` event (free rebooking within 30 days is handled by
staff). A front desk cancellation counts as a hospital cancellation (full refund), even
when the reason is "Patient request". The `payment_events` action check gains
`no_refund`. Safe to re-run.
- Local SQL check (Docker, synthetic rows in a rolled-back transaction, as
  `service_role`): confirm refused while `awaiting_payment`, `submitted`, and `rejected`;
  a doctor viewing a receipt → `not_allowed`; reject with a bad code →
  `reason_required`; reject → `rejected` and the patient's resubmission is accepted;
  verify refused for ₱699.99 of ₱700 (`amount_short`), a blank reference, a time an hour
  ahead, and a doctor; verify → `verified` and confirm then succeeds; a second verify →
  `not_open`; the same reference in another case on another payment →
  `duplicate_reference`; an `awaiting_payment` (counter) payment verifies without a
  receipt; the refund steps of 0036 (cancel → `refund_due`, mark refunded) no longer
  apply after 0040; a front-desk booking and a legacy request with no payment row are still
  confirmed; one `audit_logs` `payment.receipt_viewed` row; `anon`/`authenticated` have
  no execute. The file applies twice without error.
- Smoke test: with payments on and a QR path set, book with "I'll pay" as a synthetic
  patient and send a receipt. At `/front-desk/requests` the card shows **Receipt to
  check** (also under the Payment filter, and first in the list); an unpaid request past
  its deadline shows **Overdue**. Open it: the Payment panel shows the breakdown,
  `CC-` code, deadline, and receipts sent, and **Confirm request** is disabled with
  "Payment not verified yet". **View receipt** shows the image (a new `payment.receipt_viewed`
  row appears at `/admin/audit-log`). **Reject receipt** → *Amount is different*: the
  patient's chat gets "The front desk couldn't match your payment: amount is different
  from ₱…". Send another receipt, then **Verify payment** with a made-up reference, the
  amount, and the time: the chat gets "Payment received ✔…", and Confirm now works.
  Verifying another payment with the same reference is refused. Cancel the confirmed
  appointment: 0036 sent it to **Refund due**, but 0040 removed refunds, so the payment
  stays **Paid**. Doctors see no payment information on `/doctor`. Cancel the smoke-test appointments afterwards.

`0037_hmo_decisions.sql` (PAY-06 HMO decisions): adds `payments.hmo_loa_number`,
`hmo_denied_reason`, `hmo_decided_by`, and `hmo_decided_at`; relaxes
`appointment_charges_hmo_details` so a self-pay charge may keep its HMO provider and
member number after a denial (both or neither; an HMO payer always has them, PhilHealth
never); and adds `cammi_connect_decide_hmo` (active `front_desk`/`admin` only, from
`hmo_pending` while the request is still `requested`). **Approve** needs an LOA number →
`hmo_approved` (the 0036 confirm gate accepts it). **Deny** needs a reason → the HMO
deduction is removed from the items and the charge, the payer becomes `self`, and the
payment becomes `awaiting_payment` by QR Ph with a new deadline of now +
`payment.deadline_minutes` (default 120), never later than 2 hours before the visit.
When the visit starts within 2 hours (too late to hold the slot with an online payment,
and the deadline would already be past), the payment becomes `collect_at_counter`
instead: the cashier collects at the visit and the request can be confirmed. A ₱0 share
becomes `not_required`. Both write a `payment_events` row (`hmo_approved` with the LOA
number, `hmo_denied` with the reason). Refusals: `not_allowed`, `invalid_decision`,
`loa_required`, `reason_required`, `payment_not_found`, `not_open`, `not_pending`. Safe
to re-run.
- Local SQL check (Docker, `scripts/db-local-apply.sh`, synthetic rows in a rolled-back
  transaction, as `service_role`): an HMO booking is `hmo_pending` and confirm is refused
  (`payment_not_verified`); a patient or doctor deciding → `not_allowed`; a blank LOA →
  `loa_required`; a deny with no reason → `reason_required`; approve → `hmo_approved` with
  the LOA number, a second decision → `not_open`, and confirm then succeeds. Cardiology
  ₱700 with full HMO, deny → payer `self`, charge and item `hmo_centavos` 0, amount
  70000, `awaiting_payment`/`qr_ph`, deadline now + 120 min, member number kept, events
  `created` then `hmo_denied`; a receipt is then accepted (`submitted`), verified with
  ₱700, and the request confirmed. Senior with HMO, deny → 56000; an HMO with a ₱100
  co-pay, deny → 70000; a visit 90 minutes away, deny → `collect_at_counter`, no
  deadline, confirm succeeds; deciding on an `awaiting_payment` payment → `not_open`.
  `anon`/`authenticated` have no execute. The file applies twice without error.
- Smoke test: with payments on, book with **My HMO** and a member number as a synthetic
  patient; Cami replies "Thanks! The front desk will check your … coverage. Please request
  an LOA …". At `/front-desk/requests` the card shows **HMO to check** (no member
  number). Open it: the Payment panel's **HMO coverage** section shows the provider, the
  full member number, and the co-pay; Confirm is disabled. **Approve coverage** with an LOA
  number: the chat gets "Your … coverage is approved ✔…" and Confirm works. Book again
  and **Deny coverage** with a reason: the chat gets "Your HMO couldn't cover this visit.
  You can still pay ₱… here to keep the slot…" with the QR card (the reason is not
  shown), My appointments shows the payment card, and the panel shows the denial reason
  and **Verify payment**. Send a receipt and verify it as for PAY-05. Cancel the
  smoke-test appointments afterwards.

`0038_service_booking.sql` (PAY-07 lab, imaging, and package booking): adds
`appointments.kind` (`consultation` default, or `service`) and `appointments.service_id`,
and lets `doctor_id` be null only for a service visit (`appointments_kind_target`: a
consultation always has a doctor and no service; a service visit has a service and no
doctor). `appointments_no_active_overlap` is unchanged and still applies only to doctor
appointments (a null `doctor_id` never matches). One appointment per visit: a lab
multi-select is one appointment with one charge and one `appointment_charge_items` line
per test (`kind = 'service'`, new `service_id`); `appointments.service_id` is the first
test. Adds `service_schedules` (weekday, Manila start/end, slot minutes 15/30/45/60,
capacity per slot 1–100, effective dates, overlap exclusion like doctor periods, at most
8 hours, ADR-0003 lockdown), `cammi_connect_service_load` (holding service visits per
service and start time, counted through the charge lines), `cammi_connect_book_service`,
and the audited `cammi_connect_admin_save_service_schedule` (`service_schedule.create`,
`.update`, `.deactivate`; `not_admin`, `not_found`, `not_bookable`, `invalid_period`,
`overlap`). Booking locks the services (id order) and the patient, applies the
per-patient cap, checks the hours (walk-in: every chosen service open that day, the visit
runs from the first service's opening to its closing, at most 8 hours; scheduled: the
slot is on the period grid), hospital-wide holidays (`blocked`), `services.daily_capacity`
per Manila date (`service_full`) and capacity per slot (`slot_full`), recomputes the
charge like 0034 (`price_changed`, `payment_too_soon`, PhilHealth only with a benefit, an
HMO only when a line is HMO-coverable), and writes the appointment, its audit row, the
charge, the lines, the payment, and the `created` event in one transaction. Only active
`walk_in`/`scheduled` services with a price can be booked (`service_unavailable`,
`price_on_request`); several services only when all are walk-in lab tests
(`invalid_service_combination`). Replaces `cammi_connect_confirm_appointment` (same
payment gate; a service visit skips the doctor checks and needs its service active,
`service_unavailable`) and `cammi_connect_notify_doctor` (nothing for a service visit).
Front desk reschedule is hidden for service visits. Safe to re-run.
- Local SQL check (Docker, `scripts/db-local-apply.sh`, synthetic rows in a rolled-back
  transaction, as `service_role`): 28 audited `service_schedule.create` rows; an
  overlapping period → `overlap`, a front desk actor → `not_admin`, hours for the ER →
  `not_bookable`. CBC + urinalysis, self-pay QR → one appointment (`kind` service, no
  doctor, service = CBC, 07:00, 300 min), one charge with 2 lines, ₱370 due,
  `awaiting_payment` with a deadline, one `created` audit row, no doctor notification;
  confirm → `payment_not_verified`; verify, then confirm → `confirmed`. PWD CBC +
  urinalysis + FBS → ₱416; a wrong expected amount → `price_changed`. CBC daily capacity
  2: a third booking that day → `service_full`, the next day works. Ultrasound (capacity
  1) senior → ₱1,200; a second booking of the same slot → `slot_full`, also from a second
  session while the first is still open (it waits on the lock, then is refused); an
  off-grid time → `outside_hours`; PhilHealth with no benefit → `invalid_payment_choice`;
  urinalysis + ultrasound → `invalid_service_combination`; the ER (`none`) →
  `service_unavailable`; a hospital holiday → `blocked`. Inserting a consultation without
  a doctor, or a service visit without a service, fails `appointments_kind_target`.
  `anon`/`authenticated` have no execute on the three functions and no access to
  `service_schedules`. The file applies twice without error. The seed's service hours and
  requirements insert cleanly.
- Smoke test: run the seed (service hours Mon–Sat for walk-in services, slots for the
  ultrasounds, 2D echo, and CT; published requirements from
  `docs/pricing-recommendation.md`), turn payments on, and as a synthetic patient say
  "I want to book" → **Lab tests** → tick CBC and Urinalysis → pick a day. Cami shows
  "What to prepare" (Doctor's request, clean-catch sample) with the discount question,
  then who pays (no PhilHealth), then one summary with both tests; Confirm sends the QR
  card. Send a receipt and verify it at `/front-desk/requests` (the card shows the tests
  instead of a doctor; no Reschedule), then Confirm. Book **Imaging and diagnostics** →
  Whole abdomen ultrasound → a slot; a second patient no longer sees that slot. Also try
  "Need ko magpa-CBC, may request na ako". `/doctor` shows neither visit; `/admin/analytics`
  counts neither. As an admin, add and remove hours on a service's detail page and check
  `/admin/audit-log`. Cancel the smoke-test appointments afterwards.

`0040_remove_refunds.sql` (no-refund policy): drops the `appointments_payment_refund`
trigger and `cammi_connect_payment_refund_on_cancel`/`cammi_connect_mark_refunded`;
moves `refund_due` and `refunded` payments back to `verified`; deletes their
`refund_due`, `no_refund`, and `refunded` `payment_events` rows (the immutability trigger
is disabled only for that delete); drops `payments.refund_reference`, `refunded_by`, and
`refunded_at`; deletes the `payment.refund_cutoff_hours` setting and redefines
`cammi_connect_admin_save_settings` without it. The `payment_status` enum keeps the
`refund_due` and `refunded` labels (Postgres cannot drop enum values, and three booking
functions return `payment_status`); nothing writes them. Back up `payments` and
`payment_events` first. Safe to re-run. Smoke test: cancel a verified appointment as the
patient and as the front desk; the payment stays `verified`; the Payment tab in
`/admin/settings` has no cutoff field.

`0039_payment_expiry.sql` (PAY-08 expiry, receipt retention): adds `system` to
`user_role` (used only by `appointments.cancelled_by_role`; `profiles_role_not_system`
keeps every profile on one of the four real roles) and `cammi_connect_expire_unpaid()`,
which cancels every `requested` appointment whose payment is `awaiting_payment` or
`rejected` and past `deadline_at`: the appointment becomes `cancelled`
(`cancelled_by_role = 'system'`, reason "Payment not received", an
`appointment_audit_logs` row with no actor), the payment `expired` (a `payment_events`
row), and Cami's templated Expired message ("Your request for Dr. … on … was cancelled
because payment wasn't received in time. You can book again anytime.", the tests' names
for a service visit) is added to the patient's latest conversation with a
`payment_update` payload, which the model never sees. `submitted` and `hmo_pending`
never expire. Rows locked by another transaction (a verify or an upload in flight) are
skipped and picked up on the next run, so overlapping runs are safe; it returns how
many expired. Replaces `cammi_connect_notify_doctor` so a doctor reads "cancelled by
the system (request expired)". Adds `payment_receipts.purged_at` and
`cammi_connect_mark_receipts_purged(uuid[])`. Execute for `service_role` only. Safe to
re-run.

- **pg_cron (D2, every 5 minutes).** The file schedules the job
  `cammi-connect-expire-unpaid` (`*/5 * * * *`) only when the `pg_cron` extension is
  installed; otherwise it prints a notice. On the hosted project, enable **pg_cron**
  (Dashboard → Integrations → Cron, or `create extension if not exists pg_cron with
  schema pg_catalog;`), then run the file again (or just its last `do $$ … $$` block).
  Check with `select jobname, schedule, active from cron.job;` and
  `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`.
  Until the job runs, an unpaid request past its deadline shows **Overdue** at the
  front desk. To run it by hand: `select public.cammi_connect_expire_unpaid();`.
- **Receipt retention (D5).** `npm run payments:purge-receipts` (needs `.env.local` with
  `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; add `-- --dry-run` to only
  count) deletes receipt images from the `payment-receipts` bucket 90 days after their
  payment closed (`verified`, `hmo_approved`, `expired`, `refunded`, `not_required`,
  `collect_at_counter`, or an unfinished payment whose request is no longer pending), then sets `purged_at`. Payment rows, receipt rows, and
  history stay. It prints counts only. There is no scheduler for it: run it monthly by
  hand (or from any cron host with the env vars). A front desk "View receipt" on a
  purged receipt fails to load the image.
- Local SQL check (Docker, `scripts/db-local-apply.sh`, synthetic rows in a rolled-back
  transaction, run as `service_role`): of six overdue-or-not requests, the overdue
  `awaiting_payment` consultation, overdue `rejected` consultation, and overdue
  `awaiting_payment` CBC + urinalysis visit → `cancelled`/`system`/"Payment not
  received", payment `expired`, one `cancelled` audit row (no actor) and one `expired`
  event each; the overdue `submitted`, overdue `hmo_pending`, and not-yet-due
  `awaiting_payment` ones are untouched; the first run returns 3, the second 0. Three
  Expired messages ("Dr. Liza Synthetic on 1 Dec, 9:00 AM", "CBC + Urinalysis on 2 Dec,
  7:00 AM") land in the patient's most recently updated conversation with
  `{"kind":"payment_update"}`; the doctor gets "cancelled by the system (request
  expired)"; a new request at the expired slot is accepted. A profile with role
  `system` is refused (`profiles_role_not_system`). Marking two receipts purged returns
  2, again 0. `anon`/`authenticated` have no execute. With committed rows, a payment
  locked by another session (`select … for update`) is skipped (2 expired) and the next
  run expires it (1). With pg_cron installed locally the file schedules one job and
  re-running keeps one; the job ran on its own and expired an overdue request.
  `npm run payments:purge-receipts` against the local API deleted the image of an
  expired payment closed 91 days ago and marked it, kept a `submitted` one, and a second
  run found nothing. The file applies twice without error.
- Smoke test (hosted): with payments on, book with "I'll pay" as a synthetic patient and
  don't pay. Set that payment's deadline into the past
  (`update public.payments set deadline_at = now() - interval '1 minute' where id = '…';`).
  `/front-desk/requests` shows **Overdue** until the next job run (≤ 5 minutes); then the
  request is gone from the queue, the patient's chat shows the Expired message, My
  appointments shows it cancelled, and the slot is offered again. Upload a receipt on a
  second booking and backdate it the same way: it stays **Receipt to check**.

Audit log (ADM-16, no migration): as an admin, open `/admin/audit-log`, filter by
"Settings (settings.*)", open an entry and check its previous and new values, then use
**Export CSV**. A new `audit.export` row appears at the top of the log. A patient
account is denied at `/admin/audit-log` and gets 403 from `/api/admin/audit-log/export`.

#### Supabase Auth email templates (ADM-01, manual)

Admin-sent invites and password resets land on `/auth/confirm`, which verifies the
token on the server. In Supabase → Authentication:

1. **URL Configuration:** set **Site URL** to the app's origin (for example
   `http://localhost:3000` in development).
2. **Email Templates → Invite user:** set the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`.
3. **Email Templates → Reset password:** set the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.

The default Supabase SMTP sends only a few emails per hour; configure custom SMTP
before inviting more than a handful of staff (see Troubleshooting).

### Knowledge base ingestion (ADR-0004)

The synthetic corpus lives in `db/knowledge/*.md` (one document per file; the file
name is the slug and the first `#` heading is the title). After applying `0005`, load
it with:

```bash
npm run kb:ingest
```

It needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`
in `.env.local`. Documents whose content hash has not changed are skipped, so rerun it
after editing the corpus. A rerun overwrites admin edits to a corpus document's content
and category. To unpublish a document without deleting it, archive it at
`/admin/knowledge-base` (Cami stops using it at once).

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

Front desk staff work the same way: set `SEED_FRONT_DESK_EMAIL` (and
`SEED_FRONT_DESK_PASSWORD` if the auth user does not exist yet), after applying 0008.
The seed sets that account's profile to `role = front_desk`. There is no registration
or admin screen for front desk accounts.

## 4. Seed synthetic data

```bash
npm run db:seed
```

The app caches admin reference data (departments, specialties, doctors, services,
requirements, schedules, knowledge documents) for up to an hour; the app's own save
actions clear that cache at once. The seed, `npm run kb:ingest`, and edits in the SQL
editor do not, so after running them restart `npm run dev` (or wait an hour) to see
the new data.

The seed:

- links the doctor auth user to a doctor profile (Internal Medicine, phone, clinic note);
- upserts four synthetic patients and two synthetic colleague doctors;
- upserts departments, four specialties, three doctors with one or two specialties
  each, split consultation periods (including 60-minute slots), one blocked period and
  one whole-day leave exception, and three doctor notifications;
- deactivates (never deletes) other active schedule periods of the seed doctors;
- promotes the `SEED_ADMIN_EMAIL` account to admin when set (through
  `cammi_connect_bootstrap_staff_role`, migration 0014);
- sets the `SEED_FRONT_DESK_EMAIL` account to front desk when set;
- upserts today/tomorrow/upcoming/past appointments in `Asia/Manila`, including every
  approved status and cross-doctor appointments at the same time;
- marks the pending (`requested`) appointments as Cami requests
  (`booking_source = ai_chatbot`, created by the patient) and inserts one `created`
  audit entry for each, once (re-runs never rewrite audit rows);
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
    `/chat` with the greeting and three suggestion cards. Send "Can I reschedule my
    appointment?" and confirm the "can't help with that here yet" reply; send "I have chest pain" and
    confirm the safe decline with the emergency notice. Reload and confirm the thread
    and its entry in the history drawer persist. Confirm a doctor account sees the
    access-denied page at `/chat`, and that a signed-out
    `curl -i -X POST http://localhost:3000/api/v1/chat` returns 401.
12b. Hospital information (AI-APT-001 S2), after `npm run kb:ingest`: ask "What
    documents do I need to bring for my appointment?" and confirm an answer with a
    Sources list naming corpus documents; ask an off-corpus question (for example
    "How much is parking at another hospital?") and confirm the amber "not found in the
    hospital's information" callout; ask "Which departments do you have?" and confirm
    the list matches `/admin`. Reload and confirm the sources and callout persist.
    Rerun `npm run kb:ingest` and confirm every document is skipped as unchanged.
12c. Booking (AI-APT-001 S3), with the seed doctor's schedule in place:
    - Path A: send "I'd like to book an appointment", pick a specialty card, pick the
      seed doctor, pick a slot, and check the summary. Confirm that nothing is in
      `appointments` yet, then press Confirm booking and confirm the "Request received"
      card. Confirm the row exists with status `requested`, and that it appears on the
      doctor's `/doctor` board.
    - Path B: send "Book Dr. <seed doctor's name> next Tuesday morning" and confirm the
      reply goes straight to that doctor's slots (or asks for a specialty first when the
      doctor has several). Book one and confirm it on the `/doctor` board.
    - Stale slot: open a slot picker, book that slot from another patient account, then
      pick it in the first tab and confirm "That time is no longer available" with
      fresh slots.
    - Two-tab race: open the same conversation in two tabs on the summary card, press
      Confirm booking in both as close together as possible, and confirm exactly one
      appointment row is created. The other tab gets "already being processed" or "That
      slot was just booked".
    - Send "Book a cardiologist for <a date more than 60 days ahead>" and confirm the
      60-day reply.
    - Cancel the smoke-test appointments afterwards.
12d. View and cancel (AI-APT-001 S4), with two `requested` appointments from 12c:
    - Start a new chat and press "View Appointments" on the My Appointments suggestion
      card; confirm `/chat?view=appointments` lists both under Upcoming. Cancel one from
      that page through its confirmation dialog and confirm the success toast and that it
      moves to Past.
    - Back in the chat, send "Show my appointments" and confirm the "Here are your
      upcoming appointments" card lists the other one in Philippine time.
    - Send "I want to cancel my appointment", press Cancel appointment on it, and confirm
      the confirmation step appears with nothing changed yet in `appointments`. Press
      Confirm cancellation and confirm "Your appointment has been cancelled."
    - Confirm the row's status is `cancelled`, a `status_history` row has
      `changed_by_profile_id` set to the patient's profile ID, and the appointment has
      left the active columns of the doctor's `/doctor` board.
    - Send "Can I reschedule my appointment?" and confirm the "Rescheduling isn't
      available yet" reply.
    - Sign in as a second patient and confirm the first patient's appointment is not
      listed.
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
      '<YYYY-MM-DD>T08:00:00+08:00', 'Smoke test',
      'ai_chatbot', '00000000-0000-4000-8000-000000000001');
    ```

    Run it a second time with the same slot and confirm it fails with SQLSTATE
    `23P01`. Confirm a time outside hours raises `outside_hours`, a time inside the
    leave exception raises `blocked`, and a past time raises `past`. For the
    concurrency check, run the same call from two SQL editor tabs at once and confirm
    exactly one succeeds. Cancel the smoke-test appointments afterwards.
15. Check the FD-001 lifecycle guards in the SQL editor with synthetic IDs:
    - The appointment booked in step 14 has `booking_source = 'ai_chatbot'`,
      `created_by_profile_id` set, and exactly one `appointment_audit_logs` row with
      `action = 'created'`.
    - Inserting an appointment directly with `booking_source = 'ai_chatbot'` and
      `status = 'confirmed'` fails with `ai_requires_confirmation`.
    - `update public.appointment_audit_logs set reason = 'x' where id = '<audit-id>'`
      and `delete from public.appointment_audit_logs where id = '<audit-id>'` both fail
      with `audit_log_immutable`.
    - Setting a smoke-test appointment to `rejected` without a `rejection_reason` fails
      on `appointments_rejection_reason_required`.
    - With one smoke-test appointment set to `checked_in`, inserting an overlapping
      appointment for the same doctor fails with SQLSTATE `23P01`.
    - Open `/doctor` and confirm older appointments still show their history (now read
      from `appointment_audit_logs`).

    Cancel the smoke-test appointments afterwards. Audit rows stay, by design.
16. Check front desk access (FD-001 PR 2), after applying 0008 and seeding with
    `SEED_FRONT_DESK_EMAIL`:
    - Sign in as the seed front desk account with no `next` path and confirm you land
      on `/front-desk`, which shows the Overview shell with your name.
    - As that account, open `/admin` and `/doctor` and confirm both show the neutral
      access-denied state. `/chat` also shows access denied.
    - Sign in as a patient and confirm `/front-desk` shows access denied.
    - Sign out and confirm `/front-desk` redirects to `/login?next=%2Ffront-desk`.
17. Check the front desk request queue (FD-001 PR 3), after re-running the seed:
    - As the front desk account, open **Requests** (`/front-desk/requests`). The seeded
      pending Cami requests are listed by appointment time, each with a request ID,
      patient contact (seed patients have no login or phone, so both read "not
      provided"), specialty, doctor, and the "Pending confirmation" badge.
    - Filter by doctor, by specialty, by an appointment date, and by status
      (Confirmed shows none yet). "Clear filters" returns to the pending list.
    - Book an appointment through `/chat` as a patient with a login, then confirm it
      appears in the queue with that patient's sign-in email.
    - Open a request and confirm the Patient, Appointment, Patient-provided
      information, and Status history sections, with a "Request submitted" entry by
      the patient. No chat transcript is shown.
    - An unknown or non-Cami appointment ID under `/front-desk/requests/` shows the
      not-found page. As a patient, the same URL shows access denied.
18. Check confirm and reject (FD-001 PR 4), after applying 0009 and re-running the seed:
    - As the front desk account, open a pending request whose time is still in the
      future. The Appointment card shows a "Schedule check". Click **Confirm request**,
      then **Confirm appointment**. A toast appears only after the save, the status
      becomes Confirmed, the decision buttons disappear, and Status history gains a
      "Confirmed" entry with your name. In SQL, `confirmed_by_profile_id` and
      `confirmed_at` are set on the row.
    - Open another pending request in two tabs. Confirm it in one, then try to confirm
      or reject it in the other. The dialog shows "This request is no longer pending".
    - Reject a third request with **Other hospital-approved reason** (details are
      required) and confirm the row still exists with `status = 'rejected'` and the
      stored reason, and the history shows "Rejected" with the reason.
    - In the SQL editor, `select public.cammi_connect_reject_appointment('<a pending
      id>', '<staff profile id>', '  ');` fails with `reason_required`, and calling
      confirm on a rejected id fails with `not_pending`.
    - Confirming a seeded request whose time has passed fails with "The requested time
      has already passed".
    - As the doctor, a pending appointment in `/doctor` shows "Awaiting front desk
      confirmation" and no Confirm button.
    - As the patient who booked through `/chat`, the confirmed or rejected status shows
      in their appointments.

19. Check the daily schedule and attendance (FD-001 PR 5), after applying 0010 and
    re-running the seed:
    - As the front desk account, open **Daily schedule** (`/front-desk/schedule`). Today's
      appointments from every booking source are listed with a "Booked via" badge. The
      doctor, status, and patient-name filters narrow the list, and a different date
      shows that day.
    - On a confirmed appointment today, click **Check in**. A toast appears after the
      save, the status becomes Checked in, and only **Mark completed** remains. Open the
      appointment (**View**): Status history shows "Checked in" with your name and time.
      Non-Cami appointments open too, under the "Daily schedule" breadcrumb.
    - Click **Mark no-show** on another confirmed appointment today, then **Confirm
      no-show**. The status becomes No-show and the history records it.
    - Tomorrow's confirmed appointments show no attendance buttons.
    - In the SQL editor, `select public.cammi_connect_record_attendance('<tomorrow
      confirmed id>', '<staff profile id>', 'checked_in');` fails with `not_yet`;
      calling it with `'checked_in'` on a completed id fails with `invalid_transition`;
      calling it with `'cancelled'` fails with `invalid_status`. Each successful call
      adds one `appointment_audit_logs` row with `actor_profile_id` set to the staff id.
    - As the doctor, a checked-in appointment in `/doctor` offers **Mark completed**,
      and completing it adds a "Completed" history entry.

20. Check reschedule and cancel (FD-001 PR 6), after applying 0011 and re-running the
    seed:
    - As the front desk account, open a confirmed future appointment and click
      **Reschedule**. Pick a date the doctor works. Only free slots are listed, and the
      current time is not one of them. Choose a slot and **Patient request**, then
      **Reschedule appointment**. A toast appears after the save, you return to the
      details, the time is updated, the status is still Confirmed, and Status history
      shows "Moved from … to …" with the reason and your name. In SQL, the new
      `appointment_audit_logs` row has `previous_values` and `new_values` holding the old
      and new `scheduled_at`, and the appointment's `rescheduled_from_at` is the old time.
    - Open the reschedule page for an appointment in two tabs on the same date. Move one
      appointment into a slot in the first tab, then pick the same slot for a different
      appointment of the same doctor in the second tab. It fails with "That slot was just
      taken" and that appointment keeps its time (no new audit row).
    - In the SQL editor, `select public.cammi_connect_reschedule_appointment('<confirmed
      id>', '<staff profile id>', '<a time off the slot grid, e.g. :07 past the hour>',
      'Test');` fails with `outside_hours`, and passing the current time fails with
      `unchanged`.
    - Cancel a confirmed appointment with **Other hospital-approved reason** (details are
      required). The status becomes Cancelled, the row keeps `cancellation_reason` and
      `cancelled_by_role = 'front_desk'`, and the history shows "Cancelled" with the
      reason. The slot becomes free again on the reschedule page of another appointment.
    - `select public.cammi_connect_cancel_appointment('<completed id>', '<staff profile
      id>', 'Test');` fails with `not_cancellable`, and a blank reason fails with
      `reason_required`. A completed appointment's details page shows neither
      **Reschedule** nor **Cancel appointment**.
    - As the doctor, the rescheduled appointment shows its new time in `/doctor`, and
      the cancelled one shows Cancelled.

21. Check staff-assisted booking (FD-001 PR 7), after applying 0012. Use synthetic data
    only:
    - As the front desk account, open **New appointment** and search for "Test Walkin".
      No match is found. Register "Test Walkin" with phone `0900 000 0000`. You land on
      step 2 with the patient shown as a walk-in record. In SQL, the new `profiles` row
      has `role = 'patient'`, `auth_user_id` null, and `phone = '09000000000'`.
      Registering another patient with `0900-000-0000` is refused as a duplicate, and
      searching `0900 000` finds Test Walkin.
    - Choose a specialty, a doctor, and a date the doctor works, then **Show slots**.
      Pick a slot, check the review, and **Book and confirm**. You land on the
      appointment details: status Confirmed, booking source Front desk, and one history
      entry with your name. In SQL, the row has `patient_id` = Test Walkin,
      `created_by_profile_id` = `confirmed_by_profile_id` = your staff profile (not the
      patient), `confirmed_at` set, and `specialty_id` set; there is exactly one
      `created` audit row with `new_status = 'confirmed'`.
    - The booked slot no longer appears for that doctor and date. Open the slot list in
      two tabs, book a slot in the first, then book the same slot in the second: it fails
      with "That slot was just taken" and no second row or audit row is written.
    - In SQL, calling the function with a doctor's profile id as the patient fails with
      `invalid_patient`; a specialty the doctor lacks fails with `specialty_mismatch`;
      a time off the slot grid fails with `outside_hours`.
    - `insert into public.appointments (..., status, booking_source) values (...,
      'confirmed', 'ai_chatbot')` still fails with `ai_requires_confirmation`.
    - As the doctor, the new appointment appears as Confirmed in `/doctor`.

22. Check the dashboard overview (FD-001 PR 8). No migration is needed. Use synthetic data
    only:
    - As the front desk account, open **Overview** and note the four cards. Pending
      equals the number of rows with `status = 'requested'`. Confirm one pending
      request: Pending drops by one, Confirmed today rises by one, and the request tops
      **Recently confirmed**. Book a walk-in appointment (step 21): Confirmed today rises
      again.
    - Cancel a confirmed appointment and reject a pending one: Cancelled today rises by
      one (rejections are not counted there), and both top **Recently rejected or
      cancelled** with their reasons. Mark a checked-in visit completed on the daily
      schedule: Completed today rises by one.
    - Manila day boundary: in SQL, `select count(*) from public.appointments where
      confirmed_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone
      'Asia/Manila') and confirmed_at < (date_trunc('day', now() at time zone
      'Asia/Manila') at time zone 'Asia/Manila') + interval '1 day';` equals Confirmed
      today. Between 00:00 and 08:00 Manila time (still the previous UTC day), an action
      taken after Manila midnight counts and one from before it does not.
    - **Today's schedule** lists today's appointments (first 8) and links to the daily
      schedule. **Pending requests** lists the soonest five.
    - Search "Test Walkin" and then `0900 000`: both list that patient's appointments,
      newest first, each linking to its details. A one-character search shows a
      validation message; a doctor's or staff member's name finds nothing.

23. Check the admin foundation (ADM-00), after applying 0013. Use synthetic data only:
    - As the admin account, open `/admin`: the sidebar lists 13 sections and each one
      loads. Doctors, Departments, Specialties, and Schedules still save; the rest show
      "Not built yet".
    - As a patient, open `/admin/users`: access is denied. Signed out, you are sent to
      `/login?next=%2Fadmin%2Fusers`.
    - In SQL, set `is_active = false` on a synthetic doctor profile that has a login.
      Signed in as that doctor, `/doctor` shows access denied. Set it back to `true`.
    - In SQL, insert one `audit_logs` row for the admin profile, then try `update` and
      `delete` on it: both fail with `audit_log_immutable`. (The test row stays; it is
      synthetic.)

24. Check user and role management (ADM-01), after applying 0014, updating the email
    templates, and re-running `npm run db:seed`. Use synthetic data and a mailbox you
    control only:
    - As the admin, open **Users**: the seed accounts are listed with email, role,
      status, and last sign-in. Search by part of a name and of an email; filter by role
      and by status.
    - **Invite staff** with a synthetic front desk email. You land on the new account:
      role Front desk, Active, activity "Account created". Open the email link: it goes
      through `/auth/confirm` to **Set your password**; after saving you land on
      `/front-desk`.
    - Change that account's role to Patient with a reason: activity shows "Role changed"
      and the reason. In SQL, the `audit_logs` row has `action = 'user.role_change'` and
      the previous and new role.
    - On your own account, the role and status forms are not offered. In SQL, calling
      `cammi_connect_admin_set_user_role` with your profile as both actor and target
      fails with `self_change`; with a non-admin actor it fails with `not_admin`.
    - On the seed doctor, the role form points to Doctors; in SQL the function fails
      with `doctor_record`.
    - In SQL, `update public.profiles set role = 'admin' where id = '<any id>'` fails
      with `role_change_forbidden`.
    - Deactivate the invited account with a reason while it is signed in elsewhere: its
      next page load shows access denied, and signing in again fails. Activate it again:
      sign-in works.
    - **Send password reset email**: the email arrives, its link opens **Set your
      password**, and the activity shows "Password reset email sent".
    - Link a patient account as a doctor from **Doctors** (existing flow): it still
      works, because `cammi_connect_save_doctor` sets the role-change flag.

25. Check department management (ADM-02), after applying 0015. Use synthetic data only:
    - As the admin, open **Departments**: each department shows its code, status,
      doctor count, and appointments from the last 30 days.
    - **New department** "Test Ward" with code `tw`: you land on its page with code
      `TW`. Creating "test ward" again is refused as a duplicate. Edit its description:
      it saves. In SQL, `audit_logs` has `department.create` and `department.update`.
    - Open Internal Medicine (the seed doctor's department, which has future
      appointments) and **Deactivate department**: it is refused and lists the upcoming
      requested and confirmed appointments with their doctor; nothing changes.
    - Deactivate "Test Ward" (no appointments): it shows Inactive, `department.deactivate`
      is logged, and Cami's department list in `/chat` no longer offers it. Doctors in
      it keep their `department_id`. Activate it again.
    - In SQL, calling `cammi_connect_admin_set_department_active` with a non-admin actor
      fails with `not_admin`.

26. Check specialty management (ADM-03), after applying 0016. Use synthetic data only:
    - As the admin, open **Specialties**: each specialty shows its status and doctor
      count. Open Internal Medicine: the seed doctors who have it are listed.
    - **New specialty** "Test Specialty": you land on its page. Creating "test specialty"
      again is refused as a duplicate. Edit its description: it saves. In SQL,
      `audit_logs` has `specialty.create` and `specialty.update`.
    - Deactivate a specialty a seed doctor has: it shows Inactive and
      `specialty.deactivate` is logged; Cami no longer offers it in `/chat`, and the
      doctor still lists it under Doctors. Activate it again.
    - In SQL, calling `cammi_connect_admin_set_specialty_active` with a non-admin actor
      fails with `not_admin`.

27. Check doctor management (ADM-04), after applying 0017. Use synthetic data only:
    - As the admin, open **Doctors**: each seed doctor shows department, specialty
      chips, status, and sign-in. Filter by department, specialty, and status.
    - **New doctor** "Dr. Test Doctor" in an active department with two specialties and
      no linked account: you land on its page. In `/chat`, Cami offers the doctor when
      booking by either specialty, and the front desk booking form lists them. In SQL,
      `audit_logs` has `doctor.create` and `doctor.specialties_change`.
    - Edit the department, contact email, and bio: they save, and `doctor.update` is
      logged. Unticking every specialty is refused.
    - At **Users**, invite a synthetic doctor account. On Dr. Test Doctor's page, the
      Account card offers it: link it. `doctor.link_account` is logged; sign in as that
      account and `/doctor` shows Dr. Test Doctor's dashboard. In SQL, linking a patient
      profile with `cammi_connect_admin_link_doctor_account` fails with `not_linkable`.
    - Book a future appointment with the doctor, then **Deactivate doctor**: it is
      refused and the appointment is listed. Cancel it at the front desk, deactivate
      again: it succeeds, Cami and front desk booking no longer offer the doctor, and the
      **Appointments** tab still shows the cancelled appointment.
    - In SQL, calling `cammi_connect_admin_set_doctor_active` with a non-admin actor fails
      with `not_admin`, and `cammi_connect_admin_set_doctor_specialties` with an inactive
      specialty fails with `inactive_specialty` and leaves the doctor's set unchanged.

28. Check weekly schedules (ADM-05), after applying 0018. Use synthetic data only:
    - As the admin, open **Schedules**: every doctor is listed with the weekly hours in
      effect today. Filter by department.
    - On a doctor's page, open the **Schedule** tab. Add Monday 08:00–12:00 and
      13:00–17:00 at 30 minutes: the weekly overview shows both blocks, and Cami or the
      front desk offers 16 slots on an open Monday. `audit_logs` has two
      `schedule.create` rows.
    - Book a Monday 09:00 appointment, then change the morning period to start at 10:00:
      the save is refused and the appointment is listed. End-date the morning period
      instead and add a new one from the day after: both save (`schedule.update`,
      `schedule.create`). Untick **Active** on a period with no bookings:
      `schedule.deactivate` is logged.
    - As that doctor at `/doctor`, the same shortening is refused with the same list.
    - In SQL, calling `cammi_connect_save_schedule_period` with another doctor's profile
      as the actor fails with `not_authorized`.

29. Check schedule exceptions and holidays (ADM-06), after applying 0019 then 0020. Use
    synthetic data only:
    - Book a Friday 09:00 appointment for a doctor. On that doctor's **Schedules** page,
      add leave for that Friday: the save is refused and the appointment is listed;
      nothing is written. Cancel the appointment at the front desk, add the leave again:
      it saves, and Cami and the front desk offer no Friday slots for that doctor.
      `audit_logs` has a `schedule_exception.create` row.
    - As that doctor at `/doctor`, the type list has no **Hospital holiday** and the same
      refusal applies to their own exceptions.
    - As the admin, open **Schedules → Hospital holidays** and add a whole-day holiday on
      a date with a booking: it is refused and the list names the doctor. On a free
      date it saves; no doctor is offered slots that day, and each doctor's exception
      list shows it as "Applies to all doctors" with no Remove button. Remove it from the
      holidays page: `schedule_exception.delete` is logged with the old values.
    - In SQL, calling `cammi_connect_add_schedule_exception` with a doctor actor and a
      null doctor fails with `not_authorized`; calling it with type `holiday` and a
      doctor id fails with `invalid_type`; inserting a holiday-covered slot through
      `cammi_connect_book_appointment` raises `blocked`.
    - For the double-booking guard, run step 14's concurrency check again: of two
      parallel bookings of the same slot, exactly one succeeds.

30. Check hospital services (ADM-07), after applying 0021. Use synthetic data only:
    - As the admin, open **Services**: the list is empty at first. **New service**
      "X-ray" in Radiology (or any active department), access Walk-in: you land on its
      page. Creating "x-ray" again is refused as a duplicate. In SQL, `audit_logs` has
      `service.create`.
    - Edit the description, tick **Requires an appointment**, and save:
      `service.update` is logged with the old and new values. The detail page shows the
      Requirements placeholder and a disabled **Publish to Cami AI** button.
    - Filter the list by department and by status. Deactivate the service: it shows
      Inactive and `service.deactivate` is logged. Activate it again.
    - Deactivate the service's department at **Departments**, then edit the service: it
      still saves with that department, while choosing that department for a new
      service is refused (`inactive_department`). Reactivate the department.
    - Sign in as a non-admin and open `/admin/services`: access is denied. In SQL,
      calling `cammi_connect_admin_set_service_active` with a non-admin actor fails with
      `not_admin`.

31. Check appointment requirements (ADM-08), after applying 0022. Use synthetic data only:
    - As the admin, open a service (for example "X-ray") and choose **Add requirement**:
      "Applies to" is preselected. Create "Valid ID" as a mandatory draft from today. You
      land on its page; `audit_logs` has `requirement.create`. Edit the description and
      save: `requirement.update` is logged.
    - **Publish** it: the status shows Published and In effect, the form becomes
      read-only, and `requirement.publish` is logged. In SQL, calling
      `cammi_connect_admin_save_requirement` for it fails with `not_draft`.
    - **Supersede** it from a date after today: you land on a new draft with the same
      wording starting that day. The original stays published with `effective_to` set to
      the day before and `superseded_by` pointing at the draft; `audit_logs` has a
      `requirement.update` for the original and a `requirement.create` for the copy.
      Superseding the original again is refused. Superseding with a start date on or
      before its `effective_from` is refused (`invalid_date`).
    - **Archive** the new draft: it shows Archived with no actions; `requirement.archive`
      is logged. The original now says the newer version was archived and offers
      **Supersede** again (after 0024); doing so opens another draft and moves
      `superseded_by` to it. The service page lists all of them.
    - Create a requirement for a specialty. At **Requirements**, filter by
      Services/Specialties and by status: requirements are grouped under their service or
      specialty.
    - In SQL, inserting a row with both `service_id` and `specialty_id` (or neither) fails
      the `service_requirements_one_target` check. Sign in as a non-admin and open
      `/admin/requirements`: access is denied.

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
- Patients book through the chat only (AI-APT-001 S3); there is no form-based booking
  page. Patients cancel their own `requested` or `confirmed` appointments in the chat
  (AI-APT-001 S4); there is no cancellation window, and the doctor is not notified.
- If a booking turn fails unexpectedly after Confirm was claimed (provider or database
  outage), the conversation's booking state stays at `booking` and its cards stop
  accepting actions. The patient recovers by typing a new booking request.
- The booking function, its grants, the new constraints, the AI confirmation guard,
  audit-log immutability, and concurrent booking are verified only by the manual
  smoke test above.
- There is no local database for integration or E2E tests yet.

## Local test database (Supabase CLI)

For development testing only; the hosted project stays the real database (ADR-0003).
`supabase/config.toml` uses ports 553xx (DB `postgresql://postgres:postgres@127.0.0.1:55322/postgres`,
API `http://127.0.0.1:55321`) to avoid clashing with other local Supabase projects.

```bash
supabase start                  # needs Docker
scripts/db-local-apply.sh       # drops public schema, applies db/migrations in order
supabase status                 # local URL and keys for a local .env.local
supabase stop
```

## Notification emails: `0046` and `0047`

Run `0046_patient_notification_benefit_types.sql` **on its own** first (it adds enum values),
then `0047_notification_email_outbox.sql`. `0047` adds `emailed_at`/`email_attempts` to
`patient_notifications` and `doctor_notifications`, marks existing rows as already emailed,
and adds patient notifications for front desk PWD and HMO membership decisions.

The trigger-written notification rows are the outbox. After a successful front desk,
payment, benefit, doctor, or patient action (and after every `POST /api/v1/chat`), the app
emails pending rows from the last 24 hours through Nodemailer, after the response is sent.
Each row is claimed before sending, so overlapping runs never send twice; a failed send is
retried up to 3 times. Recipients are the sign-in email of active profiles; walk-in
patients and inactive accounts get none. Emails carry the same fixed text as the bell, plus
a link to `APP_BASE_URL`.

`npm run notifications:send-emails` sends anything still pending (for example pg_cron
payment expiries that no action dispatched) and retries failures. Schedule it every few
minutes in production. It prints counts only.

`SMTP_PASS` is server-only and is scanned for by `npm run check:bundle`.

We use Gmail SMTP: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` the Gmail
address, and `SMTP_PASS` an App Password (needs 2-Step Verification on the account; the
normal password is refused). `MAIL_FROM` must use that address or a verified alias, or
Gmail rewrites it. A personal Gmail account sends about 500 emails a day; Workspace about
2,000.

Smoke test with a test inbox (for example Mailtrap): confirm a request at
`/front-desk/requests` (patient and doctor emails), verify a PWD declaration at
`/front-desk/benefits` (patient email), then run `npm run notifications:send-emails`
(prints `Sent 0, ...` when nothing is left).

## Chat pin and delete: `0045`

`0045_chat_pin.sql` adds `chat_conversations.pinned_at` and recreates the `updated_at`
trigger so it skips updates that change only `pinned_at` (pinning must not reorder the list
or restart the 12-month retention clock). Apply in the Supabase SQL editor before deploying
this code, because the sidebar list selects `pinned_at` (it can run again).

Delete is a hard delete; `chat_messages` rows cascade (`0004`). Smoke test as a patient at
`/chat`: pin a conversation (it moves to the top, others keep their order), unpin it, delete
another one, and delete the open one (you land on a new chat).

## Chat counter payments removed: `0043`

`0043_chat_no_counter_payment.sql` adds a trigger on `payments` that refuses a new
`counter` payment still `awaiting_payment` (PAY-03, D6 reversed). Front-desk and HMO
fallback rows (`collect_at_counter`) are unaffected. Apply in the Supabase SQL editor
(it can run again). Smoke test: a `counter` + `awaiting_payment` insert raises
`counter_payment_not_allowed_in_chat`.

## Patient benefits (BEN-001): `0041` and `0042`

Apply in order after `0040`, in the Supabase SQL editor (each file can run again):

1. `0041_patient_benefits.sql`: the private `benefit-documents` bucket; `patient_pwd`,
   `patient_hmo`, `doctor_hmo_accreditations`, and `appointment_hmo` (RLS on, no policies);
   the submit, front desk decision, admin accreditation, appointment HMO, and document view
   functions. Nothing else changes until 0042.
2. `0042_benefit_booking.sql`: `cammi_connect_resolve_benefit_choice` and the
   `cammi_connect_book_with_saved_hmo` and `cammi_connect_book_service_with_saved_hmo`
   wrappers (they call the existing 0034/0038 booking functions and write `appointment_hmo`
   in the same transaction); the trigger that mirrors the 0037 HMO decision into
   `appointment_hmo`; the backfill of existing HMO charges; and the audited document view
   function.

The app calls only the wrappers, so the PWD and accreditation checks cannot be skipped. The
typed-HMO functions from 0034 and 0038 remain for service_role callers only.

Storage: the bucket is created by `0041`. Keep it private; the app opens documents through
60-second signed links after an audited view (`benefit.document_viewed`).

Smoke test on the hosted project (synthetic data only):

- As a patient, declare PWD (ID number and image) and add an HMO membership at `/account/benefits`. Both show **Waiting for review**.
- As front desk, open `/front-desk/benefits`, view each document, reject one with a reason, then verify the other. Check `/admin/audit-log` for `benefit.*` and `benefit.document_viewed` rows.
- As admin, open `/admin/doctors/[id]`, tab **HMO**, and accredit the doctor for one provider with `active` status. Leave another provider out.
- In chat, book with the verified membership and the accredited doctor: the HMO is offered. Book with the unaccredited doctor: Cami explains why and offers QR Ph. A verified PWD discount is offered only after verification.
- On a request, open **Benefits**: set authorization and coverage separately, add an LOA number, and check that coverage does not change when authorization does.
- Confirm that another patient's document link cannot be opened (`not_found`), and that no membership or ID number appears in any `audit_logs` row's payload.
