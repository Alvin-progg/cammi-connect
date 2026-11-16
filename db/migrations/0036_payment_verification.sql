-- CamiConnect — front desk payment verification and the confirm gate
-- (PAY-001 slice PAY-05)
--
-- Run after 0035_payment_receipts.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go, and again (every step is idempotent).
--
--   * cammi_connect_confirm_appointment (replaces 0009): also refuses
--     payment_not_verified unless the appointment's payment is verified,
--     hmo_approved, not_required, or collect_at_counter. An appointment with
--     no payment row is not gated: front-desk bookings (0012, created
--     confirmed), bookings made before payments existed, and chat bookings
--     made with payment.enabled off have no charge or payment.
--   * cammi_connect_verify_payment: the front desk found the money in the
--     hospital's account. Needs the transaction reference (unique ignoring
--     case and spaces), the amount received (at least the amount due), and
--     the time received. Allowed from awaiting_payment (a "pay at the
--     hospital" payment has no receipt), submitted, or rejected (the money
--     may turn up after a rejection).
--   * cammi_connect_reject_payment_receipt: a submitted receipt did not
--     match. Preset reason codes; the patient may send another receipt
--     (0035, up to payment.max_receipts).
--   * cammi_connect_mark_refunded: refund_due → refunded with the refund
--     reference.
--   * cammi_connect_record_receipt_view: returns the latest receipt's
--     storage path for a 60-second signed URL and audits the view in
--     payment_events (receipt_viewed) and audit_logs
--     (payment.receipt_viewed). ADR-0005 amendment.
--   * appointments_payment_refund trigger (D4): when a requested or
--     confirmed appointment whose payment is verified is cancelled or
--     rejected, by anyone and through any path (front desk, the patient in
--     chat, the doctor), the payment becomes refund_due — unless the patient
--     cancelled it themselves less than payment.refund_cutoff_hours (default
--     24) before the visit, which is not refunded (free rebooking within 30
--     days, handled by staff). That case keeps the payment verified and
--     records a no_refund event. A front desk cancellation is a hospital
--     cancellation, so it is always refunded.
--
-- Staff functions re-check that p_staff_id is an active front_desk or admin
-- profile (not_allowed); the Server Actions pass the session's profile ID.
-- Verify and reject apply only while the appointment is still a pending
-- request (not_pending). Every staff action writes a payment_events row.
--
-- Authorization follows ADR-0003: execute is revoked from public, anon, and
-- authenticated and granted to service_role only. Refusals raise P0001 with
-- a code as the message.

-- ---------------------------------------------------------------------------
-- payment_events: the D4 "no refund" outcome
-- ---------------------------------------------------------------------------

alter table public.payment_events
  drop constraint if exists payment_events_action_check;
alter table public.payment_events
  add constraint payment_events_action_check check (
    action in (
      'created',
      'receipt_submitted',
      'receipt_viewed',
      'verified',
      'rejected',
      'hmo_approved',
      'hmo_denied',
      'expired',
      'refund_due',
      'no_refund',
      'refunded'
    )
  );

-- ---------------------------------------------------------------------------
-- Confirm (replaces 0009) with the payment gate
-- ---------------------------------------------------------------------------

-- Raises P0001 with message not_found, not_pending, payment_not_verified,
-- inactive_doctor, past, outside_hours, or blocked.
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
  v_payment_status public.payment_status;
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

  -- PAY-001: no payment row means no charge (front desk, legacy, or
  -- payments off), which is not gated.
  select payments.status
  into v_payment_status
  from public.payments as payments
  where payments.appointment_id = p_appointment_id
  for update;

  if found and v_payment_status not in ('verified', 'hmo_approved', 'not_required', 'collect_at_counter') then
    raise exception 'payment_not_verified' using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------

-- Returns the patient (for Cami's message) and the amount due. Raises P0001
-- with not_allowed, payment_not_found, not_open, not_pending,
-- reference_required, duplicate_reference, amount_short, or
-- invalid_received_at. A racing duplicate reference fails on
-- payments_transaction_reference_key (23505).
create or replace function public.cammi_connect_verify_payment(
  p_payment_id uuid,
  p_staff_id uuid,
  p_transaction_reference text,
  p_amount_received_centavos integer,
  p_received_at timestamptz
)
returns table (patient_id uuid, amount_due_centavos integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_appointment public.appointments%rowtype;
  v_reference text := btrim(coalesce(p_transaction_reference, ''));
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments as payments
  where payments.id = p_payment_id
  for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;

  if v_payment.status not in ('awaiting_payment', 'submitted', 'rejected') then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  select * into v_appointment
  from public.appointments as appointments
  where appointments.id = v_payment.appointment_id;
  if v_appointment.status <> 'requested' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  if v_reference = '' or char_length(v_reference) > 100 then
    raise exception 'reference_required' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.payments as payments
    where upper(btrim(payments.transaction_reference)) = upper(v_reference)
  ) then
    raise exception 'duplicate_reference' using errcode = 'P0001';
  end if;

  if p_amount_received_centavos is null
     or p_amount_received_centavos < v_payment.amount_due_centavos then
    raise exception 'amount_short' using errcode = 'P0001';
  end if;

  -- A few minutes of clock difference between the bank app and the server.
  if p_received_at is null or p_received_at > now() + interval '5 minutes' then
    raise exception 'invalid_received_at' using errcode = 'P0001';
  end if;

  update public.payments as payments
  set status = 'verified',
      transaction_reference = v_reference,
      amount_received_centavos = p_amount_received_centavos,
      received_at = p_received_at,
      verified_by = p_staff_id,
      verified_at = now()
  where payments.id = p_payment_id;

  update public.payment_receipts as receipts
  set outcome = 'verified'
  where receipts.payment_id = p_payment_id and receipts.outcome = 'pending';

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values
  )
  values (
    p_payment_id, p_staff_id, 'verified', v_payment.status, 'verified',
    jsonb_build_object(
      'transaction_reference', v_reference,
      'amount_received_centavos', p_amount_received_centavos,
      'received_at', p_received_at
    )
  );

  return query select v_appointment.patient_id, v_payment.amount_due_centavos;
end;
$$;

revoke all on function public.cammi_connect_verify_payment(uuid, uuid, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_verify_payment(uuid, uuid, text, integer, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Reject a receipt
-- ---------------------------------------------------------------------------

-- p_reason_code: not_found, amount_different, unreadable, already_used, or
-- other; p_reason: the stored text (other must be explained). Raises P0001
-- with not_allowed, payment_not_found, not_open, not_pending, or
-- reason_required.
create or replace function public.cammi_connect_reject_payment_receipt(
  p_payment_id uuid,
  p_staff_id uuid,
  p_reason_code text,
  p_reason text
)
returns table (patient_id uuid, amount_due_centavos integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_appointment public.appointments%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if p_reason_code is null
     or p_reason_code not in ('not_found', 'amount_different', 'unreadable', 'already_used', 'other')
     or v_reason = '' or char_length(v_reason) > 600 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments as payments
  where payments.id = p_payment_id
  for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;

  if v_payment.status <> 'submitted' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  select * into v_appointment
  from public.appointments as appointments
  where appointments.id = v_payment.appointment_id;
  if v_appointment.status <> 'requested' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  update public.payments as payments
  set status = 'rejected',
      rejected_reason = v_reason,
      rejected_by = p_staff_id,
      rejected_at = now()
  where payments.id = p_payment_id;

  update public.payment_receipts as receipts
  set outcome = 'rejected'
  where receipts.payment_id = p_payment_id and receipts.outcome = 'pending';

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values, reason
  )
  values (
    p_payment_id, p_staff_id, 'rejected', 'submitted', 'rejected',
    jsonb_build_object('reason_code', p_reason_code), v_reason
  );

  return query select v_appointment.patient_id, v_payment.amount_due_centavos;
end;
$$;

revoke all on function public.cammi_connect_reject_payment_receipt(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_reject_payment_receipt(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Mark refunded
-- ---------------------------------------------------------------------------

-- Raises P0001 with not_allowed, payment_not_found, not_open, or
-- reference_required.
create or replace function public.cammi_connect_mark_refunded(
  p_payment_id uuid,
  p_staff_id uuid,
  p_refund_reference text
)
returns table (patient_id uuid, amount_due_centavos integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_reference text := btrim(coalesce(p_refund_reference, ''));
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments as payments
  where payments.id = p_payment_id
  for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;

  if v_payment.status <> 'refund_due' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  if v_reference = '' or char_length(v_reference) > 100 then
    raise exception 'reference_required' using errcode = 'P0001';
  end if;

  update public.payments as payments
  set status = 'refunded',
      refund_reference = v_reference,
      refunded_by = p_staff_id,
      refunded_at = now()
  where payments.id = p_payment_id;

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values
  )
  values (
    p_payment_id, p_staff_id, 'refunded', 'refund_due', 'refunded',
    jsonb_build_object('refund_reference', v_reference)
  );

  return query
  select appointments.patient_id, v_payment.amount_due_centavos
  from public.appointments as appointments
  where appointments.id = v_payment.appointment_id;
end;
$$;

revoke all on function public.cammi_connect_mark_refunded(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_mark_refunded(uuid, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Receipt view (audited)
-- ---------------------------------------------------------------------------

-- Returns the latest receipt's storage path. Raises P0001 with not_allowed or
-- receipt_not_found (also for a missing payment).
create or replace function public.cammi_connect_record_receipt_view(
  p_payment_id uuid,
  p_staff_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.payment_status;
  v_receipt_id uuid;
  v_path text;
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  select payments.status into v_status
  from public.payments as payments
  where payments.id = p_payment_id;

  select receipts.id, receipts.storage_path
  into v_receipt_id, v_path
  from public.payment_receipts as receipts
  where receipts.payment_id = p_payment_id
  order by receipts.uploaded_at desc
  limit 1;
  if v_path is null then
    raise exception 'receipt_not_found' using errcode = 'P0001';
  end if;

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values
  )
  values (
    p_payment_id, p_staff_id, 'receipt_viewed', v_status, v_status,
    jsonb_build_object('receipt_id', v_receipt_id)
  );

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, new_values)
  values (
    p_staff_id, 'payment.receipt_viewed', 'payment', p_payment_id::text,
    jsonb_build_object('receipt_id', v_receipt_id)
  );

  return v_path;
end;
$$;

revoke all on function public.cammi_connect_record_receipt_view(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_record_receipt_view(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Refund on cancellation (D4)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_payment_refund_on_cancel()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_cutoff_hours integer;
begin
  if new.status not in ('cancelled', 'rejected') or old.status = new.status then
    return new;
  end if;

  select payments.id into v_payment_id
  from public.payments as payments
  where payments.appointment_id = new.id and payments.status = 'verified'
  for update;
  if not found then
    return new;
  end if;

  v_cutoff_hours := coalesce(
    (
      select (settings.value #>> '{}')::integer
      from public.system_settings as settings
      where settings.key = 'payment.refund_cutoff_hours'
    ), 24);

  if new.status = 'cancelled' and new.cancelled_by_role = 'patient'
     and new.scheduled_at < now() + make_interval(hours => v_cutoff_hours) then
    insert into public.payment_events (
      payment_id, action, previous_status, new_status, new_values, reason
    )
    values (
      v_payment_id, 'no_refund', 'verified', 'verified',
      jsonb_build_object('cutoff_hours', v_cutoff_hours),
      'Cancelled by the patient less than the refund cutoff before the visit; free rebooking within 30 days.'
    );
    return new;
  end if;

  update public.payments as payments
  set status = 'refund_due'
  where payments.id = v_payment_id;

  insert into public.payment_events (
    payment_id, action, previous_status, new_status, new_values, reason
  )
  values (
    v_payment_id, 'refund_due', 'verified', 'refund_due',
    jsonb_build_object(
      'appointment_status', new.status,
      'cancelled_by_role', new.cancelled_by_role,
      'cutoff_hours', v_cutoff_hours
    ),
    case when new.cancelled_by_role = 'patient'
      then 'Cancelled by the patient before the refund cutoff: full refund.'
      else 'Cancelled or rejected by the hospital: full refund.'
    end
  );
  return new;
end;
$$;

revoke all on function public.cammi_connect_payment_refund_on_cancel()
  from public, anon, authenticated;

drop trigger if exists appointments_payment_refund on public.appointments;
create trigger appointments_payment_refund
after update of status on public.appointments
for each row execute function public.cammi_connect_payment_refund_on_cancel();

notify pgrst, 'reload schema';
