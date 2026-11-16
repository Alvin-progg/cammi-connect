-- CamiConnect — receipt uploads for chat payments (PAY-001 slice PAY-04)
--
-- Run after 0034_chat_booking_charges.sql, in the hosted Supabase project's
-- SQL editor. This file can run in one go, and again (every step is
-- idempotent).
--
--   * payment-receipts: a private Supabase Storage bucket (ADR-0005
--     amendment, PAY-001 D1). Not public, 5 MB per object, JPEG/PNG/WebP
--     only. No storage policies are added, so anon and authenticated
--     clients cannot read or write it; only the server's service-role
--     client uploads, after the session, ownership, attempt-limit, size, and
--     file-signature checks in POST /api/v1/payments/[id]/receipt.
--   * payment_receipts: one row per accepted upload (payment, patient,
--     storage path, content type, size, uploaded at, outcome). The outcome
--     stays `pending` until the front desk decides (PAY-05).
--   * cammi_connect_submit_payment_receipt: records an upload and moves the
--     payment to `submitted`, in one transaction. Refusals raise P0001 with a
--     code as the message:
--       payment_not_found     no such payment, or another patient's
--       payment_not_open      not awaiting_payment/rejected, or the
--                             appointment is no longer requested
--       receipt_limit_reached payment.max_receipts (default 3) used up
--       receipt_rate_limited  5 uploads in 10 minutes for this patient
--       invalid_receipt       bad path, content type, or size
--     The route removes the stored object when this function refuses.
--
-- Authorization follows ADR-0003: RLS is on with no policies, anon and
-- authenticated have no table access, and execute is granted to
-- service_role only.

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts', 'payment-receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- payment_receipts
-- ---------------------------------------------------------------------------

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  -- Kept on the row so the per-patient rate limit is one indexed count.
  patient_id uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique,
  content_type text not null
    check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_at timestamptz not null default now(),
  outcome text not null default 'pending'
    check (outcome in ('pending', 'verified', 'rejected'))
);

comment on table public.payment_receipts is
  'PAY-001 receipt uploads, one row per accepted image in the private payment-receipts bucket.';

create index if not exists payment_receipts_payment_idx
  on public.payment_receipts (payment_id, uploaded_at);

create index if not exists payment_receipts_patient_uploaded_idx
  on public.payment_receipts (patient_id, uploaded_at);

alter table public.payment_receipts enable row level security;

revoke all on table public.payment_receipts from anon, authenticated;
grant select, insert, update on table public.payment_receipts to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_submit_payment_receipt
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_submit_payment_receipt(
  p_payment_id uuid,
  p_patient_id uuid,
  p_storage_path text,
  p_content_type text,
  p_size_bytes integer
)
returns table (
  receipt_id uuid,
  payment_status public.payment_status,
  attempts integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_appointment_status text;
  v_max_receipts integer;
  v_recent integer;
  v_receipt_id uuid;
begin
  if p_storage_path is null
     or p_storage_path not like p_patient_id::text || '/' || p_payment_id::text || '/%'
     or p_content_type is null
     or p_content_type not in ('image/jpeg', 'image/png', 'image/webp')
     or p_size_bytes is null or p_size_bytes not between 1 and 5242880 then
    raise exception 'invalid_receipt' using errcode = 'P0001';
  end if;

  -- One upload at a time per patient, so the rate-limit count is exact.
  perform pg_advisory_xact_lock(hashtextextended('payment_receipt:' || p_patient_id::text, 0));

  -- Another patient's payment looks exactly like a missing one.
  select payments.*
  into v_payment
  from public.payments as payments
  join public.appointments as appointments on appointments.id = payments.appointment_id
  where payments.id = p_payment_id
    and appointments.patient_id = p_patient_id
  for update of payments;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;

  select appointments.status::text
  into v_appointment_status
  from public.appointments as appointments
  where appointments.id = v_payment.appointment_id;

  if v_payment.status not in ('awaiting_payment', 'rejected')
     or v_appointment_status <> 'requested' then
    raise exception 'payment_not_open' using errcode = 'P0001';
  end if;

  v_max_receipts := coalesce(
    (
      select (settings.value #>> '{}')::integer
      from public.system_settings as settings
      where settings.key = 'payment.max_receipts'
    ), 3);
  if v_payment.attempts >= v_max_receipts then
    raise exception 'receipt_limit_reached' using errcode = 'P0001';
  end if;

  select count(*)
  into v_recent
  from public.payment_receipts as receipts
  where receipts.patient_id = p_patient_id
    and receipts.uploaded_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    raise exception 'receipt_rate_limited' using errcode = 'P0001';
  end if;

  insert into public.payment_receipts (
    payment_id, patient_id, storage_path, content_type, size_bytes
  )
  values (p_payment_id, p_patient_id, p_storage_path, p_content_type, p_size_bytes)
  returning id into v_receipt_id;

  update public.payments as payments
  set status = 'submitted',
      attempts = payments.attempts + 1
  where payments.id = p_payment_id;

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values
  )
  values (
    p_payment_id, p_patient_id, 'receipt_submitted', v_payment.status, 'submitted',
    jsonb_build_object('receipt_id', v_receipt_id, 'attempts', v_payment.attempts + 1)
  );

  return query select v_receipt_id, 'submitted'::public.payment_status, v_payment.attempts + 1;
end;
$$;

revoke all on function public.cammi_connect_submit_payment_receipt(
  uuid, uuid, text, text, integer
) from public, anon, authenticated;
grant execute on function public.cammi_connect_submit_payment_receipt(
  uuid, uuid, text, text, integer
) to service_role;
