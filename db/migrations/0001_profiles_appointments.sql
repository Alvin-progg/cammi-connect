-- CamiConnect — profiles and appointments
--
-- Run this file once in the hosted Supabase project's SQL editor.
-- There is no local/CI database in this slice and no automated migration
-- runner, so this file is the schema source of truth until that changes.
--
-- Security model:
--   * RLS is enabled on both tables with no permissive policies.
--   * The browser never reads these tables directly.
--   * Server code uses the service-role key, which bypasses RLS. Application
--     authorization is therefore the runtime gate for every query.
--   * anon/authenticated table privileges are revoked explicitly as defense in
--     depth; the service role keeps its access.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.user_role as enum ('patient', 'doctor', 'admin');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.appointment_status as enum (
    'requested',
    'confirmed',
    'completed',
    'cancelled',
    'no_show'
  );
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  role public.user_role not null default 'patient',
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> '')
);

comment on table public.profiles is
  'Application profile for patients, doctors, and admins. auth_user_id is null for synthetic seed profiles and set for real Supabase Auth users.';

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete restrict,
  patient_id uuid not null references public.profiles (id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30
    check (duration_minutes between 5 and 480),
  status public.appointment_status not null default 'requested',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.appointments is
  'Appointment requests and confirmed visits. Doctor_id must reference a profile with role = doctor; this is enforced by the service layer in the current slice.';

create index if not exists appointments_doctor_scheduled_at_idx
  on public.appointments (doctor_id, scheduled_at);

create index if not exists appointments_patient_scheduled_at_idx
  on public.appointments (patient_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.cammi_connect_set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.cammi_connect_set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth-user provisioning
-- ---------------------------------------------------------------------------

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

drop trigger if exists cammi_connect_auth_user_created on auth.users;
create trigger cammi_connect_auth_user_created
after insert on auth.users
for each row execute function public.cammi_connect_handle_new_auth_user();

-- Backfill accounts that existed before this migration.
insert into public.profiles (auth_user_id, role, full_name)
select
  users.id,
  'patient',
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Patient'
  )
from auth.users as users
on conflict (auth_user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.appointments enable row level security;

-- No permissive policies are created on purpose. With RLS enabled and no
-- policies, the anon/authenticated Data API roles see zero rows and cannot
-- write. Server code must use the service role and enforce authorization in
-- the service/data layer.

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;

grant all on table public.profiles to service_role;
grant all on table public.appointments to service_role;

-- Ask PostgREST to refresh its schema cache so the seed and dashboard see the
-- new tables immediately after running this migration.
notify pgrst, 'reload schema';
