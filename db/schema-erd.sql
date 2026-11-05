-- ===========================================================================
-- CamiConnect — TARGET end-state schema (for ERD / documentation)
-- ===========================================================================
--
-- DO NOT RUN THIS FILE. It is not a migration and is never applied.
--
-- This is the schema the system is expected to have once every planned slice
-- is built: what migrations 0001–0018 already create, plus the planned changes
-- from pr-admin.md (ADM-06 … ADM-15), FD-001 PR 9, and SPEC.md §4.2/§6,
-- folded directly into each table.
--
-- Legend (trailing comments):
--   [built]     exists today (migrations 0001–0018)
--   [ADM-xx]    planned by that admin slice (pr-admin.md)
--   [FD-9]      planned by front desk PR 9 (specs/tasks/FD-001-front-desk.md)
--   [SPEC]      listed in SPEC.md; design not yet decided (ADR still open)
-- Anything not marked [built] is a proposal until its migration is written.
--
-- Omitted on purpose: functions, triggers, RLS, grants, backfills.
-- Not modelled because the decision is still open: rate-limit records
-- (ADR-0005, may not live in Postgres) and chat_request_metadata (SPEC §6).
--
-- auth.users is Supabase-managed:
--   auth.users (id uuid primary key, email text, ...)

create extension if not exists btree_gist;
create extension if not exists vector;   -- Supabase: schema "extensions"

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('patient', 'doctor', 'admin', 'front_desk');          -- [built]
create type appointment_status as enum (                                              -- [built]
  'requested', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'rejected'
);
create type booking_source as enum ('ai_chatbot', 'front_desk', 'other');             -- [built]
create type schedule_exception_type as enum (
  'leave', 'blocked_period', 'unavailable_date', 'temporary_change',                  -- [built]
  'holiday'                                                                           -- [ADM-06]
);
create type doctor_notification_type as enum (                                        -- [built]
  'new_request', 'cancelled', 'rescheduled', 'reminder'
);
create type patient_notification_type as enum (                                       -- [FD-9]
  'confirmed', 'rejected', 'cancelled', 'rescheduled', 'reminder'
);
create type kb_category as enum (                                                     -- [ADM-13]
  'hospital_info', 'departments', 'specialties', 'doctor_profiles',
  'services', 'appointment_requirements', 'appointment_procedures', 'other_patient_info'
);
create type kb_status as enum ('draft', 'published', 'archived');                     -- [ADM-13]
create type kb_processing as enum ('pending', 'processing', 'ready', 'failed');       -- [ADM-13]
create type ingestion_job_status as enum ('queued', 'running', 'succeeded', 'failed'); -- [SPEC]

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------

create table departments (                                                            -- [built]
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (btrim(name) <> ''),
  code        text not null unique check (btrim(code) <> ''),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index departments_name_ci_key on departments (lower(btrim(name)));

create table specialties (                                                            -- [built]
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (btrim(name) <> ''),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index specialties_name_ci_key on specialties (lower(btrim(name)));

create table services (                                                               -- [ADM-07]
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (btrim(name) <> ''),
  description          text,
  department_id        uuid references departments (id) on delete set null,
  requires_appointment boolean not null default false,
  booking_mode         text not null default 'none'
                       check (booking_mode in ('none', 'doctor_consultation', 'walk_in')),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index services_name_ci_key on services (lower(btrim(name)));

-- Requirements attach to a service, a specialty, or both.
create table service_requirements (                                                   -- [ADM-08]
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (btrim(title) <> ''),
  description    text,
  service_id     uuid references services (id) on delete restrict,
  specialty_id   uuid references specialties (id) on delete restrict,
  is_mandatory   boolean not null default true,
  effective_from date not null default ((now() at time zone 'Asia/Manila')::date),
  effective_to   date,
  status         text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (service_id is not null or specialty_id is not null),
  check (effective_to is null or effective_to >= effective_from)
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per user of any role. Walk-in patients have auth_user_id = null.
create table profiles (                                                               -- [built]
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  role          user_role not null default 'patient',
  full_name     text not null check (btrim(full_name) <> ''),
  department_id uuid references departments (id) on delete set null,
  specialty     text,          -- legacy free text, no longer read
  phone         text,
  clinic_note   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 1:1 extension of a doctor profile (doctors.id = profiles.id).
create table doctors (                                                                -- [built]
  id            uuid primary key references profiles (id) on delete restrict,
  department_id uuid references departments (id) on delete set null
                check (department_id is not null),
  full_name     text not null check (btrim(full_name) <> ''),
  is_active     boolean not null default true,
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  bio           text check (bio is null or char_length(bio) <= 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index doctors_department_idx on doctors (department_id);

-- M:N doctors <-> specialties.
create table doctor_specialties (                                                     -- [built]
  doctor_id    uuid not null references doctors (id) on delete cascade,
  specialty_id uuid not null references specialties (id) on delete restrict,
  primary key (doctor_id, specialty_id)
);
create index doctor_specialties_specialty_idx on doctor_specialties (specialty_id);

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------

create table doctor_schedules (                                                       -- [built]
  id                    uuid primary key default gen_random_uuid(),
  doctor_id             uuid not null references doctors (id) on delete cascade,
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
create index doctor_schedules_doctor_day_idx on doctor_schedules (doctor_id, day_of_week);

-- Exceptions only remove availability; added hours are doctor_schedules periods.
create table schedule_exceptions (                                                    -- [built]
  id                    uuid primary key default gen_random_uuid(),
  doctor_id             uuid references doctors (id) on delete cascade,  -- null = hospital-wide holiday [ADM-06]
  start_datetime        timestamptz not null,
  end_datetime          timestamptz not null,
  reason                text not null check (btrim(reason) <> ''),
  exception_type        schedule_exception_type not null default 'blocked_period',
  created_by_profile_id uuid references profiles (id) on delete restrict,  -- [ADM-06]
  created_at            timestamptz not null default now(),
  constraint schedule_exceptions_time_order check (end_datetime > start_datetime)
);
create index schedule_exceptions_doctor_range_idx on schedule_exceptions (doctor_id, start_datetime);

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------

create table appointments (                                                           -- [built]
  id                      uuid primary key default gen_random_uuid(),
  doctor_id               uuid not null references doctors (id) on delete restrict,
  patient_id              uuid not null references profiles (id) on delete restrict,
  specialty_id            uuid references specialties (id) on delete set null,
  department_id           uuid references departments (id) on delete set null,  -- [ADM-09]
  service_id              uuid references services (id) on delete set null,     -- [ADM-09]
  scheduled_at            timestamptz not null,
  scheduled_end_at        timestamptz not null,   -- trigger-maintained
  duration_minutes        integer not null default 30 check (duration_minutes between 5 and 480),
  status                  appointment_status not null default 'requested',
  reason                  text,
  booking_source          booking_source not null default 'other',
  created_by_profile_id   uuid references profiles (id) on delete set null,
  confirmed_by_profile_id uuid references profiles (id) on delete set null,
  confirmed_at            timestamptz,
  rejection_reason        text,
  cancellation_reason     text,
  cancelled_by_role       user_role,
  cancelled_at            timestamptz,                                           -- [ADM-09]
  completed_at            timestamptz,                                           -- [ADM-09]
  no_show_at              timestamptz,                                           -- [ADM-09]
  rescheduled_from_at     timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint appointments_rejection_reason_required
    check (status <> 'rejected' or btrim(coalesce(rejection_reason, '')) <> ''),
  constraint appointments_no_active_overlap exclude using gist (
    doctor_id with =,
    tstzrange(scheduled_at, scheduled_end_at, '[)') with &&
  ) where (status in ('requested', 'confirmed', 'checked_in'))
);
create index appointments_doctor_scheduled_at_idx on appointments (doctor_id, scheduled_at);
create index appointments_patient_scheduled_at_idx on appointments (patient_id, scheduled_at);

-- Legacy history; superseded by appointment_audit_logs (0007) but not dropped.
create table appointment_status_history (                                             -- [built]
  id                    uuid primary key default gen_random_uuid(),
  appointment_id        uuid not null references appointments (id) on delete cascade,
  from_status           appointment_status,
  to_status             appointment_status not null,
  changed_by_profile_id uuid references profiles (id) on delete set null,
  reason                text,
  scheduled_at_snapshot timestamptz,
  created_at            timestamptz not null default now()
);
create index appointment_status_history_appointment_idx
  on appointment_status_history (appointment_id, created_at);

-- Append-only (update/delete/truncate rejected by trigger).
create table appointment_audit_logs (                                                 -- [built]
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references appointments (id) on delete restrict,
  actor_profile_id uuid references profiles (id) on delete restrict,
  action           text not null check (action in (
                     'created', 'confirmed', 'rejected', 'cancelled',
                     'rescheduled', 'checked_in', 'completed', 'no_show'
                   )),
  previous_status  appointment_status,
  new_status       appointment_status not null,
  previous_values  jsonb,
  new_values       jsonb,
  reason           text,
  created_at       timestamptz not null default now()
);
create index appointment_audit_logs_appointment_idx
  on appointment_audit_logs (appointment_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- doctor_id references profiles (not doctors) — unchanged since 0002.
create table doctor_notifications (                                                   -- [built]
  id             uuid primary key default gen_random_uuid(),
  doctor_id      uuid not null references profiles (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  type           doctor_notification_type not null,
  title          text not null check (btrim(title) <> ''),
  body           text not null default '',
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index doctor_notifications_doctor_created_idx
  on doctor_notifications (doctor_id, created_at desc);
create index doctor_notifications_doctor_unread_idx
  on doctor_notifications (doctor_id) where read_at is null;

-- Shape mirrors doctor_notifications; exact design decided in FD-001 PR 9.
create table patient_notifications (                                                  -- [FD-9]
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references profiles (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  type           patient_notification_type not null,
  title          text not null check (btrim(title) <> ''),
  body           text not null default '',
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index patient_notifications_patient_created_idx
  on patient_notifications (patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Chat (Cami)
-- ---------------------------------------------------------------------------

create table chat_conversations (                                                     -- [built]
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  booking_state jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index chat_conversations_patient_updated_idx
  on chat_conversations (patient_id, updated_at desc);

create table chat_messages (                                                          -- [built]
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (char_length(content) between 1 and 4000),
  payload         jsonb,
  created_at      timestamptz not null default now()
);
create index chat_messages_conversation_created_idx on chat_messages (conversation_id, created_at);
create index chat_messages_created_idx on chat_messages (created_at);

-- ---------------------------------------------------------------------------
-- Knowledge base (RAG)
-- ---------------------------------------------------------------------------

-- [built] table; lifecycle columns from ADM-13. `status` replaces the
-- built is_published flag. Versions are a counter on the row (no separate
-- knowledge_document_versions table).
create table knowledge_documents (                                                    -- [built]
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                   text not null check (char_length(title) between 1 and 200),
  category                kb_category not null default 'other_patient_info',  -- [ADM-13]
  content                 text,                                               -- [ADM-13]
  source_file_path        text,                                               -- [ADM-13]
  content_hash            text not null,
  version                 integer not null default 1 check (version >= 1),
  status                  kb_status not null default 'draft',                 -- [ADM-13]
  processing_status       kb_processing not null default 'pending',           -- [ADM-13]
  processing_error        text,                                               -- [ADM-13]
  published_at            timestamptz,                                        -- [ADM-13]
  published_by_profile_id uuid references profiles (id) on delete restrict,   -- [ADM-13]
  archived_at             timestamptz,                                        -- [ADM-13]
  created_by_profile_id   uuid references profiles (id) on delete restrict,   -- [ADM-13] null for CLI-ingested docs
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- [built] table; ADM-14 adds token_count and is_active (replacing the built
-- is_published flag) and keys chunks by version so old ones serve until new
-- ones are ready.
create table knowledge_chunks (                                                       -- [built]
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references knowledge_documents (id) on delete cascade,
  document_version integer not null,
  chunk_index      integer not null check (chunk_index >= 0),
  section_title    text,
  content          text not null check (char_length(content) between 1 and 4000),
  content_hash     text not null,
  token_count      integer,                                                   -- [ADM-14]
  embedding        vector(768) not null,
  is_active        boolean not null default false,                            -- [ADM-14]
  created_at       timestamptz not null default now(),
  unique (document_id, document_version, chunk_index)                         -- [ADM-14]
);
create index knowledge_chunks_embedding_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- Resumable, step-bounded ingestion (SPEC §4.2). Lease/retry design is still
-- open in ADR-0004; columns are the minimum SPEC describes.
create table ingestion_jobs (                                                         -- [SPEC]
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null references knowledge_documents (id) on delete cascade,
  document_version      integer not null,
  status                ingestion_job_status not null default 'queued',
  last_chunk_index      integer,          -- checkpoint: last embedded chunk
  attempts              integer not null default 0,
  lease_expires_at      timestamptz,
  error                 text,
  created_by_profile_id uuid references profiles (id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index ingestion_jobs_document_idx on ingestion_jobs (document_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------

-- Append-only (update/delete/truncate rejected by trigger).
-- target_id is polymorphic text (no FK); target_type names the table.
create table audit_logs (                                                             -- [built]
  id               uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references profiles (id) on delete restrict,
  action           text not null check (btrim(action) <> ''),   -- e.g. 'department.update'
  target_type      text not null check (btrim(target_type) <> ''),
  target_id        text not null check (btrim(target_id) <> ''),
  previous_values  jsonb,
  new_values       jsonb,
  reason           text,
  created_at       timestamptz not null default now()
);
create index audit_logs_target_idx on audit_logs (target_type, target_id);
create index audit_logs_created_at_idx on audit_logs (created_at desc);

-- Key/value settings; allowed keys are defined in code (lib/settings/schema.ts).
create table system_settings (                                                        -- [ADM-15]
  key                   text primary key,
  value                 jsonb not null,
  updated_by_profile_id uuid references profiles (id) on delete restrict,
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Views (derived; draw outside the ERD or as a view box)
-- ---------------------------------------------------------------------------

-- [ADM-10] analytics_appointments: one row per appointment with Manila-time
-- buckets (sched_date_mnl, sched_month, weekday, hour_bucket, was_confirmed,
-- is_due). Built on appointments only; no new relationships.
