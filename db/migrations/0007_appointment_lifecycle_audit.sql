-- CamiConnect — appointment lifecycle columns and append-only audit log (FD-001, PR 1)
--
-- Run after 0006_appointment_status_values.sql has been committed, in the
-- hosted Supabase project's SQL editor.
--
-- What this migration does:
--   * adds booking source, creator, confirmer, rejection reason, and specialty
--     columns to appointments (SPEC-frontdesk §10), backfilled from history;
--   * requires a reason on rejected appointments;
--   * extends the double-booking exclusion constraint to checked_in;
--   * forbids AI-sourced appointments from being inserted in any status other
--     than requested, so the chatbot cannot bypass staff confirmation;
--   * creates appointment_audit_logs (append-only) and backfills it from
--     appointment_status_history, which becomes read-only;
--   * replaces cammi_connect_book_appointment with a version that records the
--     booking source and creator and writes the audit row.
--
-- No data is dropped. appointment_status_history keeps its rows and will be
-- dropped by a later migration once nothing reads it.
--
-- Security model is unchanged (ADR-0003): RLS enabled with no permissive
-- policies, anon/authenticated revoked, service_role only. The audit table is
-- additionally SELECT/INSERT-only for service_role and guarded by a trigger.

-- ---------------------------------------------------------------------------
-- Booking source
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.booking_source as enum (
    'ai_chatbot',
    'front_desk',
    'other'
  );
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Appointment lifecycle columns
-- ---------------------------------------------------------------------------

-- Column names follow the existing *_profile_id convention. The spec's
-- scheduled_start/scheduled_end are the existing scheduled_at and
-- scheduled_end_at columns.
alter table public.appointments
  add column if not exists booking_source public.booking_source not null default 'other',
  add column if not exists created_by_profile_id uuid
    references public.profiles (id) on delete set null,
  add column if not exists confirmed_by_profile_id uuid
    references public.profiles (id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists specialty_id uuid
    references public.specialties (id) on delete set null;

comment on column public.appointments.booking_source is
  'Where the appointment came from. ai_chatbot rows must be inserted as requested (see cammi_connect_guard_ai_booking).';
comment on column public.appointments.created_by_profile_id is
  'Who submitted the booking. Equals patient_id for self-service bookings; the staff member for front desk bookings.';

-- Backfill from the creation history row. Bookings whose creator is the
-- patient came through the patient-facing chat booking flow.
update public.appointments as appointments
  set booking_source = 'ai_chatbot',
      created_by_profile_id = history.changed_by_profile_id
  from public.appointment_status_history as history
  where history.appointment_id = appointments.id
    and history.from_status is null
    and history.changed_by_profile_id = appointments.patient_id
    and appointments.created_by_profile_id is null;

update public.appointments as appointments
  set created_by_profile_id = history.changed_by_profile_id
  from public.appointment_status_history as history
  where history.appointment_id = appointments.id
    and history.from_status is null
    and appointments.created_by_profile_id is null;

alter table public.appointments
  drop constraint if exists appointments_rejection_reason_required;
alter table public.appointments
  add constraint appointments_rejection_reason_required check (
    status <> 'rejected' or btrim(coalesce(rejection_reason, '')) <> ''
  );

-- ---------------------------------------------------------------------------
-- Double-booking guard (extends 0002 to checked_in)
-- ---------------------------------------------------------------------------

-- Keep this predicate in sync with SLOT_HOLDING_STATUSES in
-- src/lib/appointments/status.ts.
alter table public.appointments
  drop constraint if exists appointments_no_active_overlap;

alter table public.appointments
  add constraint appointments_no_active_overlap exclude using gist (
    doctor_id with =,
    tstzrange(scheduled_at, scheduled_end_at, '[)') with &&
  ) where (status in ('requested', 'confirmed', 'checked_in'));

-- ---------------------------------------------------------------------------
-- AI confirmation guard
-- ---------------------------------------------------------------------------

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

drop trigger if exists appointments_guard_ai_booking on public.appointments;
create trigger appointments_guard_ai_booking
before insert on public.appointments
for each row execute function public.cammi_connect_guard_ai_booking();

-- ---------------------------------------------------------------------------
-- Appointment audit log (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.appointment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- restrict: an audited appointment cannot be deleted.
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  -- restrict: a set-null cascade would be an UPDATE, which the log forbids.
  actor_profile_id uuid references public.profiles (id) on delete restrict,
  action text not null check (
    action in (
      'created',
      'confirmed',
      'rejected',
      'cancelled',
      'rescheduled',
      'checked_in',
      'completed',
      'no_show'
    )
  ),
  previous_status public.appointment_status,
  new_status public.appointment_status not null,
  previous_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.appointment_audit_logs is
  'Append-only audit history of appointment actions (FD-001). previous_status is null only for the created row. Rows cannot be updated or deleted.';

create index if not exists appointment_audit_logs_appointment_idx
  on public.appointment_audit_logs (appointment_id, created_at);

-- Backfill from the old history table. Ids are reused so a re-run is a no-op.
insert into public.appointment_audit_logs (
  id, appointment_id, actor_profile_id, action, previous_status, new_status,
  new_values, reason, created_at
)
select
  history.id,
  history.appointment_id,
  history.changed_by_profile_id,
  case
    when history.from_status is null then 'created'
    when history.from_status = history.to_status then 'rescheduled'
    else history.to_status::text
  end,
  history.from_status,
  history.to_status,
  case
    when history.scheduled_at_snapshot is not null
      then jsonb_build_object('scheduled_at', history.scheduled_at_snapshot)
  end,
  history.reason,
  history.created_at
from public.appointment_status_history as history
on conflict (id) do nothing;

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

drop trigger if exists appointment_audit_logs_immutable on public.appointment_audit_logs;
create trigger appointment_audit_logs_immutable
before update or delete on public.appointment_audit_logs
for each row execute function public.cammi_connect_reject_audit_log_change();

drop trigger if exists appointment_audit_logs_no_truncate on public.appointment_audit_logs;
create trigger appointment_audit_logs_no_truncate
before truncate on public.appointment_audit_logs
for each statement execute function public.cammi_connect_reject_audit_log_change();

alter table public.appointment_audit_logs enable row level security;

revoke all on table public.appointment_audit_logs from anon, authenticated, service_role;
grant select, insert on table public.appointment_audit_logs to service_role;

-- ---------------------------------------------------------------------------
-- Retire appointment_status_history (read-only from now on)
-- ---------------------------------------------------------------------------

comment on table public.appointment_status_history is
  'Deprecated by appointment_audit_logs (0007). Read-only; kept until a later migration drops it.';

revoke insert, update, delete, truncate on table public.appointment_status_history
  from service_role;

-- ---------------------------------------------------------------------------
-- Book appointment (records booking source and creator, writes the audit row)
-- ---------------------------------------------------------------------------

drop function if exists public.cammi_connect_book_appointment(uuid, uuid, timestamptz, text);

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
