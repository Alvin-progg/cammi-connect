-- CamiConnect — doctor, specialty, and schedule management (DOC-SCH-001)
--
-- Adds a managed specialty catalogue, a doctors table (1:1 extension of
-- profiles), multiple effective-dated schedule periods per weekday, typed
-- schedule exceptions, and transactional functions for saving doctors and
-- booking appointments. Run after 0002_doctor_dashboard_suite.sql in the
-- hosted Supabase project's SQL editor.
--
-- No data is dropped. This migration renames doctor_blocked_slots to
-- schedule_exceptions and drops the doctor_schedules_day_unique constraint so
-- a weekday can hold several consultation periods.
--
-- Security model is unchanged from 0001/0002: RLS enabled with no permissive
-- policies, anon/authenticated revoked, service_role only. The functions are
-- executable by service_role only.

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------

alter table public.departments
  add column if not exists description text,
  add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- Specialties
-- ---------------------------------------------------------------------------

create table if not exists public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.specialties is
  'Managed catalogue of medical specialties. Linked to doctors through doctor_specialties.';

-- ---------------------------------------------------------------------------
-- Doctors (1:1 extension of profiles)
-- ---------------------------------------------------------------------------

create table if not exists public.doctors (
  id uuid primary key references public.profiles (id) on delete restrict,
  department_id uuid references public.departments (id) on delete set null,
  full_name text not null check (btrim(full_name) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.doctors is
  'Doctor directory entry. id is the doctor profile id; the login (if any) is profiles.auth_user_id.';

create index if not exists doctors_department_idx
  on public.doctors (department_id);

drop trigger if exists doctors_set_updated_at on public.doctors;
create trigger doctors_set_updated_at
before update on public.doctors
for each row execute function public.cammi_connect_set_updated_at();

insert into public.doctors (id, department_id, full_name)
select profiles.id, profiles.department_id, profiles.full_name
from public.profiles as profiles
where profiles.role = 'doctor'
on conflict (id) do nothing;

create table if not exists public.doctor_specialties (
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id) on delete restrict,
  primary key (doctor_id, specialty_id)
);

create index if not exists doctor_specialties_specialty_idx
  on public.doctor_specialties (specialty_id);

-- Backfill the catalogue from the free-text profiles.specialty column, which
-- stays in place but is no longer read by the application.
insert into public.specialties (name)
select distinct btrim(profiles.specialty)
from public.profiles as profiles
where profiles.role = 'doctor'
  and btrim(coalesce(profiles.specialty, '')) <> ''
on conflict (name) do nothing;

insert into public.doctor_specialties (doctor_id, specialty_id)
select profiles.id, specialties.id
from public.profiles as profiles
join public.specialties as specialties
  on specialties.name = btrim(profiles.specialty)
where profiles.role = 'doctor'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Doctor weekly schedules: multiple effective-dated periods per weekday
-- ---------------------------------------------------------------------------

alter table public.doctor_schedules
  drop constraint if exists doctor_schedules_day_unique;

alter table public.doctor_schedules
  add column if not exists effective_from date,
  add column if not exists effective_until date;

update public.doctor_schedules
  set effective_from = (created_at at time zone 'Asia/Manila')::date
  where effective_from is null;

alter table public.doctor_schedules
  alter column effective_from set not null,
  alter column effective_from set default ((now() at time zone 'Asia/Manila')::date);

alter table public.doctor_schedules
  drop constraint if exists doctor_schedules_effective_order;

alter table public.doctor_schedules
  add constraint doctor_schedules_effective_order
  check (effective_until is null or effective_until >= effective_from);

-- Active periods for the same doctor and weekday may not overlap in time while
-- their effective date ranges overlap. Times are anchored to a fixed date so
-- the range expression is IMMUTABLE and valid inside the constraint.
alter table public.doctor_schedules
  drop constraint if exists doctor_schedules_no_active_overlap;

alter table public.doctor_schedules
  add constraint doctor_schedules_no_active_overlap exclude using gist (
    doctor_id with =,
    day_of_week with =,
    daterange(effective_from, effective_until, '[]') with &&,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time, '[)') with &&
  ) where (is_active);

create index if not exists doctor_schedules_doctor_day_idx
  on public.doctor_schedules (doctor_id, day_of_week);

alter table public.doctor_schedules
  drop constraint if exists doctor_schedules_doctor_id_fkey;

alter table public.doctor_schedules
  add constraint doctor_schedules_doctor_id_fkey
  foreign key (doctor_id) references public.doctors (id) on delete cascade;

comment on table public.doctor_schedules is
  'Recurring weekly consultation periods per doctor. A weekday may have several periods. day_of_week is 0-6, Sunday-first; times and effective dates are Asia/Manila.';

-- ---------------------------------------------------------------------------
-- Schedule exceptions (formerly doctor_blocked_slots)
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.schedule_exception_type as enum (
    'leave',
    'blocked_period',
    'unavailable_date',
    'temporary_change'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  if to_regclass('public.doctor_blocked_slots') is not null
    and to_regclass('public.schedule_exceptions') is null then
    alter table public.doctor_blocked_slots rename to schedule_exceptions;
    alter table public.schedule_exceptions rename column starts_at to start_datetime;
    alter table public.schedule_exceptions rename column ends_at to end_datetime;
    alter table public.schedule_exceptions
      rename constraint doctor_blocked_slots_time_order to schedule_exceptions_time_order;
    alter index public.doctor_blocked_slots_doctor_range_idx
      rename to schedule_exceptions_doctor_range_idx;
  end if;
end;
$$;

alter table public.schedule_exceptions
  add column if not exists exception_type public.schedule_exception_type
    not null default 'blocked_period';

alter table public.schedule_exceptions
  drop constraint if exists doctor_blocked_slots_doctor_id_fkey;

alter table public.schedule_exceptions
  drop constraint if exists schedule_exceptions_doctor_id_fkey;

alter table public.schedule_exceptions
  add constraint schedule_exceptions_doctor_id_fkey
  foreign key (doctor_id) references public.doctors (id) on delete cascade;

comment on table public.schedule_exceptions is
  'Date/time intervals where the doctor is unavailable. Exceptions only remove availability; temporary added hours are effective-dated schedule periods.';

-- ---------------------------------------------------------------------------
-- Appointments reference doctors
-- ---------------------------------------------------------------------------

alter table public.appointments
  drop constraint if exists appointments_doctor_id_fkey;

alter table public.appointments
  add constraint appointments_doctor_id_fkey
  foreign key (doctor_id) references public.doctors (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Save doctor (atomic profile role + directory entry + specialty set)
-- ---------------------------------------------------------------------------

-- Creates or updates a doctor in one transaction. With p_doctor_id null, a
-- new login-less profile is created. With an existing profile id, that
-- profile is promoted to the doctor role. Authorization (admin only) is
-- enforced by the calling server code.
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

-- ---------------------------------------------------------------------------
-- Book appointment (atomic availability re-check + insert + history)
-- ---------------------------------------------------------------------------

-- Raises P0001 with message inactive_doctor, past, outside_hours, or blocked.
-- An overlapping active appointment fails on appointments_no_active_overlap
-- (SQLSTATE 23P01). The patient id must come from the authenticated session;
-- the calling server code enforces that.
create or replace function public.cammi_connect_book_appointment(
  p_doctor_id uuid,
  p_patient_id uuid,
  p_scheduled_at timestamptz,
  p_reason text
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
    doctor_id, patient_id, scheduled_at, duration_minutes, status, reason
  )
  values (
    p_doctor_id, p_patient_id, p_scheduled_at, v_duration, 'requested',
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  returning id into v_appointment_id;

  insert into public.appointment_status_history (
    appointment_id, from_status, to_status, changed_by_profile_id,
    scheduled_at_snapshot
  )
  values (
    v_appointment_id, null, 'requested', p_patient_id, p_scheduled_at
  );

  return v_appointment_id;
end;
$$;

revoke all on function public.cammi_connect_book_appointment(uuid, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_book_appointment(uuid, uuid, timestamptz, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security (same model as 0001/0002)
-- ---------------------------------------------------------------------------

alter table public.specialties enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_specialties enable row level security;
alter table public.schedule_exceptions enable row level security;

revoke all on table public.specialties from anon, authenticated;
revoke all on table public.doctors from anon, authenticated;
revoke all on table public.doctor_specialties from anon, authenticated;
revoke all on table public.schedule_exceptions from anon, authenticated;

grant all on table public.specialties to service_role;
grant all on table public.doctors to service_role;
grant all on table public.doctor_specialties to service_role;
grant all on table public.schedule_exceptions to service_role;

notify pgrst, 'reload schema';
