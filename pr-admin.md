# CamiConnect — Administrator Module: Implementation Slices

Source: *CAMICONNECT — ADMINISTRATOR MODULE* (Proposed Specification).
Approach: SDD + TDD. Each slice is a vertical, independently shippable unit (migration → RLS → server logic → UI → tests) sized for one focused OpenCode session. Hand the agent **one slice file at a time**, plus this README for context.

## Slice map

| # | Slice | Spec § | Depends on | Size |
|---|---|---|---|---|
| ADM-00 | Foundation: roles, admin guard, shell, audit log | 3, 5.4, 16, 18 | — | M |
| ADM-01 | User & role management | 3.1, 5 | 00 | M |
| ADM-02 | Departments | 6 | 00 | S |
| ADM-03 | Specialties | 7 | 00 | S |
| ADM-04 | Doctors + specialty assignment | 8 | 01, 02, 03 | M |
| ADM-05 | Weekly doctor schedules | 9.1, 9.2, 9.4 | 04 | M |
| ADM-06 | Schedule exceptions + appointment protection | 9.3, 9.4 | 05 | M |
| ADM-07 | Hospital services | 10 | 02 | S |
| ADM-08 | Appointment requirements | 11 | 03, 07 | S |
| ADM-09 | Appointment monitoring (read-only) | 3.4, 12 | 04 | M |
| ADM-10 | Analytics metric layer (SQL + definitions) | 13.1, 13.3, 13.4 | 09 | M |
| ADM-11 | Analytics page: 6 charts, filters, CSV | 13.2, 13.5 | 10 | M |
| ADM-12 | Admin dashboard | 4 | 10 | M |
| ADM-13 | Knowledge documents: CRUD + publishing lifecycle | 14.1, 14.2, 14.4 | 00 | M |
| ADM-14 | Ingestion pipeline: chunk → embed → pgvector | 14.3, 14.4 | 13 | L |
| ADM-15 | System configuration | 15 | 00 | S |
| ADM-16 | Audit log viewer + security/E2E hardening | 16, 18, 20 | all | M |

## Suggested build order

```
ADM-00 ─┬─ ADM-01 ─┐
        ├─ ADM-02 ─┼─ ADM-04 ─┬─ ADM-05 ─ ADM-06
        ├─ ADM-03 ─┘          └─ ADM-09 ─ ADM-10 ─┬─ ADM-11
        │                                         └─ ADM-12
        ├─ ADM-07 ─ ADM-08 (also needs 03)
        ├─ ADM-13 ─ ADM-14
        └─ ADM-15
ADM-16 last
```

Milestones:
1. **Admin can log in and configure the hospital** — 00 → 04
2. **Doctors bookable** — 05, 06 (unblocks patient portal + front desk)
3. **Oversight & analytics** — 09 → 12
4. **Cami AI knowledge** — 13, 14 (can run in parallel with milestone 3)
5. **Config + hardening** — 07, 08, 15, 16

## Rules that apply to every slice

- **Reconcile first.** Before writing a migration, check existing migrations in the repo. Extend existing tables; never create duplicates (spec §17).
- **Server is the authority.** Every mutation goes through a Route Handler or Server Action that (1) authenticates via Supabase Auth, (2) checks role server-side, (3) validates input with a Zod schema, (4) writes, (5) records an audit event. Hiding UI is never the security boundary.
- **RLS on every new table.** Admin-only tables get `select/insert/update` policies gated by `public.is_admin()` (from ADM-00). No `delete` policies on records with history — deactivate instead.
- **Never delete history.** Deactivation = `is_active = false`. Appointments, doctor associations, and audit rows are never removed by normal app operations.
- **Asia/Manila.** Store `timestamptz`; schedule times are `time` interpreted in `Asia/Manila`. Do date bucketing in SQL with `AT TIME ZONE 'Asia/Manila'`.
- **No secrets in the browser.** Service-role key and Gemini/OpenCode keys are server-only (`import 'server-only'`).
- **Tests first.** Each slice lists the tests to write before implementation. Minimum per slice: unit tests for pure logic, RLS tests for each new table (admin allowed / non-admin denied), one E2E happy path.

## Open decisions (resolve before the slice that needs them)

| # | Question | Needed by | Proposed default |
|---|---|---|---|
| D1 | Spec §17 has no general audit table, only `appointment_audit_logs`. | ADM-00 | Add a generic `audit_logs` table for admin events; keep `appointment_audit_logs` for appointment status history. |
| D2 | Role storage: `profiles.role` column vs. separate `user_roles` table vs. JWT custom claim. | ADM-00 | Single `profiles.role` enum + trigger blocking role changes outside a security-definer function. Add JWT claim hook later only if RLS performance needs it. |
| D3 | Can an admin confirm appointments? (§3.4) | ADM-09 | **No** for now. Read-only monitoring. Add as an explicit, audited permission later if the hospital asks. |
| D4 | Dashboard cards: scheduled date or activity date? (§4.1) | ADM-12 | Total/Confirmed/Completed/No-show → **scheduled date**. Pending → **current snapshot**. Cancelled → **cancellation date**. Label each card. |
| D5 | Rate denominators (§13.1) | ADM-10 | See ADM-10 metric definitions table. Get adviser sign-off. |
| D6 | What happens to future confirmed appointments when a doctor/department is deactivated or a schedule exception is added? | ADM-04, ADM-06 | Block the change and list conflicting appointments; front desk must reschedule/cancel first. Never auto-move. |
| D7 | Do structured records (doctors, departments, services, requirements) auto-generate knowledge docs, or does the admin write them manually? | ADM-13 | Manual documents only for v1. Auto-sync from structured tables is a later slice. |
| D8 | Request expiration policy value (§15). | ADM-15 | Store as config; default off until hospital provides the policy. |
| D9 | Service-level scheduling / equipment capacity (§10). | ADM-07 | Out of scope. Services are informational + requirements only. |


---

# ADM-00 — Foundation: Roles, Admin Guard, Shell, Audit Log

**Spec:** §3, §5.2, §5.4, §16, §18 · **Depends on:** — · **Size:** M
**Decisions:** D1, D2

## Goal
Everything later slices need: a trusted role model, a server-side admin gate, the admin layout, and an append-only audit log with a single helper to write to it.

## In scope
- Role enum: `admin`, `front_desk`, `doctor`, `patient`.
- SQL helpers: `public.current_role()` and `public.is_admin()` (stable, security definer, `search_path` pinned).
- Trigger that rejects any change to `profiles.role` unless made through the security-definer function `admin_set_user_role()` (built in ADM-01).
- `audit_logs` table + `public.log_audit(...)` security-definer insert function.
- Server utility `requireRole(...roles)` for Route Handlers / Server Actions → 401 / 403.
- `middleware.ts` redirect for `/admin/**` when unauthenticated (UX only — real check stays in `requireRole`).
- Admin layout shell: sidebar (Dashboard, Appointments, Analytics, Users, Departments, Specialties, Doctors, Schedules, Services, Requirements, Knowledge Base, Settings, Audit Log), top bar with breadcrumb, blue/white design system. Empty placeholder pages.

## Out of scope
Any CRUD screens. Audit viewer UI (ADM-16).

## Data
```sql
-- reconcile with existing profiles migration first
create type app_role as enum ('admin','front_desk','doctor','patient');
alter table profiles add column if not exists role app_role not null default 'patient';
alter table profiles add column if not exists is_active boolean not null default true;

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  action text not null,               -- e.g. 'department.update'
  target_type text not null,          -- e.g. 'department'
  target_id text not null,
  previous_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index on audit_logs (target_type, target_id);
create index on audit_logs (created_at desc);
```
- `audit_logs`: RLS on; `select` for `is_admin()`; **no** insert/update/delete policies. Inserts only via `log_audit()`. `revoke update, delete on audit_logs from authenticated, anon`.
- `log_audit()` strips keys matching `password|token|secret|key` from both jsonb payloads.

## Server
- `lib/auth/require-role.ts` → returns `{ user, profile }` or throws typed `AuthError(401|403)`. Inactive profile → 403.
- `lib/audit/log.ts` → thin wrapper calling `log_audit` RPC; used by every later mutation.
- Supabase clients: `createServerClient` (user session) and `createAdminClient` (service role, `server-only`).

## Tests first
- Unit: `requireRole` → 401 no session, 403 wrong role, 403 inactive, passes for admin.
- Unit: audit redaction strips sensitive keys (nested too).
- RLS: patient/doctor/front_desk `update profiles set role='admin' where id = self` → rejected.
- RLS: non-admin `select from audit_logs` → 0 rows; admin → rows.
- RLS: admin `update/delete audit_logs` → rejected.
- E2E: patient visiting `/admin` → redirected/forbidden; admin sees shell.

## Done when
- No client path can change a role or edit/delete audit rows.
- `/admin/**` pages and `/api/admin/**` handlers all call `requireRole('admin')`.


---

# ADM-01 — User & Role Management

**Spec:** §3.1, §5.1–5.3 · **Depends on:** ADM-00 · **Size:** M

## Goal
Admin can create staff accounts, assign/change roles, activate/deactivate, edit permitted profile fields, and trigger password recovery — without ever seeing a password.

## In scope
- `/admin/users` table: ID, full name, email, role, status, created date, last sign-in (`auth.users.last_sign_in_at` via admin client).
- Search by name/email; filter by role and status; pagination.
- Create staff account (front_desk, doctor, admin): `auth.admin.inviteUserByEmail` → user sets own password. Profile row created with role.
- Change role → `admin_set_user_role(target, new_role, reason)` security-definer function.
- Activate/deactivate → sets `profiles.is_active`; deactivation also bans the auth user (`ban_duration`) so sessions stop working.
- Edit permitted fields: full name, phone. Email change goes through Supabase auth flow.
- "Send password reset" → `auth.resetPasswordForEmail`.
- Per-user activity: last 20 audit events where actor or target = user.

## Out of scope
Patient self-registration (patient portal). Linking a doctor account to a doctor record (ADM-04).

## Guard rails
- Admin cannot demote or deactivate **themselves** (prevents lock-out).
- Cannot demote/deactivate the **last active admin**.
- Patients are not created here; patient role changes are allowed but require a reason.
- Role is never accepted from client body except on the role-change endpoint, which re-checks `is_admin()` inside the SQL function.

## Server
| Action | Audit action |
|---|---|
| `createStaffUser` | `user.create` |
| `setUserRole` | `user.role_change` (prev/new role, reason required) |
| `setUserActive` | `user.activate` / `user.deactivate` |
| `updateUserProfile` | `user.update` |
| `sendPasswordReset` | `user.password_reset_requested` |

## Tests first
- Unit: guard rails (self-demote, last admin) as pure functions.
- Integration: `admin_set_user_role` called by non-admin → error; by admin → role changed + audit row.
- Integration: deactivated user's session gets 403 from `requireRole`.
- Unit: API responses never include password/hash/token fields (schema snapshot).
- E2E: admin invites front desk user → appears in list with `front_desk`, `active`.

## Done when
All §20 "User Management" criteria pass, including "unauthorized users cannot grant themselves administrative privileges."


---

# ADM-02 — Departments

**Spec:** §3.2, §6 · **Depends on:** ADM-00 · **Size:** S

## Goal
CRUD (no delete) for hospital departments with activate/deactivate that preserves history.

## Data
```sql
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index departments_name_ci on departments (lower(name));
```
- `updated_at` trigger (shared `set_updated_at()` function — create once, reuse).
- RLS: `select` for all authenticated (patients need active ones for booking — restrict anon/patient to `is_active = true`); `insert/update` admin only; no delete.

## In scope
- `/admin/departments`: list (name, status, # doctors, # appointments last 30 days), create, edit, activate/deactivate.
- Detail page: description, assigned doctors list, basic appointment stats (count by status, last 30 days). Stats query reused later by ADM-10.

## Rules
- Deactivate is blocked if the department has **future confirmed appointments** → show list (decision D6). Doctors stay linked.
- Duplicate names (case-insensitive) rejected with a friendly error.

## Audit
`department.create`, `department.update`, `department.activate`, `department.deactivate`.

## Tests first
- Unit: Zod schema (name required, ≤100 chars, trimmed).
- RLS: patient sees only active departments; patient insert → denied.
- Integration: deactivate keeps doctor links and historical appointments queryable.
- Integration: deactivate with future confirmed appointment → rejected with conflicting IDs.
- E2E: create → edit → deactivate.


---

# ADM-03 — Medical Specialties

**Spec:** §3.2, §7 · **Depends on:** ADM-00 · **Size:** S

## Goal
Manage specialties independently from departments (different concepts, §7).

## Data
```sql
create table specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index specialties_name_ci on specialties (lower(name));
```
No FK to `departments`. The doctor↔specialty join table ships in ADM-04.
RLS: same pattern as departments.

## In scope
- `/admin/specialties`: list, create, edit, activate/deactivate.
- Detail: doctors with this specialty (empty until ADM-04 — render gracefully).

## Rules
- Deactivated specialty is hidden from patient booking filters but stays on existing doctor profiles and appointments.

## Audit
`specialty.create`, `specialty.update`, `specialty.activate`, `specialty.deactivate`.

## Tests first
- Unit: schema validation; case-insensitive duplicate rejected.
- RLS: patient sees active only; non-admin writes denied.
- E2E: create → deactivate → not in patient specialty list.


---

# ADM-04 — Doctors + Specialty Assignment

**Spec:** §3.2, §8 · **Depends on:** ADM-01, ADM-02, ADM-03 · **Size:** M
**Decisions:** D6

## Goal
Register and maintain doctors, one department each, many specialties, optional link to a `doctor` user account.

## Data
```sql
create table doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id),   -- nullable
  full_name text not null,
  department_id uuid not null references departments(id),
  contact_email text,
  contact_phone text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table doctor_specialties (
  doctor_id uuid references doctors(id),
  specialty_id uuid references specialties(id),
  primary key (doctor_id, specialty_id)
);
```
- RLS `doctors`: public/patient select → active only, and **without** contact fields (expose via a `doctors_public` view). Doctor role → can read own row. Admin → all.
- `user_id` must reference a profile with role `doctor` (check in server action + trigger).

## In scope
- `/admin/doctors`: list with department, specialties (chips), status; filter by department/specialty/status.
- Create/edit form: name, department (active only), multi-select specialties (≥1), contact, bio, optional linked account (dropdown of unlinked `doctor` users).
- Detail page tabs: Profile · Schedule (read-only placeholder until ADM-05) · Appointments (history, read-only).
- Activate/deactivate.

## Rules
- Deactivated doctors disappear from patient booking and Cami AI availability answers; historical appointments remain visible.
- Deactivate blocked while future confirmed appointments exist (D6) — show them.
- Specialty set is replaced atomically in one transaction (RPC `admin_set_doctor_specialties`).

## Audit
`doctor.create`, `doctor.update` (incl. department change), `doctor.specialties_change`, `doctor.link_account`, `doctor.activate`, `doctor.deactivate`.

## Tests first
- Unit: schema (≥1 specialty, valid department).
- Integration: specialty replacement is atomic (fail midway → no partial state).
- Integration: linking a non-doctor user → rejected.
- RLS: patient reading `doctors` cannot see contact fields; sees active only.
- RLS: doctor A cannot update doctor B.
- E2E: register doctor with 2 specialties → visible in booking options; deactivate → gone from booking, history intact.


---

# ADM-05 — Weekly Doctor Schedules

**Spec:** §3.3, §9.1, §9.2, §9.4 · **Depends on:** ADM-04 · **Size:** M

## Goal
Recurring weekly consultation periods per doctor, with fixed slot duration, effective dates, and overlap detection. Backend computes availability.

## Data
```sql
create table doctor_weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Sun
  start_time time not null,
  end_time time not null check (end_time > start_time),
  slot_minutes smallint not null check (slot_minutes between 5 and 240),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- Overlap guard in DB (exclusion constraint or trigger): same doctor, same weekday, overlapping time range **and** overlapping effective-date range, both active → reject.
- `(end_time - start_time)` must be a multiple of `slot_minutes` (or document that the trailing remainder is unused).

## Server
- `getAvailableSlots(doctorId, date)` SQL function (Asia/Manila): weekly periods effective on that date → slots → minus exceptions (ADM-06) → minus booked appointments (`pending_confirmation`, `confirmed`, `checked_in`). Patient portal and Cami AI call this; never compute on client.
- Edits that would remove slots holding existing confirmed/pending appointments → **rejected** with the affected appointments. Preferred edit pattern: end-date the old period, create a new one.

## In scope
- Doctor detail → Schedule tab: weekly calendar grid (Mon–Sun columns), periods as blocks.
- Add/edit period form; multiple periods per day allowed.
- `/admin/schedules` overview: all doctors' weeks, filter by department.
- Conflict panel listing overlapping configs if any slipped in from legacy data.

## Audit
`schedule.create`, `schedule.update`, `schedule.deactivate`.

## Tests first
- Unit: slot generation (08:00–12:00 @ 30 min → 8 slots; DST-free Manila; boundary at end_time exclusive).
- Unit: overlap detection matrix (touching edges OK, overlap rejected, different effective ranges OK).
- Integration: DB constraint rejects overlap even when server check is bypassed.
- Integration: edit that orphans a confirmed appointment → rejected.
- Integration: `getAvailableSlots` excludes booked slots.
- E2E: configure Mon 8–12 and Mon 13–17 @ 30 min → patient sees 16 Monday slots.


---

# ADM-06 — Schedule Exceptions + Appointment Protection

**Spec:** §9.3, §9.4 · **Depends on:** ADM-05 · **Size:** M
**Decisions:** D6

## Goal
Leave, holidays, blocked hours, one-time changes that override weekly availability — without silently moving or cancelling appointments. Plus DB-level double-booking protection.

## Data
```sql
create type schedule_exception_type as enum ('leave','holiday','blocked','temporary_unavailable','one_time_change');
create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors(id),        -- null = hospital-wide (holiday)
  type schedule_exception_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  -- one_time_change only: replacement availability
  replacement_start time, replacement_end time, replacement_slot_minutes smallint,
  reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
```
- **Double-booking guard** on `appointments` (reconcile with existing table): exclusion constraint `using gist (doctor_id with =, tstzrange(scheduled_start, scheduled_end) with &&) where status in ('pending_confirmation','confirmed','checked_in')`. Requires `btree_gist`.

## Rules
- Exceptions override weekly schedule in `getAvailableSlots`.
- Creating an exception that covers existing pending/confirmed appointments: **save is blocked** until resolved, *or* admin explicitly saves with "notify front desk" → appointments are flagged `needs_reschedule` for the front desk queue. Never auto-cancel/move. (Pick one per D6; default = block.)
- Hospital-wide holidays apply to all doctors.

## In scope
- Doctor Schedule tab: exceptions list + overlay on calendar.
- `/admin/schedules/exceptions`: hospital holidays.
- Impact preview before save: "This affects N appointments" with list.

## Audit
`schedule_exception.create`, `schedule_exception.update`, `schedule_exception.delete` (exceptions may be removed; the audit row keeps it).

## Tests first
- Unit: availability = weekly − exceptions (+ one-time replacement).
- Integration: two concurrent inserts for same doctor/slot → exactly one succeeds (run in parallel transactions).
- Integration: exception over a confirmed appointment → blocked, appointment unchanged.
- Integration: holiday (doctor_id null) removes slots for all doctors.
- E2E: add leave for Friday → Friday slots gone for patient.


---

# ADM-07 — Hospital Services

**Spec:** §3.2, §10 · **Depends on:** ADM-02 · **Size:** S
**Decisions:** D9

## Goal
Maintain hospital services (consultation, lab, X-ray, …) that patients ask Cami AI about. Informational + requirements only — **not** forced into the doctor scheduling model.

## Data
```sql
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  department_id uuid references departments(id),
  requires_appointment boolean not null default false,
  booking_mode text not null default 'none'
    check (booking_mode in ('none','doctor_consultation','walk_in')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index services_name_ci on services (lower(name));
```
- `booking_mode` documents how the service is accessed; equipment/capacity scheduling is out of scope (D9).
- RLS: public/patient select active; admin write.

## In scope
- `/admin/services`: list, create, edit, activate/deactivate, department filter.
- Service detail shows linked requirements (filled by ADM-08).
- "Publish to Cami AI" hook: placeholder button that creates/updates a knowledge doc draft (wired in ADM-13; keep disabled until then).

## Audit
`service.create`, `service.update`, `service.activate`, `service.deactivate`.

## Tests first
- Unit: schema; booking_mode enum.
- RLS: patient sees active only; writes denied.
- E2E: create "X-ray" under Radiology → visible in patient services list.


---

# ADM-08 — Appointment Requirements

**Spec:** §3.2, §11 · **Depends on:** ADM-03, ADM-07 · **Size:** S

## Goal
Official, versioned requirements (valid ID, referral, previous records…) attached to services or specialties, which Cami AI may quote only when published.

## Data
```sql
create table service_requirements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  service_id uuid references services(id),
  specialty_id uuid references specialties(id),
  is_mandatory boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (service_id is not null or specialty_id is not null)
);
```
- RLS: patient/anon select only `status='published'` and effective today; admin full.

## Rules
- Policy change = end-date the old requirement + create a new one (keeps history for past appointments).
- Publishing makes it eligible for the knowledge base (ADM-13/14 picks up published requirements).
- This table says what's required; it never records whether a patient fulfilled it — that stays with front desk.

## In scope
- `/admin/requirements`: list grouped by service/specialty, filter by status.
- Create/edit, publish, archive, "supersede" action (end-date + clone).

## Audit
`requirement.create`, `requirement.update`, `requirement.publish`, `requirement.archive`.

## Tests first
- Unit: "currently effective" predicate (date boundaries, null effective_to).
- RLS: draft/archived/expired not visible to patient.
- Integration: supersede leaves old row intact with `effective_to` set.
- E2E: publish "Valid ID" for General Consultation → patient service page lists it.


---

# ADM-09 — Appointment Monitoring (Read-only)

**Spec:** §3.4, §12 · **Depends on:** ADM-04 · **Size:** M
**Decisions:** D3

## Goal
System-wide, read-only oversight of appointments with full status history. Admin does **not** confirm/reject here (front desk owns that).

## Data (reconcile — likely exists from patient/front-desk modules)
Ensure `appointments` has: `id, patient_id, doctor_id?, department_id, specialty_id?, service_id?, scheduled_start, scheduled_end, status, booking_source ('chatbot'|'portal'|'walk_in'|'front_desk'), created_by, confirmed_by, confirmed_at, cancelled_at, no_show_at, completed_at, created_at, updated_at`.
Ensure `appointment_audit_logs`: `id, appointment_id, actor_user_id, from_status, to_status, reason, created_at`, written by a trigger on status change (so no code path can skip it).

Add `cancelled_at`/`no_show_at`/`completed_at` if missing — ADM-10 depends on them.

## In scope
- `/admin/appointments`: server-paginated table — ID, patient, doctor, dept/specialty, service, scheduled date/time (Manila), status badge, source, created by, confirmed by.
- Search by patient name; filters: doctor, department, status (multi), source, scheduled date range. Filters in URL query params (shareable, used by dashboard deep links).
- Detail drawer/page: all fields + status timeline from `appointment_audit_logs` (who, when, from→to, reason).
- "Conflicts" view: appointments overlapping for the same doctor (legacy data) or flagged `needs_reschedule` (ADM-06).

## Out of scope
Any status change action (D3).

## Privacy
Show only patient name + patient ID in list; contact details only in detail view. No clinical notes.

## Tests first
- Integration: status change via any path inserts an `appointment_audit_logs` row (trigger).
- Integration: filter combinations return correct sets (seeded fixtures).
- RLS: front desk/doctor/patient hitting admin endpoint → 403; doctor reading another doctor's appointments via table → 0 rows.
- E2E: filter by doctor + status=confirmed → open detail → timeline shows "confirmed by <staff>".

## Done when
§20 "Appointment Monitoring" passes, incl. identifying the staff member who confirmed.

## Status as built (2026-11-05)
- Built: `/admin/appointments` list + `/admin/appointments/[id]` detail page (not a drawer), read-only. No service column: appointments have no `service_id` (D9).
- No migration. Audit rows stay written by each writer (SQL functions 0007–0012/0020 and the TS transition repository), not a trigger; `tests/unit/appointments/audit-coverage.test.ts` fails if a new writer skips the audit insert.
- `cancelled_at`/`no_show_at`/`completed_at` deferred to ADM-10 (add columns or derive from `appointment_audit_logs`).
- Conflicts view dropped: `appointments_no_active_overlap` forbids active overlaps and ADM-06 refuses exceptions over booked appointments, so there is no `needs_reschedule` flag.
- RLS tests: N/A by design (ADR-0003, service-role only, anon/authenticated revoked); authorization is `getAdminSession()`, covered by page tests. E2E not run (Playwright not installed).


---

# ADM-10 — Analytics Metric Layer

**Spec:** §13.1, §13.3, §13.4 · **Depends on:** ADM-09 · **Size:** M
**Decisions:** D5

## Goal
One tested SQL layer that defines every number shown in the dashboard and analytics pages. UI slices (ADM-11, ADM-12) only render what this layer returns.

## Metric definitions (proposed — get adviser sign-off, then freeze in `docs/analytics-definitions.md`)

Period filter `[from, to)` is in Asia/Manila. Unless stated, cohort = appointments whose **scheduled_start** falls in the period.

| Metric | Numerator | Denominator / cohort |
|---|---|---|
| Total Appointments | count, status ≠ `rejected` | scheduled in period |
| Due cohort | — | scheduled in period, `scheduled_end < now()`, status ∈ {`confirmed`,`checked_in`,`completed`,`no_show`,`cancelled`} and was ever `confirmed` |
| Completion Rate | `completed` | due cohort |
| No-Show Rate | `no_show` | due cohort |
| Cancellation Rate | `cancelled` after being confirmed | due cohort |
| Pending | status = `pending_confirmation` now | snapshot (not period-based) |

Rules baked in (§13.4): pending is never counted as completed; rejected requests excluded from rates; creation date ≠ scheduled date (expose both via a `date_basis` param where useful); rates return `null` (not 0) when denominator = 0; no notification data.

## Deliverables
- SQL view `analytics_appointments` — one row per appointment with derived fields: `sched_date_mnl`, `sched_month`, `weekday`, `hour_bucket` (e.g. 08–10, 10–12…), `was_confirmed`, `is_due`.
- Security-definer functions (admin-only check inside), all taking `(from, to, doctor_id?, department_id?)`:
  - `analytics_kpis()`
  - `analytics_monthly_volume()`
  - `analytics_by_doctor()` (count + cancel/no-show rates)
  - `analytics_heatmap()` (weekday × hour_bucket counts)
  - `analytics_status_by_month()`
  - `analytics_rates_by_slot()` (weekday × time bucket rates)
- TS types generated for each return shape.

## Tests first (the most important tests in the module)
Seed a fixed fixture set (~40 appointments, known statuses/dates) and assert exact outputs:
- KPI values and rates to 2 decimals.
- Denominator 0 → `null`.
- Appointment scheduled 23:30 Manila on the 31st lands in that month (timezone boundary).
- Pending and rejected never affect completion rate.
- Filters: doctor and department narrow correctly; outside-period rows excluded.
- Non-admin calling any function → error.

## Done when
Every chart/KPI in ADM-11/12 can be served from these functions with no math in React.

## Status as built (2026-11-05)
- Metric math lives in TypeScript (`src/lib/analytics/metrics.ts`), not SQL functions: there is no local DB, so SQL math could not be unit-tested (same precedent as `generateAvailableSlots`). No migration and no view.
- `src/server/analytics/` holds the read-only repository (paged past PostgREST's 1000-row cap) and `loadAnalytics`, which computes every dataset from one read. Callers must pass `getAdminSession()`; the non-admin test moves to the ADM-11 page.
- Definitions frozen in `docs/analytics-definitions.md` with the real status names (`requested` = pending). `cancelled_at`/`completed_at`/`no_show_at` columns are not added: confirmation and cancellation dates come from `confirmed_at` and `appointment_audit_logs`.


---

# ADM-11 — Analytics Page: Charts, Filters, CSV

**Spec:** §3.5, §13.2, §13.5 · **Depends on:** ADM-10 · **Size:** M

## Goal
`/admin/analytics` with 4 KPIs, 6 charts, shared filters, CSV export.

## Layout
- Filter bar (URL-synced): date range presets (this month, last 3 months, last 12 months, custom), doctor, department.
- KPI row: Total · Completion Rate · Cancellation Rate · No-Show Rate. Each shows a tooltip with its exact definition from ADM-10.
- Charts:

| # | Chart | Type | Source fn |
|---|---|---|---|
| 1 | Monthly Appointment Volume | Line | `analytics_monthly_volume` |
| 2 | Appointments per Doctor | Horizontal bar (sorted desc) | `analytics_by_doctor` |
| 3 | Peak Days & Times | Heatmap (weekday × time bucket) | `analytics_heatmap` |
| 4 | Status by Month | Stacked bar: completed / cancelled / no-show (toggle to add pending/confirmed) | `analytics_status_by_month` |
| 5 | Cancel & No-Show by Day/Time | Grouped bar | `analytics_rates_by_slot` |
| 6 | Cancel & No-Show by Doctor | Grouped bar | `analytics_by_doctor` |

- Each chart: title, one-line "what this shows", empty state, small-sample note when n < 10 ("rates based on few appointments").
- Footer disclaimer: "Patterns show association, not cause." (§13.4)

## CSV export
- Route Handler `GET /api/admin/analytics/export?dataset=<kpis|monthly|doctor|heatmap|status|slots>&from&to&doctor&department` → `requireRole('admin')` → CSV from the same function. No patient identifiers in any dataset.
- Audit: `analytics.export` with filters.

## Tech
Charts library consistent with the rest of the app (e.g. Recharts); blue/white palette; heatmap uses a single-hue sequential scale. Server Components fetch; client components only for interactivity.

## Tests first
- Unit: filter ↔ URL param serialization.
- Unit: CSV serializer (escaping commas/quotes, header row, Manila dates).
- Integration: export endpoint 403 for non-admin; CSV rows match function output.
- E2E: change department filter → all KPIs and charts update; export downloads file.

## Status as built (2026-11-05)
- `/admin/analytics`: URL filters (range presets this month / last 3 / last 12 months / custom inclusive dates up to 24 months, doctor, department), 4 KPI cards with definition popovers and a pending snapshot line, 6 charts each with a data table and empty state, footer disclaimer.
- Charts: Recharts 3.10.1, isolated in `src/components/analytics/analytics-charts.tsx`. The heatmap is a tinted HTML table (Recharts has no heatmap). KPI numbers use a trimmed React Bits CountUp (`src/components/ui/count-up.tsx`, MIT + Commons Clause notice kept) on `motion` 12.43.0.
- CSV: `GET /api/admin/analytics/export?dataset=…` with the page's params; formula-injection guard; audited as `analytics.export`; 403 for non-admins.
- E2E not run (Playwright not installed).


---

# ADM-12 — Admin Dashboard

**Spec:** §4 · **Depends on:** ADM-10 (uses ADM-09 links, ADM-00 audit) · **Size:** M
**Decisions:** D4

## Goal
`/admin` landing page: at-a-glance operations overview. Lighter than Analytics; links into it.

## Summary cards (each labelled with its date basis — D4)
| Card | Basis |
|---|---|
| Total Appointments | scheduled date in range |
| Pending Requests | current snapshot |
| Confirmed | scheduled date in range |
| Completed | scheduled date in range |
| Cancelled | cancellation date in range |
| No-Show | scheduled date in range |

Clicking a card → `/admin/appointments` pre-filtered (ADM-09 URL params).

## Sections
1. Appointment activity overview — daily count line for the range.
2. Status distribution — donut/bar of statuses.
3. Trends — sparkline vs previous equal-length period (▲/▼ %).
4. Doctor performance — top 5 doctors by volume + their no-show rate.
5. Recent appointment activity — last 10 entries from `appointment_audit_logs`.
6. Pending overview — count, oldest pending age, by department. (Read-only; "Front desk queue" label.)
7. System activity — last 10 `audit_logs` events.

## Filters
Date range (Today, This week, This month, Custom), department, doctor, status. URL-synced.

## Data
Add to ADM-10 layer if missing: `dashboard_cards()`, `dashboard_daily_activity()`, `dashboard_pending_summary()`. Keep the same definitions — no new math in components.

## Tests first
- Integration: `dashboard_cards` with fixture set → exact numbers; cancelled uses `cancelled_at`.
- Unit: previous-period computation (This week → previous Mon–Sun).
- E2E: admin lands on `/admin`, switches to "Today", clicks Pending card → appointments list filtered to pending.

## Status as built (2026-11-08)
- `/admin`: URL filters (Today / This week / This month / Custom, doctor, department), 6 summary cards labelled with their date basis, daily activity line, status distribution bar, top-5 doctor table, read-only front desk queue, last 10 `appointment_audit_logs` and last 10 `audit_logs` entries.
- No status filter (decided 2026-11-08): each card is already one status, and status narrowing happens on `/admin/appointments` through the card links.
- Math is TypeScript in `src/lib/analytics/` (`dashboardCards`, `dailyVolume`, `statusDistribution`, `trendPercent`, `previousPeriod`), served by `loadDashboard`; no SQL functions and no migration (same precedent as ADM-10). Definitions added to `docs/analytics-definitions.md`.
- Cancelled card counts by cancellation date (the `cancelled` audit row), but its link opens every cancelled appointment without a date filter, because ADM-09 filters by scheduled date. Pending card links without dates (snapshot).
- Trend is shown as ▲/▼ % on the Total card, not a separate sparkline.
- Activity feeds are hospital-wide; the doctor and department filters do not narrow them.
- E2E not run (Playwright not installed).


---

# ADM-13 — Knowledge Documents: CRUD + Publishing Lifecycle

**Spec:** §3.6, §14.1, §14.2, §14.4 · **Depends on:** ADM-00 · **Size:** M
**Decisions:** D7

## Goal
Admin authors hospital-approved documents for Cami AI with a strict draft → published → archived lifecycle. Embedding happens in ADM-14; this slice owns the records and states.

## Data
```sql
create type kb_category as enum ('hospital_info','departments','specialties','doctor_profiles',
  'services','appointment_requirements','appointment_procedures','other_patient_info');
create type kb_status as enum ('draft','published','archived');
create type kb_processing as enum ('pending','processing','ready','failed');

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category kb_category not null,
  content text not null,               -- markdown/plain text
  source_file_path text,               -- optional Supabase Storage upload
  status kb_status not null default 'draft',
  processing_status kb_processing not null default 'pending',
  processing_error text,
  content_hash text not null,          -- sha256 of normalized content
  version int not null default 1,
  published_at timestamptz, published_by uuid references auth.users(id),
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- RLS: admin only (Cami AI reads via server-side retrieval function in ADM-14, not this table directly).

## In scope
- `/admin/knowledge`: list with title, category, status, processing status, version, updated; filters.
- Editor: title, category, content (textarea/markdown); optional upload of `.txt`/`.md`/`.pdf` (size ≤ 5 MB, MIME-checked) → text extracted server-side into `content`.
- Actions: Save draft · Publish · Archive · Reprocess (enabled in ADM-14).
- Editing a published doc → bumps `version`, sets `processing_status='pending'`; previous embeddings stay active until the new ones are ready (no retrieval gap), then are replaced.
- Error panel: failed docs with `processing_error`.

## Rules (§14.4)
- Only `published` + `ready` documents are retrievable.
- Archive is immediate removal from retrieval.
- Every publish/archive/edit is audited with previous/new `content_hash` and version.

## Audit
`knowledge.create`, `knowledge.update`, `knowledge.publish`, `knowledge.archive`, `knowledge.reprocess`.

## Tests first
- Unit: state machine — allowed transitions (draft→published, published→archived, archived→draft…); disallowed → error.
- Unit: content normalization + hash stable across whitespace changes.
- Integration: upload rejects wrong MIME / oversize.
- RLS: non-admin cannot read drafts.
- E2E: create draft → publish → appears with processing "pending".

## Status as built (2026-11-08)
- Route is `/admin/knowledge-base` (list, `/new`, `/[id]`), not `/admin/knowledge`.
- `0025` extends the existing `knowledge_documents` table from `0005` (text `check` constraints, not enums), drops `is_published`, and makes retrieval search only `published` documents.
- RLS: no policies; anon/authenticated have no table access and the audited functions re-check the admin (ADR-0003), like the rest of the module.
- Extra transition archived → draft (Restore), audited as `knowledge.restore`.
- Uploads: `.txt`/`.md`/`.pdf` up to 5 MB, PDF text via `unpdf`; the file itself is not stored, only `source_file_name`.
- `npm run kb:ingest` also writes the corpus files' content and category.
- E2E not run (Playwright not installed).


---

# ADM-14 — Ingestion Pipeline: Chunk → Embed → pgvector

**Spec:** §14.3, §14.4, §18 · **Depends on:** ADM-13 · **Size:** L

## Goal
Turn published documents into retrievable chunks with Gemini embeddings in Supabase pgvector, with visible status, retries, and strict exclusion of draft/archived content.

## Data
```sql
create extension if not exists vector;
create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  document_version int not null,
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding vector(768) not null,      -- gemini-embedding-001 @ 768 dims
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (document_id, document_version, chunk_index)
);
create index on knowledge_chunks using hnsw (embedding vector_cosine_ops);
```
Reconcile with any existing chunks/embeddings table from the Cami AI module — **one** vector table only.

## Pipeline (server-only, `lib/kb/ingest.ts`)
1. Load doc; assert `status='published'`.
2. Set `processing_status='processing'`.
3. Normalize text (strip control chars, collapse whitespace, keep headings).
4. Chunk: ~500–800 tokens, ~80 overlap, split on headings/paragraphs first. Prepend `title + category` to each chunk.
5. Embed with Gemini (`RETRIEVAL_DOCUMENT` task type), batched, retry with backoff on 429/5xx.
6. Insert chunks for new version with `is_active=false`.
7. In one transaction: activate new version's chunks, deactivate/delete old versions' chunks, set `processing_status='ready'`.
8. On any error: `processing_status='failed'`, `processing_error=<safe message>`, old chunks remain active.

Trigger: on publish/update/reprocess, call ingestion from the Server Action (fine at capstone scale). If it exceeds the serverless timeout, move to a Supabase Edge Function or queue — note in README.

## Retrieval contract (consumed by Cami AI)
`match_knowledge(query_embedding vector(768), match_count int, categories kb_category[] default null)` — security definer; joins to `knowledge_documents` and returns **only** `is_active` chunks of `status='published'` docs. Query embeddings use `RETRIEVAL_QUERY` task type. Cami AI never queries tables directly.

## Coverage panel
Per category: # published docs, # ready, # failed, last updated. Flags categories with zero published docs.

## Tests first
- Unit: chunker — boundaries, overlap, no empty chunks, deterministic output.
- Unit: Gemini client mocked — retries on 429, fails cleanly after N.
- Integration: publish → chunks active; edit → old chunks still served until new ready; then replaced.
- Integration: archived doc → `match_knowledge` returns none of its chunks.
- Integration: draft doc never ingested; forced call → error.
- Integration: failed embedding → status `failed`, error visible, prior version still retrievable.
- Security: Gemini key not present in any client bundle (build-output grep test).

## Status as built (2026-11-08)
- Ingestion runs inline in the publish, save, and Reprocess Server Actions (ADR-0004 interim decision); no queue or Edge Function.
- No `is_active` column: the existing `knowledge_chunks` table (0005) stays the one vector table. `cammi_connect_store_knowledge_chunks` (0026) swaps a version's chunks in one transaction after embedding, guarded by status and version (`stale` otherwise), so old chunks serve until then and survive a failure.
- Chunking reuses `chunkMarkdown` (~2,000 chars ≈ 500 tokens, 300-char overlap, split on headings then paragraphs). The embedded text is prefixed with title, category, and section; the stored chunk is not.
- Embedding reuses `embedTexts` (RETRIEVAL_DOCUMENT, 768 dims, retry on 429/5xx/timeouts), in batches of 50.
- Archiving deletes the document's chunks (`0026` redefines the status function), so archived text can't return when a later restore → edit → publish fails to ingest.
- Failures store a fixed message (provider busy, no text, save failed, unexpected), never provider text.
- Retrieval keeps the existing `cammi_connect_match_knowledge_chunks` (published only). The `categories` parameter waits for ADM-15 (`chatbot.enabled_categories`).
- Coverage table on `/admin/knowledge-base`: per category, published, ready, failed, and last updated; flags categories with no published document.
- A title-only edit does not re-embed; use Reprocess.
- Tests: unit tests for ingestion (fakes), coverage, reprocess, actions, and components. No SQL integration tests (no local DB). The bundle key check was a manual grep of `.next/static` after `npm run build`.


---

# ADM-15 — System Configuration

**Spec:** §15 · **Depends on:** ADM-00 · **Size:** S
**Decisions:** D8

## Goal
Admin edits a small, hospital-policy-driven set of settings. No raw model/technical knobs.

## Data
```sql
create table system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
```
Every key has a Zod schema in `lib/settings/schema.ts`; unknown keys rejected. Server reads via `getSetting(key)` (cached, revalidated on save).

## Settings (allow-list)
| Group | Key | Type | Default |
|---|---|---|---|
| Appointment | `appointment.default_slot_minutes` | int 5–240 | 30 |
| | `appointment.request_expiry_hours` | int \| null | null (off) |
| | `appointment.min_lead_hours` | int | 2 |
| | `appointment.max_advance_days` | int | 60 |
| | `appointment.cancellation_policy_text` | string | "" |
| | `appointment.reschedule_policy_text` | string | "" |
| Hospital | `hospital.name`, `.address`, `.contact_phone`, `.contact_email` | string | seeded |
| | `hospital.operating_hours` | `{day, open, close}[]` | seeded |
| | `hospital.timezone` | **read-only** `Asia/Manila` | — |
| Chatbot | `chatbot.enabled` | bool | true |
| | `chatbot.welcome_message` | string ≤ 500 | seeded |
| | `chatbot.enabled_categories` | `kb_category[]` | all |

Explicitly **not** exposed: model name, temperature, system prompt, API keys.

## In scope
- `/admin/settings` with three tabs; per-tab save; diff preview before save.
- Policy text fields can be "Send to knowledge base" → creates a draft knowledge doc (ADM-13).
- `chatbot.enabled=false` → Cami AI shows a maintenance message + front desk contact.

## Audit
`settings.update` with previous/new values per key.

## Tests first
- Unit: each schema (bounds, unknown key rejected).
- Integration: non-admin write → denied; admin write → audit row with diff.
- Integration: `chatbot.enabled_categories` limits `match_knowledge` categories.
- E2E: change welcome message → patient chat shows it.

## Status as built (2026-11-08)
- `0027` adds `system_settings` (no seed rows; a missing key uses its default from `src/lib/settings/schema.ts`) and the audited `cammi_connect_admin_save_settings`. It re-checks the key allow-list, upserts only changed keys, and writes one `settings.update` row with per-key previous/new values (previous `null` = default).
- `/admin/settings` has Appointment, Hospital, and Chatbot tabs (`?tab=`). Each tab saves on its own after a review-changes dialog. The timezone is shown read-only and is not stored.
- No cache: `getSettings` reads the small table once per request; saves revalidate `/admin/settings` and `/chat`.
- `appointment.default_slot_minutes` is limited to 15/30/45/60, not 5–240, because slot lengths stay 15/30/45/60. It sets the default for a new period in the doctor and admin schedule editors.
- `appointment.min_lead_hours` applies to Cami only: the chat availability tool offers slots that start more than N hours from now, and booking re-reads that same tool. Front desk bookings and the SQL booking functions are unchanged.
- `appointment.max_advance_days` replaces the fixed 60-day chat booking horizon.
- `chatbot.enabled = false`: the `/chat` page shows a maintenance message with `hospital.contact_phone`, and `POST /api/v1/chat` refuses with 503 `chat_disabled`. The patient's appointments view under `/chat` is hidden too.
- `chatbot.enabled_categories` is passed to `cammi_connect_match_knowledge_chunks` (new `categories` parameter, `0027`).
- Stored with no effect yet: `appointment.request_expiry_hours` (D8, null = off), hospital name/address/email/operating hours, and the policy texts.
- "Send to knowledge base" creates a draft `appointment_procedures` document from the **saved** policy text through the existing audited knowledge save, then opens it for review.
- Tests: unit tests for the schemas, display, service, actions, knowledge category filter, chat horizon, lead time, and chat switch; component tests for the form, preview, maintenance panel, and welcome message. No SQL integration tests or E2E (no local DB, no Playwright); the `db/README.md` smoke test covers those.


---

# ADM-16 — Audit Log Viewer + Security & E2E Hardening

**Spec:** §16, §18, §19 (Testing), §20, §21 · **Depends on:** all · **Size:** M

## Goal
Make accountability visible and prove the whole module meets the Definition of Done.

## Part A — Audit log viewer
- `/admin/audit`: table of `audit_logs` — time (Manila), actor, action, target type/ID (linked), reason.
- Filters: actor, action prefix (`user.*`, `doctor.*`…), target type, date range.
- Detail: side-by-side previous vs new values (jsonb diff).
- CSV export (admin only, itself audited as `audit.export`).
- Read-only; no edit/delete controls anywhere.

## Part B — Coverage check of required audit events (§16)
Write one integration test per required event asserting a row is produced:
user create · role change · activate/deactivate · doctor change · department change · specialty change · schedule create/update · schedule exception · service change · appointment config change · knowledge publish/archive · admin appointment action (if D3 ever enabled).

## Part C — Security sweep (§18)
- Route inventory test: enumerate every `app/admin/**` page and `app/api/admin/**` handler; assert each calls `requireRole('admin')` (static check or request test with patient session → 403).
- RLS matrix test: for every table, for each role (anon, patient, doctor, front_desk, admin) × (select, insert, update, delete) → expected allow/deny table checked into repo.
- Privilege escalation tests: direct PostgREST `update profiles set role` as each non-admin role → denied.
- Bundle scan: build output contains no `SUPABASE_SERVICE_ROLE_KEY`, Gemini key, or OpenCode key.
- Audit payload scan: no row contains `password`, `token`, `secret` keys.
- Analytics endpoints return no patient identifiers.
- Upload validation: MIME spoofing and oversize rejected.

## Part D — E2E critical paths (Playwright)
1. Admin onboards a doctor: department → specialty → doctor → weekly schedule → patient sees slots.
2. Admin adds leave over a booked slot → blocked with conflict list.
3. Admin publishes knowledge doc → Cami AI answer cites it; archive → no longer cited.
4. Admin views analytics with filters and exports CSV.
5. Patient/front desk/doctor cannot reach any `/admin` page or API.

## Done when
Every checkbox in spec §20 maps to at least one passing test (keep a `docs/acceptance-traceability.md` table: criterion → test file).