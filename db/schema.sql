-- ===========================================================================
-- CamiConnect — whole-database schema (end state)
-- ===========================================================================
--
-- One runnable script that builds the complete CamiConnect database on an
-- EMPTY Supabase project: extensions, enums, tables, constraints, indexes,
-- functions, triggers, row level security, and grants.
--
-- What it contains
--   [built]   exactly what migrations 0001–0018 leave behind (verified by
--             applying both to fresh Supabase Postgres and diffing catalogs).
--   [ADM-xx]  planned by that administrator slice (pr-admin.md / spec-admin.md)
--   [FD-9]    planned by front desk PR 9 (specs/tasks/FD-001-front-desk.md)
--   Planned items are proposals until their migration is written. They are
--   only ADDITIVE here (new tables, new nullable/defaulted columns, new enum
--   values). Planned changes that would replace or tighten a built object
--   are written as "PLANNED CHANGE" comments next to it instead, because the
--   migration that makes them must also rewrite the functions that use the
--   built shape (e.g. knowledge_documents.is_published).
--
-- How to use it
--   * Fresh environment: run this whole file once in the SQL editor of a new,
--     empty Supabase project (it relies on Supabase's auth schema, auth.users,
--     the extensions schema, and the anon/authenticated/service_role roles).
--   * NEVER run it against the hosted database that already has data. It is
--     not a migration. Schema changes still go through a new numbered file in
--     db/migrations/ (AGENTS.md non-negotiable); update this file in the same
--     PR so it stays the whole-DB reference.
--   * Data backfills from the migrations are omitted on purpose. Seed data
--     comes from `npm run db:seed`; knowledge from `npm run kb:ingest`.
--
-- Security model (unchanged from 0001): every table has RLS enabled with no
-- permissive policies, anon/authenticated have no table or function access,
-- and the server uses the service_role client. Application-layer checks in
-- src/server/** are the authorization boundary (see CLAUDE.md).
--
-- Scope follows the Level 1 data flow diagram (stores D1–D7). Deliberately
-- NOT included because the DFD has no store or flow for them:
--   * services, service_requirements (ADM-07/08) and appointments.service_id
--   * system_settings (ADM-15)
--   * ingestion_jobs (SPEC §4.2; job runner still open in ADR-0004)
-- Also not modelled, decision still open: rate-limit records (ADR-0005) and
-- chat_request_metadata (SPEC §6).
--
-- All times are Asia/Manila (stored as timestamptz; schedule times are local).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists btree_gist;                      -- [built] exclusion constraints
create extension if not exists vector with schema extensions;   -- [built] pgvector for RAG

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum (                          -- [built]
  'patient', 'doctor', 'admin', 'front_desk'
);

-- Value order matches the migrated database (0001 + 0006); keep it.
create type public.appointment_status as enum (                 -- [built]
  'requested', 'confirmed', 'completed', 'cancelled', 'no_show', 'rejected', 'checked_in'
);

create type public.booking_source as enum (                     -- [built]
  'ai_chatbot', 'front_desk', 'other'
);

create type public.schedule_exception_type as enum (
  'leave', 'blocked_period', 'unavailable_date', 'temporary_change',  -- [built]
  'holiday'                                                           -- [ADM-06]
);

create type public.doctor_notification_type as enum (           -- [built]
  'new_request', 'cancelled', 'rescheduled', 'reminder'
);

create type public.patient_notification_type as enum (          -- [FD-9]
  'confirmed', 'rejected', 'cancelled', 'rescheduled', 'reminder'
);

create type public.kb_category as enum (                        -- [ADM-13]
  'hospital_info', 'departments', 'specialties', 'doctor_profiles',
  'services', 'appointment_requirements', 'appointment_procedures', 'other_patient_info'
);
create type public.kb_status as enum ('draft', 'published', 'archived');                     -- [ADM-13]
create type public.kb_processing as enum ('pending', 'processing', 'ready', 'failed');       -- [ADM-13]

-- ===========================================================================
-- Tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------

create table public.departments (                               -- [built]
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (btrim(name) <> ''),
  code        text not null unique check (btrim(code) <> ''),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index departments_name_ci_key on public.departments (lower(btrim(name)));
comment on table public.departments is
  'Hospital departments used for doctor assignment and dashboard grouping.';

create table public.specialties (                               -- [built]
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (btrim(name) <> ''),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index specialties_name_ci_key on public.specialties (lower(btrim(name)));
comment on table public.specialties is
  'Managed catalogue of medical specialties. Linked to doctors through doctor_specialties.';

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per person of any role. Walk-in patients and directory-only doctors
-- have auth_user_id = null.
create table public.profiles (                                  -- [built]
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  role          public.user_role not null default 'patient',
  full_name     text not null,
  department_id uuid references public.departments (id) on delete set null,
  specialty     text,          -- legacy free text (0002); no longer read
  phone         text,
  clinic_note   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> '')
);
comment on table public.profiles is
  'Application profile for patients, doctors, and admins. auth_user_id is null for synthetic seed profiles and set for real Supabase Auth users.';
comment on column public.profiles.is_active is
  'False once an admin deactivates the account. Deactivated users cannot use any dashboard; their history is kept.';

-- 1:1 extension of a doctor profile (doctors.id = profiles.id).
create table public.doctors (                                   -- [built]
  id            uuid primary key references public.profiles (id) on delete restrict,
  department_id uuid references public.departments (id) on delete set null,
  full_name     text not null check (btrim(full_name) <> ''),
  is_active     boolean not null default true,
  contact_email text,
  contact_phone text,
  bio           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 0017 adds this as NOT VALID (legacy rows); on a fresh database it is valid.
  constraint doctors_department_required check (department_id is not null),
  constraint doctors_contact_email_length
    check (contact_email is null or char_length(contact_email) <= 254),
  constraint doctors_contact_phone_length
    check (contact_phone is null or char_length(contact_phone) <= 40),
  constraint doctors_bio_length check (bio is null or char_length(bio) <= 1000)
);
create index doctors_department_idx on public.doctors (department_id);
comment on table public.doctors is
  'Doctor directory entry. id is the doctor profile id; the login (if any) is profiles.auth_user_id.';
comment on column public.doctors.contact_email is
  'Admin-managed contact email. Admin pages only; never shown to patients or Cami.';
comment on column public.doctors.contact_phone is
  'Admin-managed contact phone. Admin pages only; never shown to patients or Cami.';

-- M:N doctors <-> specialties.
create table public.doctor_specialties (                        -- [built]
  doctor_id    uuid not null references public.doctors (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id) on delete restrict,
  primary key (doctor_id, specialty_id)
);
create index doctor_specialties_specialty_idx on public.doctor_specialties (specialty_id);

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------

create table public.doctor_schedules (                          -- [built]
  id                    uuid primary key default gen_random_uuid(),
  doctor_id             uuid not null references public.doctors (id) on delete cascade,
  day_of_week           smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time            time not null,
  end_time              time not null,
  slot_duration_minutes integer not null default 30
                        check (slot_duration_minutes in (15, 30, 45, 60)),
  is_active             boolean not null default true,
  effective_from        date not null default ((now() at time zone 'Asia/Manila')::date),
  effective_until       date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint doctor_schedules_time_order check (end_time > start_time),
  constraint doctor_schedules_effective_order
    check (effective_until is null or effective_until >= effective_from),
  constraint doctor_schedules_no_active_overlap exclude using gist (
    doctor_id with =,
    day_of_week with =,
    daterange(effective_from, effective_until, '[]') with &&,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time, '[)') with &&
  ) where (is_active)
);
create index doctor_schedules_doctor_day_idx on public.doctor_schedules (doctor_id, day_of_week);
comment on table public.doctor_schedules is
  'Recurring weekly consultation periods per doctor. A weekday may have several periods. day_of_week is 0-6, Sunday-first; times and effective dates are Asia/Manila.';

-- Exceptions only remove availability; added hours are doctor_schedules periods.
-- Created in 0002 as doctor_blocked_slots and renamed in 0003; the primary key
-- and reason check keep their original names so later migrations match.
-- PLANNED CHANGE [ADM-06]: doctor_id becomes nullable (null = hospital-wide
-- holiday). Slot generation must handle null rows in the same migration.
create table public.schedule_exceptions (                       -- [built]
  id                    uuid not null default gen_random_uuid(),
  doctor_id             uuid not null references public.doctors (id) on delete cascade,
  start_datetime        timestamptz not null,
  end_datetime          timestamptz not null,
  reason                text not null,
  exception_type        public.schedule_exception_type not null default 'blocked_period',
  created_by_profile_id uuid references public.profiles (id) on delete restrict, -- [ADM-06]
  created_at            timestamptz not null default now(),
  constraint doctor_blocked_slots_pkey primary key (id),
  constraint doctor_blocked_slots_reason_check check (btrim(reason) <> ''),
  constraint schedule_exceptions_time_order check (end_datetime > start_datetime)
);
create index schedule_exceptions_doctor_range_idx
  on public.schedule_exceptions (doctor_id, start_datetime);
comment on table public.schedule_exceptions is
  'Date/time intervals where the doctor is unavailable. Exceptions only remove availability; temporary added hours are effective-dated schedule periods.';

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------

create table public.appointments (                              -- [built]
  id                      uuid primary key default gen_random_uuid(),
  doctor_id               uuid not null references public.doctors (id) on delete restrict,
  patient_id              uuid not null references public.profiles (id) on delete restrict,
  specialty_id            uuid references public.specialties (id) on delete set null,
  department_id           uuid references public.departments (id) on delete set null, -- [ADM-09]
  scheduled_at            timestamptz not null,
  scheduled_end_at        timestamptz not null,   -- maintained by appointments_set_scheduled_end
  duration_minutes        integer not null default 30 check (duration_minutes between 5 and 480),
  status                  public.appointment_status not null default 'requested',
  reason                  text,
  booking_source          public.booking_source not null default 'other',
  created_by_profile_id   uuid references public.profiles (id) on delete set null,
  confirmed_by_profile_id uuid references public.profiles (id) on delete set null,
  confirmed_at            timestamptz,
  rejection_reason        text,
  cancellation_reason     text,
  cancelled_by_role       public.user_role,
  cancelled_at            timestamptz,                                               -- [ADM-09]
  completed_at            timestamptz,                                               -- [ADM-09]
  no_show_at              timestamptz,                                               -- [ADM-09]
  rescheduled_from_at     timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint appointments_rejection_reason_required
    check (status <> 'rejected' or btrim(coalesce(rejection_reason, '')) <> ''),
  -- Database backstop against double booking of slot-holding statuses.
  constraint appointments_no_active_overlap exclude using gist (
    doctor_id with =,
    tstzrange(scheduled_at, scheduled_end_at, '[)') with &&
  ) where (status in ('requested', 'confirmed', 'checked_in'))
);
create index appointments_doctor_scheduled_at_idx on public.appointments (doctor_id, scheduled_at);
create index appointments_patient_scheduled_at_idx on public.appointments (patient_id, scheduled_at);
comment on table public.appointments is
  'Appointment requests and confirmed visits. Doctor_id must reference a profile with role = doctor; this is enforced by the service layer in the current slice.';
comment on column public.appointments.booking_source is
  'Where the appointment came from. ai_chatbot rows must be inserted as requested (see cammi_connect_guard_ai_booking).';
comment on column public.appointments.created_by_profile_id is
  'Who submitted the booking. Equals patient_id for self-service bookings; the staff member for front desk bookings.';

-- Legacy history; superseded by appointment_audit_logs (0007) but not dropped.
create table public.appointment_status_history (                -- [built]
  id                    uuid primary key default gen_random_uuid(),
  appointment_id        uuid not null references public.appointments (id) on delete cascade,
  from_status           public.appointment_status,
  to_status             public.appointment_status not null,
  changed_by_profile_id uuid references public.profiles (id) on delete set null,
  reason                text,
  scheduled_at_snapshot timestamptz,
  created_at            timestamptz not null default now()
);
create index appointment_status_history_appointment_idx
  on public.appointment_status_history (appointment_id, created_at);
comment on table public.appointment_status_history is
  'Deprecated by appointment_audit_logs (0007). Read-only; kept until a later migration drops it.';

-- Append-only (update/delete/truncate rejected by trigger).
create table public.appointment_audit_logs (                    -- [built]
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references public.appointments (id) on delete restrict,
  actor_profile_id uuid references public.profiles (id) on delete restrict,
  action           text not null check (action in (
                     'created', 'confirmed', 'rejected', 'cancelled',
                     'rescheduled', 'checked_in', 'completed', 'no_show'
                   )),
  previous_status  public.appointment_status,
  new_status       public.appointment_status not null,
  previous_values  jsonb,
  new_values       jsonb,
  reason           text,
  created_at       timestamptz not null default now()
);
create index appointment_audit_logs_appointment_idx
  on public.appointment_audit_logs (appointment_id, created_at);
comment on table public.appointment_audit_logs is
  'Append-only audit history of appointment actions (FD-001). previous_status is null only for the created row. Rows cannot be updated or deleted.';

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- doctor_id references profiles (not doctors), unchanged since 0002.
create table public.doctor_notifications (                      -- [built]
  id             uuid primary key default gen_random_uuid(),
  doctor_id      uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  type           public.doctor_notification_type not null,
  title          text not null check (btrim(title) <> ''),
  body           text not null default '',
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index doctor_notifications_doctor_created_idx
  on public.doctor_notifications (doctor_id, created_at desc);
create index doctor_notifications_doctor_unread_idx
  on public.doctor_notifications (doctor_id) where read_at is null;
comment on table public.doctor_notifications is
  'Doctor-facing notifications for appointment events. Upcoming-consultation reminders are computed, not stored.';

-- Shape mirrors doctor_notifications; exact design is decided in FD-001 PR 9.
create table public.patient_notifications (                     -- [FD-9]
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  type           public.patient_notification_type not null,
  title          text not null check (btrim(title) <> ''),
  body           text not null default '',
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index patient_notifications_patient_created_idx
  on public.patient_notifications (patient_id, created_at desc);
create index patient_notifications_patient_unread_idx
  on public.patient_notifications (patient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Chat (Cami)
-- ---------------------------------------------------------------------------

create table public.chat_conversations (                        -- [built]
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  booking_state jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index chat_conversations_patient_updated_idx
  on public.chat_conversations (patient_id, updated_at desc);

create table public.chat_messages (                             -- [built]
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (char_length(content) between 1 and 4000),
  payload         jsonb,
  created_at      timestamptz not null default now()
);
create index chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);
create index chat_messages_created_idx on public.chat_messages (created_at);

-- ---------------------------------------------------------------------------
-- Knowledge base (RAG)
-- ---------------------------------------------------------------------------

-- PLANNED CHANGE [ADM-13]: `status` replaces is_published. The migration that
-- drops is_published must also rewrite cammi_connect_match_knowledge_chunks
-- and cammi_connect_replace_document_chunks, which read it today.
-- Versions are a counter on the row (no separate versions table).
create table public.knowledge_documents (                       -- [built]
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                   text not null check (char_length(title) between 1 and 200),
  category                public.kb_category not null default 'other_patient_info', -- [ADM-13]
  content                 text,                                                       -- [ADM-13]
  source_file_path        text,                                                       -- [ADM-13]
  content_hash            text not null,
  version                 integer not null default 1 check (version >= 1),
  is_published            boolean not null default true,
  status                  public.kb_status not null default 'draft',                 -- [ADM-13]
  processing_status       public.kb_processing not null default 'pending',           -- [ADM-13]
  processing_error        text,                                                       -- [ADM-13]
  published_at            timestamptz,                                                -- [ADM-13]
  published_by_profile_id uuid references public.profiles (id) on delete restrict,   -- [ADM-13]
  archived_at             timestamptz,                                                -- [ADM-13]
  created_by_profile_id   uuid references public.profiles (id) on delete restrict,   -- [ADM-13] null for CLI-ingested docs
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- PLANNED CHANGE [ADM-14]: is_active replaces is_published, and the unique key
-- becomes (document_id, document_version, chunk_index) so old chunks keep
-- serving until the new version is ready. Same function rewrite as above.
create table public.knowledge_chunks (                          -- [built]
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references public.knowledge_documents (id) on delete cascade,
  document_version integer not null,
  chunk_index      integer not null check (chunk_index >= 0),
  section_title    text,
  content          text not null check (char_length(content) between 1 and 4000),
  content_hash     text not null,
  token_count      integer,                                                  -- [ADM-14]
  embedding        extensions.vector(768) not null,
  is_published     boolean not null default true,
  is_active        boolean not null default false,                           -- [ADM-14]
  created_at       timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------

-- Append-only (update/delete/truncate rejected by trigger).
-- target_id is polymorphic text (no FK); target_type names the table.
create table public.audit_logs (                                -- [built]
  id               uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  action           text not null,
  target_type      text not null,
  target_id        text not null,
  previous_values  jsonb,
  new_values       jsonb,
  reason           text,
  created_at       timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_target_type_not_blank check (btrim(target_type) <> ''),
  constraint audit_logs_target_id_not_blank check (btrim(target_id) <> '')
);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
comment on table public.audit_logs is
  'Append-only audit history of admin changes (ADM-00). action is a dotted verb such as department.update. Rows cannot be updated or deleted.';

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- [ADM-10] analytics_appointments: one row per appointment with Manila-time
-- buckets (sched_date_mnl, sched_month, weekday, hour_bucket, was_confirmed,
-- is_due). Not created here: the metric definitions (decision D5) are not
-- signed off yet. It reads appointments only and adds no relationships.

-- ===========================================================================
-- Functions
-- ===========================================================================
--
-- Every [built] function below is copied verbatim from the migration that
-- defines it last, with its revoke/grant. Business functions are security
-- definer, run with an empty search_path, and are executable by service_role
-- only. They raise P0001 with a short machine-readable message that the
-- server maps to a user-facing error.

-- [built] final definition from migration 0001
create or replace function public.cammi_connect_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.cammi_connect_set_updated_at()
  from public, anon, authenticated;

-- [built] final definition from migration 0001
-- Public self-registration always creates a patient profile. Doctor and admin
-- roles are provisioned manually (or by the seed script) until an admin flow
-- exists.
create or replace function public.cammi_connect_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (auth_user_id, role, full_name)
  values (
    new.id,
    'patient',
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Patient'
    )
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;
revoke all on function public.cammi_connect_handle_new_auth_user()
  from public, anon, authenticated;

-- [built] final definition from migration 0002
create or replace function public.cammi_connect_set_appointment_end()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.scheduled_end_at =
    new.scheduled_at + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;
revoke all on function public.cammi_connect_set_appointment_end()
  from public, anon, authenticated;

-- [built] final definition from migration 0014
create or replace function public.cammi_connect_save_doctor(
  p_doctor_id uuid,
  p_full_name text,
  p_department_id uuid,
  p_is_active boolean,
  p_specialty_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_doctor_id uuid := p_doctor_id;
  v_role public.user_role;
begin
  if v_doctor_id is null then
    insert into public.profiles (role, full_name, department_id)
    values ('doctor', p_full_name, p_department_id)
    returning id into v_doctor_id;
  else
    select role into v_role
    from public.profiles
    where id = v_doctor_id
    for update;

    if not found then
      raise exception 'profile_not_found' using errcode = 'P0001';
    end if;
    if v_role = 'admin' then
      raise exception 'admin_profile' using errcode = 'P0001';
    end if;

    perform public.cammi_connect_allow_role_change();
    update public.profiles
      set role = 'doctor',
          full_name = p_full_name,
          department_id = p_department_id
      where id = v_doctor_id;
  end if;

  insert into public.doctors (id, department_id, full_name, is_active)
  values (v_doctor_id, p_department_id, p_full_name, p_is_active)
  on conflict (id) do update
    set department_id = excluded.department_id,
        full_name = excluded.full_name,
        is_active = excluded.is_active;

  delete from public.doctor_specialties
    where doctor_id = v_doctor_id
      and specialty_id <> all (p_specialty_ids);

  insert into public.doctor_specialties (doctor_id, specialty_id)
  select v_doctor_id, specialty_id
  from unnest(p_specialty_ids) as specialty_id
  on conflict do nothing;

  return v_doctor_id;
end;
$$;
revoke all on function public.cammi_connect_save_doctor(uuid, text, uuid, boolean, uuid[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_save_doctor(uuid, text, uuid, boolean, uuid[])
  to service_role;

-- [built] final definition from migration 0007
-- Raises P0001 with message inactive_doctor, past, outside_hours, or blocked.
-- An overlapping slot-holding appointment fails on
-- appointments_no_active_overlap (SQLSTATE 23P01). The booking is always
-- inserted as requested; confirmation is a separate staff operation. The
-- patient and creator ids must come from the authenticated session; the
-- calling server code enforces that.
create or replace function public.cammi_connect_book_appointment(
  p_doctor_id uuid,
  p_patient_id uuid,
  p_scheduled_at timestamptz,
  p_reason text,
  p_booking_source public.booking_source,
  p_created_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_local timestamp := p_scheduled_at at time zone 'Asia/Manila';
  v_local_date date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_scheduled_at at time zone 'Asia/Manila')::time;
  v_duration integer;
  v_appointment_id uuid;
begin
  -- Serializes concurrent bookings for this doctor.
  perform 1
  from public.doctors
  where id = p_doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The slot must start on the period's grid and end inside the period.
  -- Minutes are compared as numbers so a slot cannot wrap past midnight.
  select schedules.slot_duration_minutes
  into v_duration
  from public.doctor_schedules as schedules
  where schedules.doctor_id = p_doctor_id
    and schedules.is_active
    and schedules.day_of_week = extract(dow from v_local)
    and schedules.effective_from <= v_local_date
    and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
    and v_local_time >= schedules.start_time
    and extract(epoch from v_local_time) / 60 + schedules.slot_duration_minutes
      <= extract(epoch from schedules.end_time) / 60
    and mod(
      extract(epoch from (v_local_time - schedules.start_time))::integer,
      schedules.slot_duration_minutes * 60
    ) = 0
  limit 1;

  if v_duration is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.schedule_exceptions as exceptions
    where exceptions.doctor_id = p_doctor_id
      and exceptions.start_datetime < p_scheduled_at + make_interval(mins => v_duration)
      and exceptions.end_datetime > p_scheduled_at
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    doctor_id, patient_id, scheduled_at, duration_minutes, status, reason,
    booking_source, created_by_profile_id
  )
  values (
    p_doctor_id, p_patient_id, p_scheduled_at, v_duration, 'requested',
    nullif(btrim(coalesce(p_reason, '')), ''),
    p_booking_source, p_created_by
  )
  returning id into v_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    v_appointment_id, p_created_by, 'created', null, 'requested',
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'booking_source', p_booking_source
    )
  );

  return v_appointment_id;
end;
$$;
revoke all on function public.cammi_connect_book_appointment(
  uuid, uuid, timestamptz, text, public.booking_source, uuid
) from public, anon, authenticated;
grant execute on function public.cammi_connect_book_appointment(
  uuid, uuid, timestamptz, text, public.booking_source, uuid
) to service_role;

-- [built] final definition from migration 0005
create or replace function public.cammi_connect_match_knowledge_chunks(
  query_embedding extensions.vector(768),
  match_count integer,
  min_similarity double precision
)
returns table (
  chunk_id uuid,
  slug text,
  title text,
  section_title text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    d.slug,
    d.title,
    c.section_title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.is_published
    and d.is_published
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
revoke all on function public.cammi_connect_match_knowledge_chunks(extensions.vector, integer, double precision)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_match_knowledge_chunks(extensions.vector, integer, double precision)
  to service_role;

-- [built] final definition from migration 0005
create or replace function public.cammi_connect_replace_document_chunks(
  p_document jsonb,
  p_chunks jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_document_id uuid;
  v_version integer;
begin
  if jsonb_typeof(p_chunks) is distinct from 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'A document needs at least one chunk.' using errcode = '22023';
  end if;

  insert into public.knowledge_documents (slug, title, content_hash)
  values (p_document->>'slug', p_document->>'title', p_document->>'content_hash')
  on conflict (slug) do update
    set title = excluded.title,
        content_hash = excluded.content_hash,
        version = public.knowledge_documents.version
          + case
              when public.knowledge_documents.content_hash = excluded.content_hash then 0
              else 1
            end
  returning id, version into v_document_id, v_version;

  delete from public.knowledge_chunks where document_id = v_document_id;

  insert into public.knowledge_chunks (
    document_id, document_version, chunk_index, section_title, content, content_hash, embedding
  )
  select
    v_document_id,
    v_version,
    (chunk->>'chunk_index')::integer,
    chunk->>'section_title',
    chunk->>'content',
    chunk->>'content_hash',
    (chunk->'embedding')::text::extensions.vector
  from jsonb_array_elements(p_chunks) as chunk;

  return v_document_id;
end;
$$;
revoke all on function public.cammi_connect_replace_document_chunks(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_replace_document_chunks(jsonb, jsonb)
  to service_role;

-- [built] final definition from migration 0007
-- The chatbot may only submit requests. Confirmation is a separate, staff-run
-- operation, so an AI-sourced row can never be born confirmed.
create or replace function public.cammi_connect_guard_ai_booking()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.booking_source = 'ai_chatbot' and new.status <> 'requested' then
    raise exception 'ai_requires_confirmation' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.cammi_connect_guard_ai_booking()
  from public, anon, authenticated;

-- [built] final definition from migration 0007
create or replace function public.cammi_connect_reject_audit_log_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'audit_log_immutable' using errcode = 'P0001';
end;
$$;
revoke all on function public.cammi_connect_reject_audit_log_change()
  from public, anon, authenticated;

-- [built] final definition from migration 0009
-- Raises P0001 with message not_found, not_pending, inactive_doctor, past,
-- outside_hours, or blocked.
create or replace function public.cammi_connect_confirm_appointment(
  p_appointment_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_local timestamp;
  v_local_date date;
  v_local_time time;
  v_confirmed_at timestamptz := now();
begin
  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_appointment.status <> 'requested' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  -- Same lock as cammi_connect_book_appointment, so a confirmation and a
  -- booking for this doctor never interleave.
  perform 1
  from public.doctors
  where id = v_appointment.doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if v_appointment.scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The appointment must still fit inside one of the doctor's active
  -- consultation periods. Unlike booking, the slot grid is not re-checked:
  -- the period's slot length may have changed since the request was made.
  v_local := v_appointment.scheduled_at at time zone 'Asia/Manila';
  v_local_date := v_local::date;
  v_local_time := v_local::time;

  if not exists (
    select 1
    from public.doctor_schedules as schedules
    where schedules.doctor_id = v_appointment.doctor_id
      and schedules.is_active
      and schedules.day_of_week = extract(dow from v_local)
      and schedules.effective_from <= v_local_date
      and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
      and v_local_time >= schedules.start_time
      and extract(epoch from v_local_time) / 60 + v_appointment.duration_minutes
        <= extract(epoch from schedules.end_time) / 60
  ) then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.schedule_exceptions as exceptions
    where exceptions.doctor_id = v_appointment.doctor_id
      and exceptions.start_datetime < v_appointment.scheduled_end_at
      and exceptions.end_datetime > v_appointment.scheduled_at
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'confirmed',
      confirmed_by_profile_id = p_staff_id,
      confirmed_at = v_confirmed_at
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    p_appointment_id, p_staff_id, 'confirmed', 'requested', 'confirmed',
    jsonb_build_object(
      'confirmed_at', v_confirmed_at,
      'scheduled_at', v_appointment.scheduled_at
    )
  );
end;
$$;
revoke all on function public.cammi_connect_confirm_appointment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_confirm_appointment(uuid, uuid)
  to service_role;

-- [built] final definition from migration 0009
-- Raises P0001 with message not_found, not_pending, or reason_required.
-- Rejected rows are kept; they free the doctor's slot because rejected is not
-- a slot-holding status.
create or replace function public.cammi_connect_reject_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.appointment_status;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select status
  into v_status
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_status <> 'requested' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'rejected',
      rejection_reason = v_reason
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    reason
  )
  values (
    p_appointment_id, p_staff_id, 'rejected', 'requested', 'rejected', v_reason
  );
end;
$$;
revoke all on function public.cammi_connect_reject_appointment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_reject_appointment(uuid, uuid, text)
  to service_role;

-- [built] final definition from migration 0010
-- Raises P0001 with message not_found, invalid_status, invalid_transition, or
-- not_yet.
create or replace function public.cammi_connect_record_attendance(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_recorded_at timestamptz := now();
begin
  if p_status is null
    or p_status not in ('checked_in', 'completed', 'no_show') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not (
    (v_appointment.status = 'confirmed'
      and p_status in ('checked_in', 'completed', 'no_show'))
    or (v_appointment.status = 'checked_in' and p_status = 'completed')
  ) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if (v_appointment.scheduled_at at time zone 'Asia/Manila')::date
    > (v_recorded_at at time zone 'Asia/Manila')::date then
    raise exception 'not_yet' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = p_status
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    p_appointment_id, p_staff_id, p_status::text, v_appointment.status, p_status,
    jsonb_build_object(
      'recorded_at', v_recorded_at,
      'scheduled_at', v_appointment.scheduled_at
    )
  );
end;
$$;
revoke all on function public.cammi_connect_record_attendance(
  uuid, uuid, public.appointment_status
) from public, anon, authenticated;
grant execute on function public.cammi_connect_record_attendance(
  uuid, uuid, public.appointment_status
) to service_role;

-- [built] final definition from migration 0011
-- Raises P0001 with message reason_required, not_found, not_reschedulable,
-- unchanged, inactive_doctor, past, outside_hours, or blocked. A taken slot
-- raises 23P01.
create or replace function public.cammi_connect_reschedule_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_scheduled_at timestamptz,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_local timestamp := p_scheduled_at at time zone 'Asia/Manila';
  v_local_date date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_scheduled_at at time zone 'Asia/Manila')::time;
  v_duration integer;
begin
  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_appointment.status not in ('requested', 'confirmed') then
    raise exception 'not_reschedulable' using errcode = 'P0001';
  end if;

  if p_scheduled_at is null or p_scheduled_at = v_appointment.scheduled_at then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  -- Same lock as cammi_connect_book_appointment, so a reschedule and a
  -- booking for this doctor never interleave.
  perform 1
  from public.doctors
  where id = v_appointment.doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The new slot must start on a period's grid and end inside the period,
  -- exactly as for a booking. The period's slot length becomes the duration.
  select schedules.slot_duration_minutes
  into v_duration
  from public.doctor_schedules as schedules
  where schedules.doctor_id = v_appointment.doctor_id
    and schedules.is_active
    and schedules.day_of_week = extract(dow from v_local)
    and schedules.effective_from <= v_local_date
    and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
    and v_local_time >= schedules.start_time
    and extract(epoch from v_local_time) / 60 + schedules.slot_duration_minutes
      <= extract(epoch from schedules.end_time) / 60
    and mod(
      extract(epoch from (v_local_time - schedules.start_time))::integer,
      schedules.slot_duration_minutes * 60
    ) = 0
  limit 1;

  if v_duration is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.schedule_exceptions as exceptions
    where exceptions.doctor_id = v_appointment.doctor_id
      and exceptions.start_datetime < p_scheduled_at + make_interval(mins => v_duration)
      and exceptions.end_datetime > p_scheduled_at
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  update public.appointments
  set scheduled_at = p_scheduled_at,
      duration_minutes = v_duration,
      rescheduled_from_at = v_appointment.scheduled_at
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    previous_values, new_values, reason
  )
  values (
    p_appointment_id, p_staff_id, 'rescheduled',
    v_appointment.status, v_appointment.status,
    jsonb_build_object(
      'scheduled_at', v_appointment.scheduled_at,
      'duration_minutes', v_appointment.duration_minutes
    ),
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'duration_minutes', v_duration
    ),
    v_reason
  );
end;
$$;
revoke all on function public.cammi_connect_reschedule_appointment(
  uuid, uuid, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.cammi_connect_reschedule_appointment(
  uuid, uuid, timestamptz, text
) to service_role;

-- [built] final definition from migration 0011
-- Raises P0001 with message reason_required, not_found, or not_cancellable.
-- Cancelled rows are kept; they free the doctor's slot because cancelled is
-- not a slot-holding status.
create or replace function public.cammi_connect_cancel_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_cancelled_at timestamptz := now();
begin
  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_appointment.status not in ('requested', 'confirmed') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancellation_reason = v_reason,
      cancelled_by_role = 'front_desk'
  where id = p_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values, reason
  )
  values (
    p_appointment_id, p_staff_id, 'cancelled', v_appointment.status, 'cancelled',
    jsonb_build_object(
      'cancelled_at', v_cancelled_at,
      'scheduled_at', v_appointment.scheduled_at
    ),
    v_reason
  );
end;
$$;
revoke all on function public.cammi_connect_cancel_appointment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_cancel_appointment(uuid, uuid, text)
  to service_role;

-- [built] final definition from migration 0012
-- Raises P0001 with message invalid_patient, inactive_doctor,
-- specialty_mismatch, past, outside_hours, or blocked. A taken slot raises
-- 23P01.
create or replace function public.cammi_connect_front_desk_book_appointment(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_specialty_id uuid,
  p_scheduled_at timestamptz,
  p_reason text,
  p_staff_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_local timestamp := p_scheduled_at at time zone 'Asia/Manila';
  v_local_date date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_local_time time := (p_scheduled_at at time zone 'Asia/Manila')::time;
  v_duration integer;
  v_confirmed_at timestamptz := now();
  v_appointment_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_patient_id and role = 'patient'
  ) then
    raise exception 'invalid_patient' using errcode = 'P0001';
  end if;

  -- Same lock as cammi_connect_book_appointment, so bookings for this doctor
  -- never interleave.
  perform 1
  from public.doctors
  where id = p_doctor_id and is_active
  for update;

  if not found then
    raise exception 'inactive_doctor' using errcode = 'P0001';
  end if;

  if p_specialty_id is not null and not exists (
    select 1
    from public.doctor_specialties
    where doctor_id = p_doctor_id and specialty_id = p_specialty_id
  ) then
    raise exception 'specialty_mismatch' using errcode = 'P0001';
  end if;

  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- The slot must start on a period's grid and end inside the period.
  -- Minutes are compared as numbers so a slot cannot wrap past midnight.
  select schedules.slot_duration_minutes
  into v_duration
  from public.doctor_schedules as schedules
  where schedules.doctor_id = p_doctor_id
    and schedules.is_active
    and schedules.day_of_week = extract(dow from v_local)
    and schedules.effective_from <= v_local_date
    and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
    and v_local_time >= schedules.start_time
    and extract(epoch from v_local_time) / 60 + schedules.slot_duration_minutes
      <= extract(epoch from schedules.end_time) / 60
    and mod(
      extract(epoch from (v_local_time - schedules.start_time))::integer,
      schedules.slot_duration_minutes * 60
    ) = 0
  limit 1;

  if v_duration is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.schedule_exceptions as exceptions
    where exceptions.doctor_id = p_doctor_id
      and exceptions.start_datetime < p_scheduled_at + make_interval(mins => v_duration)
      and exceptions.end_datetime > p_scheduled_at
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    doctor_id, patient_id, specialty_id, scheduled_at, duration_minutes, status,
    reason, booking_source, created_by_profile_id, confirmed_by_profile_id,
    confirmed_at
  )
  values (
    p_doctor_id, p_patient_id, p_specialty_id, p_scheduled_at, v_duration,
    'confirmed', nullif(btrim(coalesce(p_reason, '')), ''), 'front_desk',
    p_staff_id, p_staff_id, v_confirmed_at
  )
  returning id into v_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    v_appointment_id, p_staff_id, 'created', null, 'confirmed',
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'booking_source', 'front_desk',
      'patient_id', p_patient_id,
      'specialty_id', p_specialty_id,
      'confirmed_at', v_confirmed_at
    )
  );

  return v_appointment_id;
end;
$$;
revoke all on function public.cammi_connect_front_desk_book_appointment(
  uuid, uuid, uuid, timestamptz, text, uuid
) from public, anon, authenticated;
grant execute on function public.cammi_connect_front_desk_book_appointment(
  uuid, uuid, uuid, timestamptz, text, uuid
) to service_role;

-- [built] final definition from migration 0014
create or replace function public.cammi_connect_guard_role_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('cammi_connect.role_change', true), '') <> 'on' then
    raise exception 'role_change_forbidden' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.cammi_connect_guard_role_change()
  from public, anon, authenticated;

-- [built] final definition from migration 0014
-- Allows role updates for the rest of the current transaction only.
create or replace function public.cammi_connect_allow_role_change()
returns void
language sql
security invoker
set search_path = ''
as $$
  select set_config('cammi_connect.role_change', 'on', true);
$$;
revoke all on function public.cammi_connect_allow_role_change()
  from public, anon, authenticated;
grant execute on function public.cammi_connect_allow_role_change() to service_role;

-- [built] final definition from migration 0014
-- Locks the actor and target profiles in id order, then checks that the actor
-- is an active admin and the target is an account with a login. Raises
-- not_admin or not_found.
create or replace function public.cammi_connect_lock_admin_target(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id in (p_actor_profile_id, p_target_profile_id)
  order by id
  for update;

  perform 1
  from public.profiles
  where id = p_actor_profile_id and role = 'admin' and is_active;
  if not found then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  perform 1
  from public.profiles
  where id = p_target_profile_id and auth_user_id is not null;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.cammi_connect_lock_admin_target(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_lock_admin_target(uuid, uuid)
  to service_role;

-- [built] final definition from migration 0014
create or replace function public.cammi_connect_admin_set_user_role(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_new_role public.user_role,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_previous_role public.user_role;
begin
  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, p_target_profile_id);

  if v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select role into v_previous_role
  from public.profiles
  where id = p_target_profile_id;

  if v_previous_role = p_new_role then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;
  if p_target_profile_id = p_actor_profile_id then
    raise exception 'self_change' using errcode = 'P0001';
  end if;
  -- Doctors with a directory record are managed from the Doctors section,
  -- so their appointments and schedules are never orphaned here.
  if exists (select 1 from public.doctors where id = p_target_profile_id) then
    raise exception 'doctor_record' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_allow_role_change();
  update public.profiles
    set role = p_new_role
    where id = p_target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values, reason
  ) values (
    p_actor_profile_id, 'user.role_change', 'user', p_target_profile_id::text,
    jsonb_build_object('role', v_previous_role),
    jsonb_build_object('role', p_new_role),
    v_reason
  );
end;
$$;
revoke all on function public.cammi_connect_admin_set_user_role(uuid, uuid, public.user_role, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_user_role(uuid, uuid, public.user_role, text)
  to service_role;

-- [built] final definition from migration 0014
create or replace function public.cammi_connect_admin_set_user_active(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_is_active boolean,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_was_active boolean;
begin
  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, p_target_profile_id);

  if v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select is_active into v_was_active
  from public.profiles
  where id = p_target_profile_id;

  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;
  if p_target_profile_id = p_actor_profile_id then
    raise exception 'self_change' using errcode = 'P0001';
  end if;

  update public.profiles
    set is_active = p_is_active
    where id = p_target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values, reason
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'user.activate' else 'user.deactivate' end,
    'user', p_target_profile_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active),
    v_reason
  );
end;
$$;
revoke all on function public.cammi_connect_admin_set_user_active(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_user_active(uuid, uuid, boolean, text)
  to service_role;

-- [built] final definition from migration 0014
create or replace function public.cammi_connect_admin_update_user_profile(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_full_name text,
  p_phone text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_previous record;
begin
  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, p_target_profile_id);

  if v_full_name = '' then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;

  select full_name, phone into v_previous
  from public.profiles
  where id = p_target_profile_id;

  if v_previous.full_name = v_full_name
     and v_previous.phone is not distinct from v_phone then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  update public.profiles
    set full_name = v_full_name,
        phone = v_phone
    where id = p_target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'user.update', 'user', p_target_profile_id::text,
    jsonb_build_object('full_name', v_previous.full_name, 'phone', v_previous.phone),
    jsonb_build_object('full_name', v_full_name, 'phone', v_phone)
  );
end;
$$;
revoke all on function public.cammi_connect_admin_update_user_profile(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_update_user_profile(uuid, uuid, text, text)
  to service_role;

-- [built] final definition from migration 0014
-- Supabase Auth's invite inserts the auth user, and
-- cammi_connect_handle_new_auth_user (0001) gives it a patient profile. This
-- turns that new profile into a staff profile. Returns the profile id.
create or replace function public.cammi_connect_admin_provision_staff(
  p_actor_profile_id uuid,
  p_auth_user_id uuid,
  p_role public.user_role,
  p_full_name text,
  p_phone text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_profile_id uuid;
  v_role public.user_role;
begin
  if p_role not in ('front_desk', 'doctor', 'admin') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if v_full_name = '' then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;

  select id, role into v_profile_id, v_role
  from public.profiles
  where auth_user_id = p_auth_user_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_lock_admin_target(p_actor_profile_id, v_profile_id);

  -- Only a fresh patient profile from the invite is turned into staff.
  if v_role <> 'patient' then
    raise exception 'already_provisioned' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_allow_role_change();
  update public.profiles
    set role = p_role,
        full_name = v_full_name,
        phone = v_phone
    where id = v_profile_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, new_values
  ) values (
    p_actor_profile_id, 'user.create', 'user', v_profile_id::text,
    jsonb_build_object('role', p_role, 'full_name', v_full_name)
  );

  return v_profile_id;
end;
$$;
revoke all on function public.cammi_connect_admin_provision_staff(uuid, uuid, public.user_role, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_provision_staff(uuid, uuid, public.user_role, text, text)
  to service_role;

-- [built] final definition from migration 0014
-- Security definer so it can read auth.users. It returns only the listed
-- columns: password hashes, tokens, and auth metadata are never selected.
-- Only accounts with a login are listed (walk-in and directory-only profiles
-- have no auth user).
create or replace function public.cammi_connect_admin_list_users(
  p_search text,
  p_role public.user_role,
  p_is_active boolean,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with pattern as (
    select '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      as value
    where nullif(btrim(coalesce(p_search, '')), '') is not null
  )
  select
    profiles.id,
    profiles.full_name,
    users.email::text,
    profiles.role,
    profiles.is_active,
    profiles.created_at,
    users.last_sign_in_at,
    count(*) over () as total_count
  from public.profiles
  join auth.users as users on users.id = profiles.auth_user_id
  where (p_role is null or profiles.role = p_role)
    and (p_is_active is null or profiles.is_active = p_is_active)
    and (
      not exists (select 1 from pattern)
      or profiles.full_name ilike (select value from pattern)
      or users.email ilike (select value from pattern)
    )
  order by profiles.created_at desc, profiles.id
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;
revoke all on function public.cammi_connect_admin_list_users(text, public.user_role, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_list_users(text, public.user_role, boolean, integer, integer)
  to service_role;

-- [built] final definition from migration 0014
create or replace function public.cammi_connect_admin_get_user(p_profile_id uuid)
returns table (
  id uuid,
  auth_user_id uuid,
  full_name text,
  email text,
  phone text,
  role public.user_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  has_doctor_record boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id,
    profiles.auth_user_id,
    profiles.full_name,
    users.email::text,
    profiles.phone,
    profiles.role,
    profiles.is_active,
    profiles.created_at,
    users.last_sign_in_at,
    exists (select 1 from public.doctors where doctors.id = profiles.id)
  from public.profiles
  join auth.users as users on users.id = profiles.auth_user_id
  where profiles.id = p_profile_id;
$$;
revoke all on function public.cammi_connect_admin_get_user(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_get_user(uuid)
  to service_role;

-- [built] final definition from migration 0014
-- Used only by scripts/seed.mjs to create the first admin, the seed doctor,
-- and the seed front desk account. It needs no actor because the first admin
-- cannot be created by another admin. Application code must not call it.
create or replace function public.cammi_connect_bootstrap_staff_role(
  p_auth_user_id uuid,
  p_role public.user_role,
  p_full_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  perform public.cammi_connect_allow_role_change();
  insert into public.profiles (auth_user_id, role, full_name)
  values (p_auth_user_id, p_role, p_full_name)
  on conflict (auth_user_id) do update
    set role = excluded.role,
        full_name = excluded.full_name
  returning id into v_profile_id;
  return v_profile_id;
end;
$$;
revoke all on function public.cammi_connect_bootstrap_staff_role(uuid, public.user_role, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_bootstrap_staff_role(uuid, public.user_role, text)
  to service_role;

-- [built] final definition from migration 0015
-- Raises not_admin unless the profile is an active admin. The row is locked so
-- a concurrent demotion of the actor waits for this transaction.
create or replace function public.cammi_connect_require_admin_actor(p_actor_profile_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id = p_actor_profile_id and role = 'admin' and is_active
  for share;
  if not found then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.cammi_connect_require_admin_actor(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_require_admin_actor(uuid) to service_role;

-- [built] final definition from migration 0015
create or replace function public.cammi_connect_admin_save_department(
  p_actor_profile_id uuid,
  p_department_id uuid,
  p_name text,
  p_code text,
  p_description text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_department_id uuid := p_department_id;
  v_previous record;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_department_id is not null then
    select name, code, description into v_previous
    from public.departments
    where id = v_department_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_department_id is null then
      insert into public.departments (name, code, description)
      values (v_name, v_code, v_description)
      returning id into v_department_id;
    else
      update public.departments
        set name = v_name,
            code = v_code,
            description = v_description
        where id = v_department_id;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate' using errcode = 'P0001';
  end;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_department_id is null then 'department.create' else 'department.update' end,
    'department', v_department_id::text,
    case
      when p_department_id is null then null
      else jsonb_build_object(
        'name', v_previous.name,
        'code', v_previous.code,
        'description', v_previous.description
      )
    end,
    jsonb_build_object('name', v_name, 'code', v_code, 'description', v_description)
  );

  return v_department_id;
end;
$$;
revoke all on function public.cammi_connect_admin_save_department(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_department(uuid, uuid, text, text, text)
  to service_role;

-- [built] final definition from migration 0015
create or replace function public.cammi_connect_admin_set_department_active(
  p_actor_profile_id uuid,
  p_department_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_was_active boolean;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select is_active into v_was_active
  from public.departments
  where id = p_department_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  if not p_is_active and exists (
    select 1
    from public.appointments
    join public.doctors on doctors.id = appointments.doctor_id
    where doctors.department_id = p_department_id
      and appointments.status in ('requested', 'confirmed')
      and appointments.scheduled_at > now()
  ) then
    raise exception 'has_future_appointments' using errcode = 'P0001';
  end if;

  update public.departments
    set is_active = p_is_active
    where id = p_department_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'department.activate' else 'department.deactivate' end,
    'department', p_department_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;
revoke all on function public.cammi_connect_admin_set_department_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_department_active(uuid, uuid, boolean)
  to service_role;

-- [built] final definition from migration 0015
-- Appointment counts per department and status for appointments scheduled in
-- [p_from, p_to). Departments come from the doctor's current assignment.
create or replace function public.cammi_connect_department_appointment_stats(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  department_id uuid,
  status public.appointment_status,
  appointment_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select doctors.department_id, appointments.status, count(*)
  from public.appointments
  join public.doctors on doctors.id = appointments.doctor_id
  where doctors.department_id is not null
    and appointments.scheduled_at >= p_from
    and appointments.scheduled_at < p_to
  group by doctors.department_id, appointments.status;
$$;
revoke all on function public.cammi_connect_department_appointment_stats(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_department_appointment_stats(timestamptz, timestamptz)
  to service_role;

-- [built] final definition from migration 0015
-- The future requested/confirmed appointments that block deactivating a
-- department, soonest first. No patient data is returned.
create or replace function public.cammi_connect_department_future_conflicts(
  p_department_id uuid
)
returns table (
  appointment_id uuid,
  scheduled_at timestamptz,
  status public.appointment_status,
  doctor_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select appointments.id, appointments.scheduled_at, appointments.status, doctors.full_name
  from public.appointments
  join public.doctors on doctors.id = appointments.doctor_id
  where doctors.department_id = p_department_id
    and appointments.status in ('requested', 'confirmed')
    and appointments.scheduled_at > now()
  order by appointments.scheduled_at
  limit 50;
$$;
revoke all on function public.cammi_connect_department_future_conflicts(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_department_future_conflicts(uuid)
  to service_role;

-- [built] final definition from migration 0016
create or replace function public.cammi_connect_admin_save_specialty(
  p_actor_profile_id uuid,
  p_specialty_id uuid,
  p_name text,
  p_description text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_specialty_id uuid := p_specialty_id;
  v_previous record;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_specialty_id is not null then
    select name, description into v_previous
    from public.specialties
    where id = v_specialty_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_specialty_id is null then
      insert into public.specialties (name, description)
      values (v_name, v_description)
      returning id into v_specialty_id;
    else
      update public.specialties
        set name = v_name,
            description = v_description
        where id = v_specialty_id;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate' using errcode = 'P0001';
  end;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_specialty_id is null then 'specialty.create' else 'specialty.update' end,
    'specialty', v_specialty_id::text,
    case
      when p_specialty_id is null then null
      else jsonb_build_object('name', v_previous.name, 'description', v_previous.description)
    end,
    jsonb_build_object('name', v_name, 'description', v_description)
  );

  return v_specialty_id;
end;
$$;
revoke all on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text)
  to service_role;

-- [built] final definition from migration 0016
create or replace function public.cammi_connect_admin_set_specialty_active(
  p_actor_profile_id uuid,
  p_specialty_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_was_active boolean;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select is_active into v_was_active
  from public.specialties
  where id = p_specialty_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  update public.specialties
    set is_active = p_is_active
    where id = p_specialty_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'specialty.activate' else 'specialty.deactivate' end,
    'specialty', p_specialty_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;
revoke all on function public.cammi_connect_admin_set_specialty_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_specialty_active(uuid, uuid, boolean)
  to service_role;

-- [built] final definition from migration 0017
create or replace function public.cammi_connect_guard_doctor_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id = new.id and role = 'doctor';
  if not found then
    raise exception 'not_doctor_account' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.cammi_connect_guard_doctor_profile_role()
  from public, anon, authenticated;

-- [built] final definition from migration 0017
-- Locks the account profile and raises not_linkable unless it is an active
-- doctor account with a login and no doctor record.
create or replace function public.cammi_connect_require_linkable_doctor_account(
  p_account_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.profiles
  where id = p_account_profile_id
    and role = 'doctor'
    and auth_user_id is not null
    and is_active
  for update;
  if not found then
    raise exception 'not_linkable' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.doctors where id = p_account_profile_id) then
    raise exception 'not_linkable' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.cammi_connect_require_linkable_doctor_account(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_require_linkable_doctor_account(uuid)
  to service_role;

-- [built] final definition from migration 0017
-- Replaces the whole set in one transaction. Added specialties must be
-- active; a specialty the doctor already has may stay after it was
-- deactivated. Writes doctor.specialties_change only when the set changed.
create or replace function public.cammi_connect_admin_set_doctor_specialties(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_specialty_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_specialty_ids uuid[];
  v_previous_ids uuid[];
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select coalesce(array_agg(distinct requested.specialty_id order by requested.specialty_id), '{}')
  into v_specialty_ids
  from unnest(coalesce(p_specialty_ids, '{}'::uuid[])) as requested (specialty_id)
  where requested.specialty_id is not null;

  if cardinality(v_specialty_ids) = 0 then
    raise exception 'specialty_required' using errcode = 'P0001';
  end if;

  perform 1
  from public.doctors
  where id = p_doctor_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(links.specialty_id order by links.specialty_id), '{}')
  into v_previous_ids
  from public.doctor_specialties as links
  where links.doctor_id = p_doctor_id;

  if v_previous_ids = v_specialty_ids then
    return;
  end if;

  if exists (
    select 1
    from unnest(v_specialty_ids) as requested (specialty_id)
    where requested.specialty_id <> all (v_previous_ids)
      and not exists (
        select 1
        from public.specialties
        where specialties.id = requested.specialty_id and specialties.is_active
      )
  ) then
    raise exception 'inactive_specialty' using errcode = 'P0001';
  end if;

  delete from public.doctor_specialties
    where doctor_id = p_doctor_id
      and specialty_id <> all (v_specialty_ids);

  insert into public.doctor_specialties (doctor_id, specialty_id)
  select p_doctor_id, requested.specialty_id
  from unnest(v_specialty_ids) as requested (specialty_id)
  on conflict do nothing;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'doctor.specialties_change', 'doctor', p_doctor_id::text,
    jsonb_build_object('specialty_ids', to_jsonb(v_previous_ids)),
    jsonb_build_object('specialty_ids', to_jsonb(v_specialty_ids))
  );
end;
$$;
revoke all on function public.cammi_connect_admin_set_doctor_specialties(uuid, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_doctor_specialties(uuid, uuid, uuid[])
  to service_role;

-- [built] final definition from migration 0017
-- p_doctor_id null creates a doctor: on p_account_profile_id when given (it
-- must be linkable), otherwise on a new profile without a login.
-- p_account_profile_id is ignored on update. A new or changed department must
-- be active. Returns the doctor id.
create or replace function public.cammi_connect_admin_save_doctor(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_account_profile_id uuid,
  p_full_name text,
  p_department_id uuid,
  p_contact_email text,
  p_contact_phone text,
  p_bio text,
  p_specialty_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_contact_email text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_contact_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_doctor_id uuid := p_doctor_id;
  v_previous_full_name text;
  v_previous_department_id uuid;
  v_previous_contact_email text;
  v_previous_contact_phone text;
  v_previous_bio text;
  v_new_values jsonb;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_full_name = '' then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;
  if p_department_id is null then
    raise exception 'department_required' using errcode = 'P0001';
  end if;

  if p_doctor_id is not null then
    select full_name, department_id, contact_email, contact_phone, bio
    into v_previous_full_name, v_previous_department_id,
         v_previous_contact_email, v_previous_contact_phone, v_previous_bio
    from public.doctors
    where id = p_doctor_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  -- A doctor may keep a department that was deactivated after assignment.
  if p_doctor_id is null or p_department_id is distinct from v_previous_department_id then
    perform 1
    from public.departments
    where id = p_department_id and is_active;
    if not found then
      raise exception 'inactive_department' using errcode = 'P0001';
    end if;
  end if;

  v_new_values := jsonb_build_object(
    'full_name', v_full_name,
    'department_id', p_department_id,
    'contact_email', v_contact_email,
    'contact_phone', v_contact_phone,
    'bio', v_bio
  );

  if p_doctor_id is null then
    if p_account_profile_id is null then
      insert into public.profiles (role, full_name, department_id)
      values ('doctor', v_full_name, p_department_id)
      returning id into v_doctor_id;
    else
      perform public.cammi_connect_require_linkable_doctor_account(p_account_profile_id);
      v_doctor_id := p_account_profile_id;
      update public.profiles
        set full_name = v_full_name,
            department_id = p_department_id
        where id = v_doctor_id;
    end if;

    insert into public.doctors (id, department_id, full_name, contact_email, contact_phone, bio)
    values (v_doctor_id, p_department_id, v_full_name, v_contact_email, v_contact_phone, v_bio);

    insert into public.audit_logs (
      actor_profile_id, action, target_type, target_id, new_values
    ) values (
      p_actor_profile_id, 'doctor.create', 'doctor', v_doctor_id::text, v_new_values
    );

    if p_account_profile_id is not null then
      insert into public.audit_logs (
        actor_profile_id, action, target_type, target_id, new_values
      ) values (
        p_actor_profile_id, 'doctor.link_account', 'doctor', v_doctor_id::text,
        jsonb_build_object('account_profile_id', p_account_profile_id)
      );
    end if;
  else
    update public.profiles
      set full_name = v_full_name,
          department_id = p_department_id
      where id = v_doctor_id;

    update public.doctors
      set full_name = v_full_name,
          department_id = p_department_id,
          contact_email = v_contact_email,
          contact_phone = v_contact_phone,
          bio = v_bio
      where id = v_doctor_id;

    if v_previous_full_name is distinct from v_full_name
       or v_previous_department_id is distinct from p_department_id
       or v_previous_contact_email is distinct from v_contact_email
       or v_previous_contact_phone is distinct from v_contact_phone
       or v_previous_bio is distinct from v_bio then
      insert into public.audit_logs (
        actor_profile_id, action, target_type, target_id,
        previous_values, new_values
      ) values (
        p_actor_profile_id, 'doctor.update', 'doctor', v_doctor_id::text,
        jsonb_build_object(
          'full_name', v_previous_full_name,
          'department_id', v_previous_department_id,
          'contact_email', v_previous_contact_email,
          'contact_phone', v_previous_contact_phone,
          'bio', v_previous_bio
        ),
        v_new_values
      );
    end if;
  end if;

  perform public.cammi_connect_admin_set_doctor_specialties(
    p_actor_profile_id, v_doctor_id, p_specialty_ids
  );

  return v_doctor_id;
end;
$$;
revoke all on function public.cammi_connect_admin_save_doctor(uuid, uuid, uuid, text, uuid, text, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_doctor(uuid, uuid, uuid, text, uuid, text, text, text, uuid[])
  to service_role;

-- [built] final definition from migration 0017
create or replace function public.cammi_connect_admin_link_doctor_account(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_account_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  -- Both profiles are locked in id order so concurrent links cannot deadlock.
  perform 1
  from public.profiles
  where id in (p_doctor_id, p_account_profile_id)
  order by id
  for update;

  perform 1
  from public.doctors
  where id = p_doctor_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles
    where id = p_doctor_id and auth_user_id is not null
  ) then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;

  perform public.cammi_connect_require_linkable_doctor_account(p_account_profile_id);

  -- Every column that references profiles (see migrations 0001-0013). The
  -- account profile is deactivated below, so nothing may point at it.
  if exists (
       select 1 from public.appointments
       where p_account_profile_id in (
         doctor_id, patient_id, created_by_profile_id, confirmed_by_profile_id
       )
     )
     or exists (
       select 1 from public.appointment_audit_logs
       where actor_profile_id = p_account_profile_id
     )
     or exists (
       select 1 from public.appointment_status_history
       where changed_by_profile_id = p_account_profile_id
     )
     or exists (
       select 1 from public.chat_conversations
       where patient_id = p_account_profile_id
     )
     or exists (
       select 1 from public.doctor_notifications
       where doctor_id = p_account_profile_id
     )
     or exists (
       select 1 from public.audit_logs
       where actor_profile_id = p_account_profile_id
     ) then
    raise exception 'account_has_history' using errcode = 'P0001';
  end if;

  select auth_user_id into v_auth_user_id
  from public.profiles
  where id = p_account_profile_id;

  -- auth_user_id is unique, so the account profile gives it up first.
  update public.profiles
    set auth_user_id = null,
        is_active = false
    where id = p_account_profile_id;

  update public.profiles
    set auth_user_id = v_auth_user_id
    where id = p_doctor_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, new_values
  ) values (
    p_actor_profile_id, 'doctor.link_account', 'doctor', p_doctor_id::text,
    jsonb_build_object('account_profile_id', p_account_profile_id)
  );
end;
$$;
revoke all on function public.cammi_connect_admin_link_doctor_account(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_link_doctor_account(uuid, uuid, uuid)
  to service_role;

-- [built] final definition from migration 0017
-- Inactive doctors are already refused by every booking function (0003, 0012)
-- and left out of the patient and Cami directory. Appointment history stays.
create or replace function public.cammi_connect_admin_set_doctor_active(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_was_active boolean;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  -- The booking functions lock this row too, so a booking cannot slip in
  -- between the check below and the update.
  select is_active into v_was_active
  from public.doctors
  where id = p_doctor_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  if not p_is_active and exists (
    select 1
    from public.appointments
    where doctor_id = p_doctor_id
      and status in ('requested', 'confirmed')
      and scheduled_at > now()
  ) then
    raise exception 'has_future_appointments' using errcode = 'P0001';
  end if;

  update public.doctors
    set is_active = p_is_active
    where id = p_doctor_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'doctor.activate' else 'doctor.deactivate' end,
    'doctor', p_doctor_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;
revoke all on function public.cammi_connect_admin_set_doctor_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_doctor_active(uuid, uuid, boolean)
  to service_role;

-- [built] final definition from migration 0017
-- The future requested/confirmed appointments that block deactivating a
-- doctor, soonest first. No patient data is returned.
create or replace function public.cammi_connect_doctor_future_conflicts(
  p_doctor_id uuid
)
returns table (
  appointment_id uuid,
  scheduled_at timestamptz,
  status public.appointment_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select appointments.id, appointments.scheduled_at, appointments.status
  from public.appointments
  where appointments.doctor_id = p_doctor_id
    and appointments.status in ('requested', 'confirmed')
    and appointments.scheduled_at > now()
  order by appointments.scheduled_at
  limit 50;
$$;
revoke all on function public.cammi_connect_doctor_future_conflicts(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_doctor_future_conflicts(uuid)
  to service_role;

-- [built] final definition from migration 0017
-- Accounts an admin can link: active doctor profiles with a login and no
-- doctor record. Names only.
create or replace function public.cammi_connect_admin_list_linkable_doctor_accounts()
returns table (
  profile_id uuid,
  full_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select profiles.id, profiles.full_name
  from public.profiles
  where profiles.role = 'doctor'
    and profiles.auth_user_id is not null
    and profiles.is_active
    and not exists (select 1 from public.doctors where doctors.id = profiles.id)
  order by profiles.full_name
  limit 200;
$$;
revoke all on function public.cammi_connect_admin_list_linkable_doctor_accounts()
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_list_linkable_doctor_accounts()
  to service_role;

-- [built] final definition from migration 0018
-- Upcoming slot-holding appointments that no active period effective on their
-- Manila date covers. Mirrors fitsConsultationHours in
-- src/lib/schedules/availability.ts: same weekday, inside [start, end), and
-- never running past Manila midnight.
create or replace function public.cammi_connect_doctor_appointments_outside_hours(
  p_doctor_id uuid
)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select appointments.id
  from public.appointments
  where appointments.doctor_id = p_doctor_id
    and appointments.status in ('requested', 'confirmed', 'checked_in')
    and appointments.scheduled_at >= now()
    and not exists (
      select 1
      from public.doctor_schedules as schedules
      where schedules.doctor_id = appointments.doctor_id
        and schedules.is_active
        and schedules.day_of_week
          = extract(dow from appointments.scheduled_at at time zone 'Asia/Manila')
        and (appointments.scheduled_at at time zone 'Asia/Manila')::date
          >= schedules.effective_from
        and (
          schedules.effective_until is null
          or (appointments.scheduled_at at time zone 'Asia/Manila')::date
            <= schedules.effective_until
        )
        and (appointments.scheduled_end_at at time zone 'Asia/Manila')::date
          = (appointments.scheduled_at at time zone 'Asia/Manila')::date
        and (appointments.scheduled_at at time zone 'Asia/Manila')::time
          >= schedules.start_time
        and (appointments.scheduled_end_at at time zone 'Asia/Manila')::time
          <= schedules.end_time
    );
$$;
revoke all on function public.cammi_connect_doctor_appointments_outside_hours(uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_doctor_appointments_outside_hours(uuid)
  to service_role;

-- [built] final definition from migration 0018
-- p_period_id null creates a period; otherwise the doctor's own period is
-- updated. Returns the period id.
create or replace function public.cammi_connect_save_schedule_period(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_period_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_slot_duration_minutes integer,
  p_effective_from date,
  p_effective_until date,
  p_is_active boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous public.doctor_schedules;
  v_saved public.doctor_schedules;
  v_already_outside uuid[];
  v_action text;
begin
  -- An active admin may edit any doctor's hours; an active doctor only their own.
  perform 1
  from public.profiles
  where id = p_actor_profile_id
    and is_active
    and (role = 'admin' or (role = 'doctor' and id = p_doctor_id));
  if not found then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;

  perform 1
  from public.doctors
  where id = p_doctor_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(outside.id), '{}')
  into v_already_outside
  from public.cammi_connect_doctor_appointments_outside_hours(p_doctor_id) as outside (id);

  if p_period_id is null then
    insert into public.doctor_schedules (
      doctor_id, day_of_week, start_time, end_time, slot_duration_minutes,
      effective_from, effective_until, is_active
    ) values (
      p_doctor_id, p_day_of_week, p_start_time, p_end_time, p_slot_duration_minutes,
      p_effective_from, p_effective_until, p_is_active
    )
    returning * into v_saved;
    v_action := 'schedule.create';
  else
    select * into v_previous
    from public.doctor_schedules
    where id = p_period_id and doctor_id = p_doctor_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;

    if (v_previous.day_of_week, v_previous.start_time, v_previous.end_time,
        v_previous.slot_duration_minutes, v_previous.effective_from,
        v_previous.effective_until, v_previous.is_active)
       is not distinct from
       (p_day_of_week, p_start_time, p_end_time, p_slot_duration_minutes,
        p_effective_from, p_effective_until, p_is_active) then
      return p_period_id;
    end if;

    update public.doctor_schedules
      set day_of_week = p_day_of_week,
          start_time = p_start_time,
          end_time = p_end_time,
          slot_duration_minutes = p_slot_duration_minutes,
          effective_from = p_effective_from,
          effective_until = p_effective_until,
          is_active = p_is_active
      where id = p_period_id
      returning * into v_saved;
    v_action := case
      when v_previous.is_active and not p_is_active then 'schedule.deactivate'
      else 'schedule.update'
    end;
  end if;

  if exists (
    select 1
    from public.cammi_connect_doctor_appointments_outside_hours(p_doctor_id) as outside (id)
    where outside.id <> all (v_already_outside)
  ) then
    raise exception 'orphans_appointments' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, v_action, 'schedule', v_saved.id::text,
    case when v_previous.id is null then null else jsonb_build_object(
      'doctor_id', v_previous.doctor_id,
      'day_of_week', v_previous.day_of_week,
      'start_time', v_previous.start_time,
      'end_time', v_previous.end_time,
      'slot_duration_minutes', v_previous.slot_duration_minutes,
      'effective_from', v_previous.effective_from,
      'effective_until', v_previous.effective_until,
      'is_active', v_previous.is_active
    ) end,
    jsonb_build_object(
      'doctor_id', v_saved.doctor_id,
      'day_of_week', v_saved.day_of_week,
      'start_time', v_saved.start_time,
      'end_time', v_saved.end_time,
      'slot_duration_minutes', v_saved.slot_duration_minutes,
      'effective_from', v_saved.effective_from,
      'effective_until', v_saved.effective_until,
      'is_active', v_saved.is_active
    )
  );

  return v_saved.id;
end;
$$;
revoke all on function public.cammi_connect_save_schedule_period(
  uuid, uuid, uuid, smallint, time, time, integer, date, date, boolean
) from public, anon, authenticated;
grant execute on function public.cammi_connect_save_schedule_period(
  uuid, uuid, uuid, smallint, time, time, integer, date, date, boolean
) to service_role;

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- Every new Supabase Auth user gets a patient profile.
create trigger cammi_connect_auth_user_created                   -- [built]
after insert on auth.users
for each row execute function public.cammi_connect_handle_new_auth_user();

-- updated_at bookkeeping
create trigger departments_set_updated_at before update on public.departments
for each row execute function public.cammi_connect_set_updated_at();          -- [built]
create trigger specialties_set_updated_at before update on public.specialties
for each row execute function public.cammi_connect_set_updated_at();          -- [built]
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.cammi_connect_set_updated_at();          -- [built]
create trigger doctors_set_updated_at before update on public.doctors
for each row execute function public.cammi_connect_set_updated_at();          -- [built]
create trigger doctor_schedules_set_updated_at before update on public.doctor_schedules
for each row execute function public.cammi_connect_set_updated_at();          -- [built]
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.cammi_connect_set_updated_at();          -- [built]
create trigger chat_conversations_set_updated_at before update on public.chat_conversations
for each row execute function public.cammi_connect_set_updated_at();          -- [built]
create trigger knowledge_documents_set_updated_at before update on public.knowledge_documents
for each row execute function public.cammi_connect_set_updated_at();          -- [built]

-- Appointments: derived end time, and AI bookings may only be requests.
create trigger appointments_set_scheduled_end                    -- [built]
before insert or update of scheduled_at, duration_minutes on public.appointments
for each row execute function public.cammi_connect_set_appointment_end();
create trigger appointments_guard_ai_booking                     -- [built]
before insert on public.appointments
for each row execute function public.cammi_connect_guard_ai_booking();

-- Role integrity: profiles.role changes only through the 0014 functions, and
-- a doctors row must belong to a doctor profile.
create trigger profiles_guard_role_change                        -- [built]
before update of role on public.profiles
for each row execute function public.cammi_connect_guard_role_change();
create trigger doctors_guard_profile_role                        -- [built]
before insert or update on public.doctors
for each row execute function public.cammi_connect_guard_doctor_profile_role();

-- Append-only audit tables.
create trigger appointment_audit_logs_immutable                  -- [built]
before update or delete on public.appointment_audit_logs
for each row execute function public.cammi_connect_reject_audit_log_change();
create trigger appointment_audit_logs_no_truncate                -- [built]
before truncate on public.appointment_audit_logs
for each statement execute function public.cammi_connect_reject_audit_log_change();
create trigger audit_logs_immutable                              -- [built]
before update or delete on public.audit_logs
for each row execute function public.cammi_connect_reject_audit_log_change();
create trigger audit_logs_no_truncate                            -- [built]
before truncate on public.audit_logs
for each statement execute function public.cammi_connect_reject_audit_log_change();

-- ===========================================================================
-- Row level security and table privileges
-- ===========================================================================
--
-- RLS on, no permissive policies, nothing for anon/authenticated. The server's
-- service_role client is the only table client.

alter table public.departments                enable row level security;
alter table public.specialties                enable row level security;
alter table public.profiles                   enable row level security;
alter table public.doctors                    enable row level security;
alter table public.doctor_specialties         enable row level security;
alter table public.doctor_schedules           enable row level security;
alter table public.schedule_exceptions        enable row level security;
alter table public.appointments               enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.appointment_audit_logs     enable row level security;
alter table public.doctor_notifications       enable row level security;
alter table public.patient_notifications      enable row level security; -- [FD-9]
alter table public.chat_conversations         enable row level security;
alter table public.chat_messages              enable row level security;
alter table public.knowledge_documents        enable row level security;
alter table public.knowledge_chunks           enable row level security;
alter table public.audit_logs                 enable row level security;

revoke all on table
  public.departments, public.specialties, public.profiles, public.doctors, public.doctor_specialties, public.doctor_schedules,
  public.schedule_exceptions, public.appointments, public.appointment_status_history,
  public.appointment_audit_logs, public.doctor_notifications, public.patient_notifications,
  public.chat_conversations, public.chat_messages, public.knowledge_documents,
  public.knowledge_chunks, public.audit_logs
from anon, authenticated;

grant all on table
  public.departments, public.specialties, public.profiles, public.doctors, public.doctor_specialties, public.doctor_schedules,
  public.schedule_exceptions, public.appointments, public.doctor_notifications,
  public.patient_notifications, public.chat_conversations, public.chat_messages,
  public.knowledge_documents, public.knowledge_chunks
to service_role;

-- Audit tables: the server may read and append, never change.
revoke all on table public.appointment_audit_logs, public.audit_logs from service_role;
grant select, insert on table public.appointment_audit_logs, public.audit_logs to service_role;

-- Legacy history is read-only (0007).
grant all on table public.appointment_status_history to service_role;
revoke insert, update, delete, truncate on table public.appointment_status_history
  from service_role;
