-- CamiConnect — automatic expiry of unpaid requests and receipt retention
-- (PAY-001 slice PAY-08)
--
-- Run after 0038_service_booking.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go, and again (every step is idempotent).
--
--   * user_role gains 'system' for appointments.cancelled_by_role (ADR-0007
--     amendment, "System cancellation"). A profile can never take it
--     (profiles_role_not_system); the value is unused until this file has
--     committed, so the check lists the four real roles instead.
--   * cammi_connect_expire_unpaid(): cancels every `requested` appointment
--     whose payment is awaiting_payment or rejected and past its deadline
--     (D2). The appointment becomes cancelled (cancelled_by_role 'system',
--     reason "Payment not received", an appointment_audit_logs row), the
--     payment expired (a payment_events row), and Cami's templated Expired
--     message is appended to the patient's latest conversation with a
--     payment_update payload, which the model never sees. Cancelling
--     releases the slot: appointments_no_active_overlap and the service load
--     count only holding statuses. A submitted receipt or a pending HMO check
--     never expires; a person decides. Rows another transaction holds (a
--     verify or an upload in flight) are skipped and picked up on the next
--     run, so concurrent runs are safe. Returns how many requests expired.
--   * The pg_cron job 'cammi-connect-expire-unpaid' runs it every 5 minutes,
--     scheduled here only when the pg_cron extension is installed. Otherwise
--     enable pg_cron and re-run the block at the end (db/README.md, 0039).
--     Between a deadline and the next run the front desk still sees the
--     request as Overdue.
--   * cammi_connect_notify_doctor (body from 0038): a system cancellation
--     reads "cancelled by the system (request expired)".
--   * payment_receipts.purged_at and cammi_connect_mark_receipts_purged (D5,
--     ADR-0005 amendment): `npm run payments:purge-receipts` deletes receipt
--     images 90 days after the payment closed (src/lib/billing/retention.ts)
--     through the Storage API, then marks the rows. Payment rows, receipt
--     rows, and history stay.
--
-- Authorization follows ADR-0003: execute is revoked from public, anon, and
-- authenticated and granted to service_role only (pg_cron runs the job as
-- the migration's owner).

-- ---------------------------------------------------------------------------
-- The system as a cancelling role
-- ---------------------------------------------------------------------------

alter type public.user_role add value if not exists 'system';

alter table public.profiles drop constraint if exists profiles_role_not_system;
alter table public.profiles
  add constraint profiles_role_not_system
  check (role in ('patient', 'doctor', 'admin', 'front_desk'));

-- ---------------------------------------------------------------------------
-- cammi_connect_expire_unpaid
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_expire_unpaid()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
  v_reason constant text := 'Payment not received';
  v_target text;
  v_when text;
  v_conversation_id uuid;
begin
  for v_row in
    select
      payments.id as payment_id,
      payments.status as payment_status,
      payments.deadline_at,
      payments.charge_id,
      appointments.id as appointment_id,
      appointments.patient_id,
      appointments.doctor_id,
      appointments.scheduled_at
    from public.payments as payments
    join public.appointments as appointments on appointments.id = payments.appointment_id
    where payments.status in ('awaiting_payment', 'rejected')
      and payments.deadline_at < now()
      and appointments.status = 'requested'
    order by payments.deadline_at
    for update of payments, appointments skip locked
  loop
    update public.appointments
    set status = 'cancelled',
        cancellation_reason = v_reason,
        cancelled_by_role = 'system'
    where id = v_row.appointment_id;

    insert into public.appointment_audit_logs (
      appointment_id, actor_profile_id, action, previous_status, new_status,
      new_values, reason
    )
    values (
      v_row.appointment_id, null, 'cancelled', 'requested', 'cancelled',
      jsonb_build_object(
        'cancelled_at', now(),
        'scheduled_at', v_row.scheduled_at,
        'payment_deadline_at', v_row.deadline_at
      ),
      v_reason
    );

    update public.payments
    set status = 'expired'
    where id = v_row.payment_id;

    insert into public.payment_events (
      payment_id, actor_profile_id, action, previous_status, new_status, new_values, reason
    )
    values (
      v_row.payment_id, null, 'expired', v_row.payment_status, 'expired',
      jsonb_build_object('deadline_at', v_row.deadline_at),
      v_reason
    );

    -- Cami's Expired text (PAY-001 "What Cami says"), templated here so it
    -- needs no app process.
    if v_row.doctor_id is not null then
      select case when doctors.full_name ~* '^dr\.?\s' then doctors.full_name
                  else 'Dr. ' || doctors.full_name end
      into v_target
      from public.doctors as doctors
      where doctors.id = v_row.doctor_id;
    else
      select string_agg(items.description, ' + ' order by items.line_number)
      into v_target
      from public.appointment_charge_items as items
      where items.charge_id = v_row.charge_id;
    end if;
    v_target := coalesce(v_target, 'your visit');
    v_when := to_char(v_row.scheduled_at at time zone 'Asia/Manila', 'FMDD Mon, FMHH12:MI AM');

    select conversations.id
    into v_conversation_id
    from public.chat_conversations as conversations
    where conversations.patient_id = v_row.patient_id
    order by conversations.updated_at desc
    limit 1;

    if v_conversation_id is not null then
      insert into public.chat_messages (conversation_id, role, content, payload)
      values (
        v_conversation_id,
        'assistant',
        'Your request for ' || v_target || ' on ' || v_when
          || ' was cancelled because payment wasn''t received in time. You can book again anytime.',
        '{"kind":"payment_update"}'::jsonb
      );

      update public.chat_conversations
      set updated_at = now()
      where id = v_conversation_id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.cammi_connect_expire_unpaid()
  from public, anon, authenticated;
grant execute on function public.cammi_connect_expire_unpaid()
  to service_role;

-- ---------------------------------------------------------------------------
-- Doctor notifications (body from 0038): name a system cancellation
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_notify_doctor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_patient text;
  v_when text;
  v_type public.doctor_notification_type;
  v_title text;
  v_body text;
begin
  if new.doctor_id is null then
    return null;
  end if;

  select full_name into v_patient
  from public.profiles
  where id = new.patient_id;
  v_patient := coalesce(v_patient, 'a patient');
  v_when := to_char(
    new.scheduled_at at time zone 'Asia/Manila',
    'Dy, Mon FMDD" · "FMHH12:MI AM'
  );

  if tg_op = 'INSERT' then
    if new.status = 'requested' then
      v_type := 'new_request';
      v_title := 'New request: ' || v_patient;
      v_body := v_when || ' · waiting for front desk';
    elsif new.status = 'confirmed' then
      v_type := 'confirmed';
      v_title := 'Booked by the front desk: ' || v_patient;
      v_body := v_when;
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status = 'requested' then
      v_type := 'confirmed';
      v_title := 'Confirmed by the front desk';
      v_body := v_patient || ' · ' || v_when;
    elsif new.status = 'cancelled'
      and new.cancelled_by_role is distinct from 'doctor' then
      v_type := 'cancelled';
      v_title := 'Cancelled: ' || v_patient;
      v_body := v_when || ' · cancelled by ' || case new.cancelled_by_role
        when 'patient' then 'the patient'
        when 'front_desk' then 'the front desk'
        when 'system' then 'the system (request expired)'
        else 'staff'
      end;
    end if;
  elsif new.scheduled_at is distinct from old.scheduled_at then
    v_type := 'rescheduled';
    v_title := 'Rescheduled by the front desk';
    v_body := v_patient || ' moved to ' || v_when;
  end if;

  if v_type is not null then
    insert into public.doctor_notifications (doctor_id, appointment_id, type, title, body)
    values (new.doctor_id, new.id, v_type, v_title, v_body);
  end if;

  return null;
end;
$$;

revoke all on function public.cammi_connect_notify_doctor()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Receipt retention (D5)
-- ---------------------------------------------------------------------------

alter table public.payment_receipts
  add column if not exists purged_at timestamptz;

comment on column public.payment_receipts.purged_at is
  'When the image was deleted from storage (D5: 90 days after the payment closed). The row stays.';

-- Marks receipts whose images the purge script deleted. Returns how many rows
-- changed; already-purged rows are left alone.
create or replace function public.cammi_connect_mark_receipts_purged(p_receipt_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payment_receipts as receipts
  set purged_at = now()
  where receipts.id = any(p_receipt_ids)
    and receipts.purged_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.cammi_connect_mark_receipts_purged(uuid[])
  from public, anon, authenticated;
grant execute on function public.cammi_connect_mark_receipts_purged(uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- pg_cron: every 5 minutes (D2), only when the extension is installed
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Scheduling under an existing name replaces that job.
    perform cron.schedule(
      'cammi-connect-expire-unpaid',
      '*/5 * * * *',
      'select public.cammi_connect_expire_unpaid()'
    );
  else
    raise notice 'pg_cron is not installed: enable it, then re-run this block (db/README.md, 0039).';
  end if;
end;
$$;

notify pgrst, 'reload schema';
