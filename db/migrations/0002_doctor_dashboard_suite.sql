-- CamiConnect — doctor dashboard suite
--
-- Adds departments, doctor profile details, appointment cancellation metadata,
-- appointment status history, weekly doctor schedules, blocked slots, and
-- doctor notifications. Run after 0001_profiles_appointments.sql in the hosted
-- Supabase project's SQL editor.
--
-- Security model is unchanged from 0001: RLS enabled with no permissive
-- policies, anon/authenticated revoked, service_role only.

-- ---------------------------------------------------------------------------
-- Departments and doctor profile details
-- ---------------------------------------------------------------------------

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  code text not null unique check (btrim(code) <> ''),
  created_at timestamptz not null default now()
);

comment on table public.departments is
  'Hospital departments used for doctor assignment and dashboard grouping.';

alter table public.profiles
  add column if not exists department_id uuid references public.departments (id) on delete set null,
  add column if not exists specialty text,
  add column if not exists phone text,
  add column if not exists clinic_note text;

-- ---------------------------------------------------------------------------
-- Appointment cancellation / reschedule metadata
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by_role public.user_role,
  add column if not exists rescheduled_from_at timestamptz;

-- Prevent overlapping active appointments per doctor. The service layer
-- rejects overlaps with friendly errors; this constraint is the database
-- backstop.
--
-- Note: the end timestamp is stored in a trigger-maintained column because
-- `timestamptz + interval` is STABLE (timezone-dependent), and PostgreSQL
-- rejects non-IMMUTABLE expressions inside index/exclusion constraints.
-- `tstzrange(scheduled_at, scheduled_end_at, '[)')` only uses immutable
-- columns and constructors, so the exclusion constraint is valid.
alter table public.appointments
  add column if not exists scheduled_end_at timestamptz;

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

drop trigger if exists appointments_set_scheduled_end on public.appointments;
create trigger appointments_set_scheduled_end
before insert or update of scheduled_at, duration_minutes on public.appointments
for each row execute function public.cammi_connect_set_appointment_end();

-- Backfill rows created before this migration, then enforce the invariant.
update public.appointments
  set scheduled_end_at =
    scheduled_at + make_interval(mins => duration_minutes)
  where scheduled_end_at is null;

alter table public.appointments
  alter column scheduled_end_at set not null;

create extension if not exists btree_gist;

alter table public.appointments
  drop constraint if exists appointments_no_active_overlap;

alter table public.appointments
  add constraint appointments_no_active_overlap exclude using gist (
    doctor_id with =,
    tstzrange(scheduled_at, scheduled_end_at, '[)') with &&
  ) where (status in ('requested', 'confirmed'));

-- ---------------------------------------------------------------------------
-- Appointment status history
-- ---------------------------------------------------------------------------

create table if not exists public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by_profile_id uuid references public.profiles (id) on delete set null,
  reason text,
  scheduled_at_snapshot timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.appointment_status_history is
  'Audit log of status transitions and reschedules. from_status is null only for the initial creation row.';

create index if not exists appointment_status_history_appointment_idx
  on public.appointment_status_history (appointment_id, created_at);

-- ---------------------------------------------------------------------------
-- Doctor weekly schedules and blocked slots
-- ---------------------------------------------------------------------------

create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_duration_minutes integer not null default 30
    check (slot_duration_minutes in (15, 30, 45, 60)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_schedules_day_unique unique (doctor_id, day_of_week),
  constraint doctor_schedules_time_order check (end_time > start_time)
);

comment on table public.doctor_schedules is
  'Regular weekly consultation windows per doctor. day_of_week is 0-6, Sunday-first, interpreted in Asia/Manila.';

drop trigger if exists doctor_schedules_set_updated_at on public.doctor_schedules;
create trigger doctor_schedules_set_updated_at
before update on public.doctor_schedules
for each row execute function public.cammi_connect_set_updated_at();

create table if not exists public.doctor_blocked_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  constraint doctor_blocked_slots_time_order check (ends_at > starts_at)
);

comment on table public.doctor_blocked_slots is
  'Date/time intervals where the doctor is unavailable (rounds, leave, meetings).';

create index if not exists doctor_blocked_slots_doctor_range_idx
  on public.doctor_blocked_slots (doctor_id, starts_at);

-- ---------------------------------------------------------------------------
-- Doctor notifications
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.doctor_notification_type as enum (
    'new_request',
    'cancelled',
    'rescheduled',
    'reminder'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.doctor_notifications (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  type public.doctor_notification_type not null,
  title text not null check (btrim(title) <> ''),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.doctor_notifications is
  'Doctor-facing notifications for appointment events. Upcoming-consultation reminders are computed, not stored.';

create index if not exists doctor_notifications_doctor_created_idx
  on public.doctor_notifications (doctor_id, created_at desc);

create index if not exists doctor_notifications_doctor_unread_idx
  on public.doctor_notifications (doctor_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- Row Level Security (same model as 0001: deny by default, service role only)
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.doctor_blocked_slots enable row level security;
alter table public.doctor_notifications enable row level security;

revoke all on table public.departments from anon, authenticated;
revoke all on table public.appointment_status_history from anon, authenticated;
revoke all on table public.doctor_schedules from anon, authenticated;
revoke all on table public.doctor_blocked_slots from anon, authenticated;
revoke all on table public.doctor_notifications from anon, authenticated;

grant all on table public.departments to service_role;
grant all on table public.appointment_status_history to service_role;
grant all on table public.doctor_schedules to service_role;
grant all on table public.doctor_blocked_slots to service_role;
grant all on table public.doctor_notifications to service_role;

notify pgrst, 'reload schema';
