-- CamiConnect — HMO approve/deny (PAY-001 slice PAY-06)
--
-- Run after 0036_payment_verification.sql, in the hosted Supabase project's
-- SQL editor. This file can run in one go, and again (every step is
-- idempotent).
--
--   * payments: hmo_loa_number, hmo_denied_reason, hmo_decided_by, and
--     hmo_decided_at record the front desk's HMO decision.
--   * appointment_charges: a self-pay charge may keep its HMO provider and
--     member number, so a denied HMO stays on record. A charge still has
--     either both HMO details or neither, an HMO payer always has them, and
--     a PhilHealth payer never does.
--   * cammi_connect_decide_hmo: front desk or admin only, from hmo_pending
--     while the appointment is still a pending request.
--       approve (LOA number) → hmo_approved, which the 0036 confirm gate
--         accepts.
--       deny (reason) → self-pay. The HMO deduction is removed from every
--         line item and the charge; the payer becomes self. What is left is
--         the self-pay share in the usual order (VAT exemption → 20%
--         senior/PWD → PhilHealth): an HMO charge never has a PhilHealth
--         deduction, and the snapshotted VAT exemption and 20% stay as they
--         were. The payment becomes awaiting_payment by QR Ph with a new
--         deadline of now + payment.deadline_minutes (default 120), never
--         later than 2 hours before the visit, like
--         cammi_connect_book_with_charge (0034).
--         When the visit starts within 2 hours, no online payment can be
--         held (0034 refuses such bookings with payment_too_soon), and
--         an already-past deadline would make the request overdue at once.
--         The payment then becomes collect_at_counter instead: the cashier
--         collects at the visit, as for front desk bookings, and the
--         request can be confirmed. A ₱0 self-pay share becomes
--         not_required.
--     Both decisions write a payment_events row (hmo_approved or
--     hmo_denied). The deny reason stays with staff; Cami never repeats it.
--     Returns the patient, the new status, method, amount due, deadline,
--     reference code, and HMO name for Cami's templated message.
--
-- p_staff_id is the session's profile ID; the function re-checks that it is
-- an active front_desk or admin profile (not_allowed). Refusals raise P0001
-- with not_allowed, invalid_decision, loa_required, reason_required,
-- payment_not_found, not_open, or not_pending.
--
-- Authorization follows ADR-0003: execute is revoked from public, anon, and
-- authenticated and granted to service_role only. The tables keep RLS on
-- with no policies.

-- ---------------------------------------------------------------------------
-- Columns and constraints
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists hmo_loa_number text
    check (hmo_loa_number is null or char_length(btrim(hmo_loa_number)) between 1 and 100),
  add column if not exists hmo_denied_reason text
    check (hmo_denied_reason is null or char_length(btrim(hmo_denied_reason)) between 1 and 500),
  add column if not exists hmo_decided_by uuid references public.profiles (id) on delete restrict,
  add column if not exists hmo_decided_at timestamptz;

alter table public.appointment_charges
  drop constraint if exists appointment_charges_hmo_details;
alter table public.appointment_charges
  add constraint appointment_charges_hmo_details
    check (
      (hmo_provider_id is null) = (hmo_member_number is null)
      and (payer <> 'hmo' or hmo_provider_id is not null)
      and (payer <> 'philhealth' or hmo_provider_id is null)
    );

-- ---------------------------------------------------------------------------
-- cammi_connect_decide_hmo
-- ---------------------------------------------------------------------------

-- p_decision: 'approve' (p_loa_number) or 'deny' (p_reason).
create or replace function public.cammi_connect_decide_hmo(
  p_payment_id uuid,
  p_staff_id uuid,
  p_decision text,
  p_loa_number text,
  p_reason text
)
returns table (
  patient_id uuid,
  new_status public.payment_status,
  method text,
  amount_due_centavos integer,
  deadline_at timestamptz,
  reference_code text,
  hmo_name text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_appointment public.appointments%rowtype;
  v_charge public.appointment_charges%rowtype;
  v_hmo_name text;
  v_loa text := btrim(coalesce(p_loa_number, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_status public.payment_status;
  v_method text;
  v_amount integer;
  v_deadline timestamptz;
  v_deadline_minutes integer;
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if p_decision is null or p_decision not in ('approve', 'deny') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision = 'approve' and (v_loa = '' or char_length(v_loa) > 100) then
    raise exception 'loa_required' using errcode = 'P0001';
  end if;
  if p_decision = 'deny' and (v_reason = '' or char_length(v_reason) > 500) then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments as payments
  where payments.id = p_payment_id
  for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;

  if v_payment.status <> 'hmo_pending' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  select * into v_appointment
  from public.appointments as appointments
  where appointments.id = v_payment.appointment_id;
  if v_appointment.status <> 'requested' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  select * into v_charge
  from public.appointment_charges as charges
  where charges.id = v_payment.charge_id
  for update;

  select providers.name into v_hmo_name
  from public.hmo_providers as providers
  where providers.id = v_charge.hmo_provider_id;

  if p_decision = 'approve' then
    update public.payments as payments
    set status = 'hmo_approved',
        hmo_loa_number = v_loa,
        hmo_decided_by = p_staff_id,
        hmo_decided_at = now()
    where payments.id = p_payment_id;

    insert into public.payment_events (
      payment_id, actor_profile_id, action, previous_status, new_status, new_values
    )
    values (
      p_payment_id, p_staff_id, 'hmo_approved', 'hmo_pending', 'hmo_approved',
      jsonb_build_object('loa_number', v_loa)
    );

    return query select
      v_appointment.patient_id, 'hmo_approved'::public.payment_status, v_payment.method,
      v_payment.amount_due_centavos, v_payment.deadline_at, v_charge.reference_code, v_hmo_name;
    return;
  end if;

  -- Deny: remove the HMO deduction; the rest is the self-pay share.
  update public.appointment_charge_items as items
  set amount_due_centavos = items.amount_due_centavos + items.hmo_centavos,
      hmo_centavos = 0
  where items.charge_id = v_charge.id;

  update public.appointment_charges as charges
  set payer = 'self',
      amount_due_centavos = charges.amount_due_centavos + charges.hmo_centavos,
      hmo_centavos = 0
  where charges.id = v_charge.id
  returning charges.amount_due_centavos into v_amount;

  if v_amount = 0 then
    v_status := 'not_required';
  elsif v_appointment.scheduled_at - interval '2 hours' <= now() then
    -- Too late to hold the slot with an online payment: the cashier collects.
    v_status := 'collect_at_counter';
    v_method := 'counter';
  else
    v_status := 'awaiting_payment';
    v_method := 'qr_ph';
    v_deadline_minutes := coalesce(
      (
        select (settings.value #>> '{}')::integer
        from public.system_settings as settings
        where settings.key = 'payment.deadline_minutes'
      ), 120);
    v_deadline := least(
      now() + make_interval(mins => v_deadline_minutes),
      v_appointment.scheduled_at - interval '2 hours'
    );
  end if;

  update public.payments as payments
  set status = v_status,
      method = v_method,
      amount_due_centavos = v_amount,
      deadline_at = v_deadline,
      hmo_denied_reason = v_reason,
      hmo_decided_by = p_staff_id,
      hmo_decided_at = now()
  where payments.id = p_payment_id;

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values, reason
  )
  values (
    p_payment_id, p_staff_id, 'hmo_denied', 'hmo_pending', v_status,
    jsonb_build_object(
      'amount_due_centavos', v_amount,
      'deadline_at', v_deadline,
      'method', v_method
    ),
    v_reason
  );

  return query select
    v_appointment.patient_id, v_status, v_method, v_amount, v_deadline,
    v_charge.reference_code, v_hmo_name;
end;
$$;

revoke all on function public.cammi_connect_decide_hmo(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_decide_hmo(uuid, uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
