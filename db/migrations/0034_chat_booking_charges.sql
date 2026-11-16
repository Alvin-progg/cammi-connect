-- CamiConnect — charges and payments for chat bookings (PAY-001 slice PAY-03)
--
-- Run after 0033_price_catalogue.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
-- Money is integer centavos everywhere (₱560.00 = 56000); there are no
-- floats.
--
--   * payment_status: every status in the PAY-001 table, including the ones
--     later slices move to (submitted, verified, expired, refunds, ...).
--   * appointment_charges: one per appointment. Privilege (none/senior/pwd),
--     payer (self/hmo/philhealth), the HMO and member number, the totals,
--     and a unique reference code like CC-7F3K2 for the patient's payment
--     notes.
--   * appointment_charge_items: one row per line with the snapshotted price
--     and every deduction, so a later price change never changes a booking.
--   * payments: one per charge. Status, amount due, deadline, attempts, and
--     the verify/reject/refund fields later slices fill. A transaction
--     reference can verify only one payment (unique ignoring case and
--     surrounding spaces).
--   * payment_events: append-only history, like appointment_audit_logs.
--   * cammi_connect_book_with_charge: Cami's booking with a charge. In one
--     transaction it books through cammi_connect_book_appointment (0031, so
--     the per-patient cap and availability checks still apply), then writes
--     the charge, its line, the payment, and the `created` event. Any refusal
--     rolls everything back.
--
-- Prices are never taken from the caller. The function reads the doctor's
-- fee (or the specialty default), computes the breakdown the way
-- src/lib/billing/compute.ts does (VAT exemption → 20% senior/PWD →
-- PhilHealth → HMO, half-up integer rounding), and refuses with
-- price_changed when the amount due differs from the one the patient was
-- shown. The payment deadline is now + payment.deadline_minutes (default
-- 120), but never later than 2 hours before the visit; a visit that starts
-- within 2 hours cannot be held with payment (payment_too_soon). HMO and
-- ₱0 bookings get no deadline.
--
-- payment.enabled is checked by the chat server, not here: with it off, Cami
-- books through cammi_connect_book_appointment exactly as before, with no
-- charge.
--
-- Authorization follows ADR-0003: RLS is on with no policies, anon and
-- authenticated have no table access, and execute is granted to
-- service_role only. Refusals raise P0001 with a code as the message.

-- ---------------------------------------------------------------------------
-- Payment status
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.payment_status as enum (
    'not_required',
    'hmo_pending',
    'awaiting_payment',
    'submitted',
    'rejected',
    'verified',
    'hmo_approved',
    'expired',
    'refund_due',
    'refunded',
    'collect_at_counter'
  );
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Charges and line items
-- ---------------------------------------------------------------------------

create table if not exists public.appointment_charges (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique
    references public.appointments (id) on delete restrict,
  reference_code text not null unique
    check (reference_code ~ '^CC-[A-HJ-NP-Z2-9]{5}$'),
  privilege text not null check (privilege in ('none', 'senior', 'pwd')),
  payer text not null check (payer in ('self', 'hmo', 'philhealth')),
  hmo_provider_id uuid references public.hmo_providers (id) on delete restrict,
  hmo_member_number text
    check (hmo_member_number is null or char_length(hmo_member_number) between 1 and 50),
  base_centavos integer not null check (base_centavos >= 0),
  vat_exemption_centavos integer not null check (vat_exemption_centavos >= 0),
  privilege_discount_centavos integer not null check (privilege_discount_centavos >= 0),
  philhealth_centavos integer not null check (philhealth_centavos >= 0),
  hmo_centavos integer not null check (hmo_centavos >= 0),
  amount_due_centavos integer not null check (amount_due_centavos >= 0),
  created_at timestamptz not null default now(),
  constraint appointment_charges_hmo_details
    check ((payer = 'hmo') = (hmo_provider_id is not null and hmo_member_number is not null)),
  constraint appointment_charges_totals_add_up
    check (
      base_centavos - vat_exemption_centavos - privilege_discount_centavos
        - philhealth_centavos - hmo_centavos = amount_due_centavos
    )
);

comment on table public.appointment_charges is
  'PAY-001 price snapshot of one appointment, taken when the patient confirmed.';

create table if not exists public.appointment_charge_items (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.appointment_charges (id) on delete restrict,
  line_number smallint not null check (line_number >= 1),
  kind text not null check (kind in ('consultation')),
  description text not null check (btrim(description) <> ''),
  doctor_id uuid references public.doctors (id) on delete restrict,
  specialty_id uuid references public.specialties (id) on delete restrict,
  vatable boolean not null,
  philhealth_benefit_centavos integer not null check (philhealth_benefit_centavos >= 0),
  hmo_coverable boolean not null,
  base_centavos integer not null check (base_centavos >= 0),
  vat_exemption_centavos integer not null check (vat_exemption_centavos >= 0),
  privilege_discount_centavos integer not null check (privilege_discount_centavos >= 0),
  philhealth_centavos integer not null check (philhealth_centavos >= 0),
  hmo_centavos integer not null check (hmo_centavos >= 0),
  amount_due_centavos integer not null check (amount_due_centavos >= 0),
  unique (charge_id, line_number),
  constraint appointment_charge_items_totals_add_up
    check (
      base_centavos - vat_exemption_centavos - privilege_discount_centavos
        - philhealth_centavos - hmo_centavos = amount_due_centavos
    )
);

comment on table public.appointment_charge_items is
  'PAY-001 line items of a charge: the snapshotted price and each deduction.';

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null unique
    references public.appointment_charges (id) on delete restrict,
  appointment_id uuid not null unique
    references public.appointments (id) on delete restrict,
  status public.payment_status not null,
  -- How a self-paying patient pays: the hospital's QR Ph, or at the counter
  -- (decision D6, same deadline). Null for HMO, PhilHealth, and ₱0.
  method text check (method in ('qr_ph', 'counter')),
  amount_due_centavos integer not null check (amount_due_centavos >= 0),
  deadline_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  transaction_reference text check (btrim(transaction_reference) <> ''),
  amount_received_centavos integer check (amount_received_centavos >= 0),
  received_at timestamptz,
  verified_by uuid references public.profiles (id) on delete restrict,
  verified_at timestamptz,
  rejected_reason text,
  rejected_by uuid references public.profiles (id) on delete restrict,
  rejected_at timestamptz,
  refund_reference text,
  refunded_by uuid references public.profiles (id) on delete restrict,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is
  'PAY-001 payment of one charge. A transaction reference can verify only one payment.';

create unique index if not exists payments_transaction_reference_key
  on public.payments (upper(btrim(transaction_reference)))
  where transaction_reference is not null;

create index if not exists payments_status_deadline_idx
  on public.payments (status, deadline_at);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.cammi_connect_set_updated_at();

-- ---------------------------------------------------------------------------
-- Payment events (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  -- restrict: a set-null cascade would be an UPDATE, which the log forbids.
  actor_profile_id uuid references public.profiles (id) on delete restrict,
  action text not null check (
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
      'refunded'
    )
  ),
  previous_status public.payment_status,
  new_status public.payment_status not null,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.payment_events is
  'Append-only history of payment actions (PAY-001). Rows cannot be updated or deleted.';

create index if not exists payment_events_payment_idx
  on public.payment_events (payment_id, created_at);

drop trigger if exists payment_events_immutable on public.payment_events;
create trigger payment_events_immutable
before update or delete on public.payment_events
for each row execute function public.cammi_connect_reject_audit_log_change();

drop trigger if exists payment_events_no_truncate on public.payment_events;
create trigger payment_events_no_truncate
before truncate on public.payment_events
for each statement execute function public.cammi_connect_reject_audit_log_change();

-- ---------------------------------------------------------------------------
-- ADR-0003 lockdown
-- ---------------------------------------------------------------------------

alter table public.appointment_charges enable row level security;
alter table public.appointment_charge_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

revoke all on table public.appointment_charges from anon, authenticated;
revoke all on table public.appointment_charge_items from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated, service_role;

grant all on table public.appointment_charges to service_role;
grant all on table public.appointment_charge_items to service_role;
grant all on table public.payments to service_role;
grant select, insert on table public.payment_events to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_book_with_charge
-- ---------------------------------------------------------------------------

-- p_payment_method: 'qr_ph' or 'counter' when the payer is self; null otherwise.
-- p_expected_amount_due_centavos: the amount on the summary the patient confirmed.
create or replace function public.cammi_connect_book_with_charge(
  p_doctor_id uuid,
  p_specialty_id uuid,
  p_patient_id uuid,
  p_scheduled_at timestamptz,
  p_reason text,
  p_privilege text,
  p_payer text,
  p_payment_method text,
  p_hmo_provider_id uuid,
  p_hmo_member_number text,
  p_expected_amount_due_centavos integer
)
returns table (
  appointment_id uuid,
  reference_code text,
  payment_status public.payment_status,
  amount_due_centavos integer,
  deadline_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- Unambiguous characters only: no 0/O or 1/I.
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_member_number text := nullif(btrim(coalesce(p_hmo_member_number, '')), '');
  v_copay integer := 0;
  v_doctor_fee integer;
  v_specialty_fee integer;
  v_specialty_name text;
  -- Consultation lines: doctors' fees are not VAT-able, have no PhilHealth
  -- benefit, and HMOs cover them.
  v_vatable constant boolean := false;
  v_philhealth_benefit constant integer := 0;
  v_hmo_coverable constant boolean := true;
  v_base integer;
  v_vat_exemption integer := 0;
  v_privilege_discount integer := 0;
  v_philhealth integer := 0;
  v_hmo integer := 0;
  v_remaining integer;
  v_status public.payment_status;
  v_deadline timestamptz;
  v_deadline_minutes integer;
  v_reference text;
  v_bytes bytea;
  v_appointment_id uuid;
  v_charge_id uuid;
  v_payment_id uuid;
begin
  if p_privilege is null or p_privilege not in ('none', 'senior', 'pwd')
     or p_payer is null or p_payer not in ('self', 'hmo', 'philhealth')
     or (p_payer = 'self') <> (p_payment_method is not null)
     or (p_payment_method is not null and p_payment_method not in ('qr_ph', 'counter')) then
    raise exception 'invalid_payment_choice' using errcode = 'P0001';
  end if;

  if p_payer = 'hmo' then
    if v_member_number is null or char_length(v_member_number) > 50 then
      raise exception 'invalid_member_number' using errcode = 'P0001';
    end if;
    select providers.copay_centavos
    into v_copay
    from public.hmo_providers as providers
    where providers.id = p_hmo_provider_id and providers.is_active;
    if not found then
      raise exception 'hmo_unavailable' using errcode = 'P0001';
    end if;
  elsif p_hmo_provider_id is not null or v_member_number is not null then
    raise exception 'invalid_payment_choice' using errcode = 'P0001';
  end if;

  -- The doctor's own fee wins over the specialty default; the specialty must
  -- be one of the doctor's and still active.
  select doctors.consultation_fee_centavos,
         specialties.default_consultation_fee_centavos,
         specialties.name
  into v_doctor_fee, v_specialty_fee, v_specialty_name
  from public.doctor_specialties as links
  join public.doctors as doctors on doctors.id = links.doctor_id
  join public.specialties as specialties on specialties.id = links.specialty_id
  where links.doctor_id = p_doctor_id
    and links.specialty_id = p_specialty_id
    and specialties.is_active;
  if not found then
    raise exception 'invalid_specialty' using errcode = 'P0001';
  end if;

  v_base := coalesce(v_doctor_fee, v_specialty_fee);
  if v_base is null then
    raise exception 'price_on_request' using errcode = 'P0001';
  end if;

  -- PhilHealth is offered only when the line has a benefit.
  if p_payer = 'philhealth' and v_philhealth_benefit = 0 then
    raise exception 'invalid_payment_choice' using errcode = 'P0001';
  end if;

  -- Same math as src/lib/billing/compute.ts. round(n / d) half-up for
  -- non-negative integers is (2n + d) / (2d) in integer division.
  if p_privilege <> 'none' and v_vatable then
    v_vat_exemption := v_base - (2 * v_base * 100 + 112) / 224;
  end if;
  if p_privilege <> 'none' then
    v_privilege_discount := (2 * (v_base - v_vat_exemption) * 2000 + 10000) / 20000;
  end if;
  v_remaining := v_base - v_vat_exemption - v_privilege_discount;
  if p_payer = 'philhealth' then
    v_philhealth := least(v_philhealth_benefit, v_remaining);
    v_remaining := v_remaining - v_philhealth;
  end if;
  if p_payer = 'hmo' and v_hmo_coverable then
    v_hmo := v_remaining - least(v_copay, v_remaining);
    v_remaining := v_remaining - v_hmo;
  end if;

  if p_expected_amount_due_centavos is distinct from v_remaining then
    raise exception 'price_changed' using errcode = 'P0001';
  end if;

  if p_payer = 'hmo' then
    v_status := 'hmo_pending';
  elsif v_remaining = 0 then
    v_status := 'not_required';
  else
    v_status := 'awaiting_payment';
    if p_scheduled_at - interval '2 hours' <= now() then
      raise exception 'payment_too_soon' using errcode = 'P0001';
    end if;
    v_deadline_minutes := coalesce(
      (
        select (settings.value #>> '{}')::integer
        from public.system_settings as settings
        where settings.key = 'payment.deadline_minutes'
      ), 120);
    v_deadline := least(
      now() + make_interval(mins => v_deadline_minutes),
      p_scheduled_at - interval '2 hours'
    );
  end if;

  -- Raises on an unavailable slot, a taken slot (23P01), or the patient cap;
  -- the whole call rolls back with it.
  v_appointment_id := public.cammi_connect_book_appointment(
    p_doctor_id, p_patient_id, p_scheduled_at, p_reason, 'ai_chatbot', p_patient_id
  );

  -- The unique constraint is the backstop if two calls draw the same code.
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_reference := 'CC-';
    for i in 0..4 loop
      v_reference := v_reference || substr(v_alphabet, get_byte(v_bytes, i) % 32 + 1, 1);
    end loop;
    exit when not exists (
      select 1 from public.appointment_charges as charges
      where charges.reference_code = v_reference
    );
  end loop;

  insert into public.appointment_charges (
    appointment_id, reference_code, privilege, payer, hmo_provider_id,
    hmo_member_number, base_centavos, vat_exemption_centavos,
    privilege_discount_centavos, philhealth_centavos, hmo_centavos,
    amount_due_centavos
  )
  values (
    v_appointment_id, v_reference, p_privilege, p_payer,
    case when p_payer = 'hmo' then p_hmo_provider_id end,
    case when p_payer = 'hmo' then v_member_number end,
    v_base, v_vat_exemption, v_privilege_discount, v_philhealth, v_hmo, v_remaining
  )
  returning id into v_charge_id;

  insert into public.appointment_charge_items (
    charge_id, line_number, kind, description, doctor_id, specialty_id,
    vatable, philhealth_benefit_centavos, hmo_coverable, base_centavos,
    vat_exemption_centavos, privilege_discount_centavos, philhealth_centavos,
    hmo_centavos, amount_due_centavos
  )
  values (
    v_charge_id, 1, 'consultation', v_specialty_name || ' consultation',
    p_doctor_id, p_specialty_id, v_vatable, v_philhealth_benefit, v_hmo_coverable,
    v_base, v_vat_exemption, v_privilege_discount, v_philhealth, v_hmo, v_remaining
  );

  insert into public.payments (
    charge_id, appointment_id, status, method, amount_due_centavos, deadline_at
  )
  values (
    v_charge_id, v_appointment_id, v_status,
    case when p_payer = 'self' and v_remaining > 0 then p_payment_method end,
    v_remaining, v_deadline
  )
  returning id into v_payment_id;

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values
  )
  values (
    v_payment_id, p_patient_id, 'created', null, v_status,
    jsonb_build_object(
      'amount_due_centavos', v_remaining,
      'deadline_at', v_deadline,
      'payer', p_payer,
      'privilege', p_privilege
    )
  );

  return query select v_appointment_id, v_reference, v_status, v_remaining, v_deadline;
end;
$$;

revoke all on function public.cammi_connect_book_with_charge(
  uuid, uuid, uuid, timestamptz, text, text, text, text, uuid, text, integer
) from public, anon, authenticated;
grant execute on function public.cammi_connect_book_with_charge(
  uuid, uuid, uuid, timestamptz, text, text, text, text, uuid, text, integer
) to service_role;
