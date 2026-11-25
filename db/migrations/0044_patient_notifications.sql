-- CamiConnect — patient in-app notifications
--
-- Run in the hosted Supabase project's SQL editor. This file can run in one go.
--
-- Patients hear about front desk and payment decisions in the chat bell. Like
-- doctor_notifications (0002/0029), rows are written by triggers in the same
-- transaction as the change, so a rolled-back change leaves no notification.
--
-- Appointment events (appointments trigger):
--   requested -> confirmed               confirmed
--   -> rejected                          rejected
--   -> cancelled by front desk/doctor/
--      admin (not the patient, and not
--      a system expiry, which the
--      payment_expired row covers)       cancelled
--   scheduled_at changed                 rescheduled
--
-- Payment events (payments trigger; 0036, 0037, 0039):
--   -> verified                          payment_verified
--   -> rejected                          payment_rejected
--   -> hmo_approved                      hmo_approved
--   hmo_pending -> any other status      hmo_denied (self-pay or counter)
--   -> expired                           payment_expired
--
-- Bodies are fixed text plus the Manila visit time. They never carry amounts,
-- member numbers, or rejection reasons. Walk-in patients have no sign-in, so
-- no row is written for them. Access follows ADR-0003: RLS on, no policies,
-- and no anon/authenticated access.

do $$
begin
  create type public.patient_notification_type as enum (
    'confirmed',
    'rejected',
    'cancelled',
    'rescheduled',
    'payment_verified',
    'payment_rejected',
    'hmo_approved',
    'hmo_denied',
    'payment_expired'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.patient_notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  type public.patient_notification_type not null,
  title text not null check (btrim(title) <> ''),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.patient_notifications is
  'Patient-facing in-app notifications for front desk and payment decisions. Written by triggers.';

create index if not exists patient_notifications_patient_created_idx
  on public.patient_notifications (patient_id, created_at desc);

create index if not exists patient_notifications_patient_unread_idx
  on public.patient_notifications (patient_id)
  where read_at is null;

alter table public.patient_notifications enable row level security;
revoke all on public.patient_notifications from anon, authenticated;

create or replace function public.cammi_connect_notify_patient_appointment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_has_sign_in boolean;
  v_when text;
  v_type public.patient_notification_type;
  v_title text;
  v_body text;
begin
  select auth_user_id is not null into v_has_sign_in
  from public.profiles
  where id = new.patient_id;
  if not coalesce(v_has_sign_in, false) then
    return null;
  end if;

  v_when := to_char(
    new.scheduled_at at time zone 'Asia/Manila',
    'Dy, Mon FMDD" · "FMHH12:MI AM'
  );

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status = 'requested' then
      v_type := 'confirmed';
      v_title := 'Your appointment is confirmed';
      v_body := v_when;
    elsif new.status = 'rejected' then
      v_type := 'rejected';
      v_title := 'Your request was not approved';
      v_body := 'Open My appointments for details.';
    elsif new.status = 'cancelled'
      and new.cancelled_by_role in ('front_desk', 'doctor', 'admin') then
      v_type := 'cancelled';
      v_title := 'Your appointment was cancelled';
      v_body := v_when;
    end if;
  elsif tg_op = 'UPDATE' and new.scheduled_at is distinct from old.scheduled_at then
    v_type := 'rescheduled';
    v_title := 'Your appointment was moved';
    v_body := 'New time: ' || v_when;
  end if;

  if v_type is not null then
    insert into public.patient_notifications (patient_id, appointment_id, type, title, body)
    values (new.patient_id, new.id, v_type, v_title, v_body);
  end if;

  return null;
end;
$$;

revoke all on function public.cammi_connect_notify_patient_appointment()
  from public, anon, authenticated;

drop trigger if exists appointments_notify_patient on public.appointments;
create trigger appointments_notify_patient
after update on public.appointments
for each row execute function public.cammi_connect_notify_patient_appointment();

create or replace function public.cammi_connect_notify_patient_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_has_sign_in boolean;
  v_type public.patient_notification_type;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'verified' then
    v_type := 'payment_verified';
    v_title := 'Payment verified';
    v_body := 'Your payment receipt was verified.';
  elsif new.status = 'rejected' then
    v_type := 'payment_rejected';
    v_title := 'Receipt needs another try';
    v_body := 'Open My appointments to upload a new receipt.';
  elsif new.status = 'hmo_approved' then
    v_type := 'hmo_approved';
    v_title := 'HMO coverage approved';
    v_body := 'Your HMO coverage was approved for this visit.';
  elsif new.status = 'expired' then
    v_type := 'payment_expired';
    v_title := 'Your request expired unpaid';
    v_body := 'The payment deadline passed.';
  elsif old.status = 'hmo_pending' then
    v_type := 'hmo_denied';
    v_title := 'HMO coverage was not approved';
    v_body := 'Open My appointments for the payment options.';
  end if;

  if v_type is null then
    return null;
  end if;

  select appointments.patient_id, profiles.auth_user_id is not null
  into v_patient_id, v_has_sign_in
  from public.appointments as appointments
  join public.profiles as profiles on profiles.id = appointments.patient_id
  where appointments.id = new.appointment_id;

  if coalesce(v_has_sign_in, false) then
    insert into public.patient_notifications (patient_id, appointment_id, type, title, body)
    values (v_patient_id, new.appointment_id, v_type, v_title, v_body);
  end if;

  return null;
end;
$$;

revoke all on function public.cammi_connect_notify_patient_payment()
  from public, anon, authenticated;

drop trigger if exists payments_notify_patient on public.payments;
create trigger payments_notify_patient
after update of status on public.payments
for each row execute function public.cammi_connect_notify_patient_payment();
