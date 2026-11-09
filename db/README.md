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
`db/migrations/0031_patient_booking_cap.sql` once.
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
