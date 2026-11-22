-- CamiConnect — saved PWD/HMO in booking (benefits slice BEN-02)
--
-- Run after 0041_patient_benefits.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go, and again (every step is idempotent).
--
--   * cammi_connect_resolve_benefit_choice: the benefit checks shared by both
--     booking paths. Refuses privilege 'pwd' unless patient_pwd is verified
--     (pwd_not_verified). For HMO it needs a verified patient_hmo that belongs
--     to the patient (hmo_required / hmo_unavailable / hmo_not_verified). For
--     a consultation it also needs an active accreditation for the doctor,
--     inside its validity dates today in Asia/Manila (hmo_not_accepted /
--     hmo_accreditation_expired). Service visits have no doctor, so only
--     verification applies. Returns the provider and member number that the
--     existing booking functions expect.
--   * cammi_connect_book_with_saved_hmo: wraps cammi_connect_book_with_charge
--     (0034). Resolves the choice, books, and writes appointment_hmo with
--     snapshots, all in one transaction.
--   * cammi_connect_book_service_with_saved_hmo: the same wrapper for
--     cammi_connect_book_service (0038).
--   * payments → appointment_hmo mirror: when the front desk records an HMO
--     decision (0037), appointment_hmo is updated in the same transaction.
--     Approval sets authorization approved and the LOA; denial sets
--     authorization rejected and coverage not_covered.
--   * backfill: existing HMO charges get patient_hmo rows (pending) and
--     appointment_hmo rows. Their accreditation snapshot stays null, because
--     accreditation was not recorded at the time.
--
-- The typed-HMO functions 0034 and 0038 stay in place for service_role
-- callers only. The app calls only the wrappers above, so the verification
-- rules cannot be skipped from the app.
--
-- Authorization follows ADR-0003: execute is revoked from public, anon, and
-- authenticated, and granted to service_role only.

-- ---------------------------------------------------------------------------
-- appointment_hmo: a service visit has no doctor, so no accreditation snapshot
-- ---------------------------------------------------------------------------

alter table public.appointment_hmo
  alter column accreditation_status_snapshot drop not null,
  alter column accreditation_valid_from_snapshot drop not null;

comment on column public.appointment_hmo.accreditation_status_snapshot is
  'Null for service visits (no doctor) and for backfilled rows, where no accreditation was recorded.';

-- ---------------------------------------------------------------------------
-- Shared benefit checks
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_resolve_benefit_choice(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_privilege text,
  p_payer text,
  p_patient_hmo_id uuid
)
returns table (
  hmo_provider_id uuid,
  hmo_member_number text,
  provider_name text,
  accreditation_status text,
  accreditation_valid_from date,
  accreditation_valid_until date
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pwd_status text;
  v_membership public.patient_hmo;
  v_provider_name text;
  v_accreditation_status text;
  v_accreditation_from date;
  v_accreditation_until date;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if p_privilege = 'pwd' then
    select pwd.verification_status
    into v_pwd_status
    from public.patient_pwd as pwd
    where pwd.patient_id = p_patient_id;
    if v_pwd_status is distinct from 'verified' then
      raise exception 'pwd_not_verified' using errcode = 'P0001';
    end if;
  end if;

  if p_payer <> 'hmo' then
    if p_patient_hmo_id is not null then
      raise exception 'invalid_payment_choice' using errcode = 'P0001';
    end if;
    return;
  end if;

  if p_patient_hmo_id is null then
    raise exception 'hmo_required' using errcode = 'P0001';
  end if;

  select membership.*
  into v_membership
  from public.patient_hmo as membership
  where membership.id = p_patient_hmo_id and membership.patient_id = p_patient_id;
  if not found then
    raise exception 'hmo_unavailable' using errcode = 'P0001';
  end if;
  if v_membership.verification_status <> 'verified' then
    raise exception 'hmo_not_verified' using errcode = 'P0001';
  end if;

  select providers.name
  into v_provider_name
  from public.hmo_providers as providers
  where providers.id = v_membership.hmo_provider_id and providers.is_active;
  if not found then
    raise exception 'hmo_unavailable' using errcode = 'P0001';
  end if;

  if p_doctor_id is not null then
    select accreditations.status, accreditations.valid_from, accreditations.valid_until
    into v_accreditation_status, v_accreditation_from, v_accreditation_until
    from public.doctor_hmo_accreditations as accreditations
    where accreditations.doctor_id = p_doctor_id
      and accreditations.hmo_provider_id = v_membership.hmo_provider_id;
    if v_accreditation_status is null or v_accreditation_status not in ('active', 'expired') then
      raise exception 'hmo_not_accepted' using errcode = 'P0001';
    end if;
    if v_accreditation_status = 'expired'
       or v_accreditation_from > v_today
       or (v_accreditation_until is not null and v_accreditation_until < v_today) then
      raise exception 'hmo_accreditation_expired' using errcode = 'P0001';
    end if;
  end if;

  return query select
    v_membership.hmo_provider_id,
    v_membership.membership_number,
    v_provider_name,
    v_accreditation_status,
    v_accreditation_from,
    v_accreditation_until;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consultation booking with saved HMO
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_book_with_saved_hmo(
  p_doctor_id uuid,
  p_specialty_id uuid,
  p_patient_id uuid,
  p_scheduled_at timestamptz,
  p_reason text,
  p_privilege text,
  p_payer text,
  p_payment_method text,
  p_patient_hmo_id uuid,
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
  v_provider_id uuid;
  v_member_number text;
  v_provider_name text;
  v_accreditation_status text;
  v_accreditation_from date;
  v_accreditation_until date;
  v_booked record;
begin
  select choice.hmo_provider_id, choice.hmo_member_number, choice.provider_name,
         choice.accreditation_status, choice.accreditation_valid_from, choice.accreditation_valid_until
  into v_provider_id, v_member_number, v_provider_name,
       v_accreditation_status, v_accreditation_from, v_accreditation_until
  from public.cammi_connect_resolve_benefit_choice(
    p_patient_id, p_doctor_id, p_privilege, p_payer, p_patient_hmo_id
  ) as choice;

  select booked.*
  into v_booked
  from public.cammi_connect_book_with_charge(
    p_doctor_id, p_specialty_id, p_patient_id, p_scheduled_at, p_reason,
    p_privilege, p_payer, p_payment_method, v_provider_id, v_member_number,
    p_expected_amount_due_centavos
  ) as booked;

  if p_payer = 'hmo' then
    insert into public.appointment_hmo (
      appointment_id, patient_hmo_id, hmo_provider_id, provider_name_snapshot,
      membership_number_snapshot, accreditation_status_snapshot,
      accreditation_valid_from_snapshot, accreditation_valid_until_snapshot
    ) values (
      v_booked.appointment_id, p_patient_hmo_id, v_provider_id, v_provider_name,
      v_member_number, v_accreditation_status, v_accreditation_from, v_accreditation_until
    );
  end if;

  return query select v_booked.appointment_id, v_booked.reference_code,
    v_booked.payment_status, v_booked.amount_due_centavos, v_booked.deadline_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Service visit booking with saved HMO (no doctor, so no accreditation check)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_book_service_with_saved_hmo(
  p_patient_id uuid,
  p_service_ids uuid[],
  p_visit_date date,
  p_scheduled_at timestamptz,
  p_reason text,
  p_privilege text,
  p_payer text,
  p_payment_method text,
  p_patient_hmo_id uuid,
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
  v_provider_id uuid;
  v_member_number text;
  v_provider_name text;
  v_booked record;
begin
  select choice.hmo_provider_id, choice.hmo_member_number, choice.provider_name
  into v_provider_id, v_member_number, v_provider_name
  from public.cammi_connect_resolve_benefit_choice(
    p_patient_id, null, p_privilege, p_payer, p_patient_hmo_id
  ) as choice;

  select booked.*
  into v_booked
  from public.cammi_connect_book_service(
    p_patient_id, p_service_ids, p_visit_date, p_scheduled_at, p_reason,
    p_privilege, p_payer, p_payment_method, v_provider_id, v_member_number,
    p_expected_amount_due_centavos
  ) as booked;

  if p_payer = 'hmo' then
    insert into public.appointment_hmo (
      appointment_id, patient_hmo_id, hmo_provider_id, provider_name_snapshot,
      membership_number_snapshot
    ) values (
      v_booked.appointment_id, p_patient_hmo_id, v_provider_id, v_provider_name,
      v_member_number
    );
  end if;

  return query select v_booked.appointment_id, v_booked.reference_code,
    v_booked.payment_status, v_booked.amount_due_centavos, v_booked.deadline_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Front desk HMO decision → appointment_hmo (0037 writes payments.hmo_*)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_mirror_hmo_decision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.appointment_hmo
  set authorization_status = case
        when new.hmo_denied_reason is not null then 'rejected'
        else 'approved'
      end,
      coverage_status = case
        when new.hmo_denied_reason is not null then 'not_covered'
        else coverage_status
      end,
      loa_number = new.hmo_loa_number,
      verified_by = new.hmo_decided_by,
      verified_at = new.hmo_decided_at
  where appointment_hmo.appointment_id = new.appointment_id;
  return new;
end;
$$;

drop trigger if exists payments_mirror_hmo_decision on public.payments;
create trigger payments_mirror_hmo_decision
after update of hmo_decided_at on public.payments
for each row
when (new.hmo_decided_at is not null and new.hmo_decided_at is distinct from old.hmo_decided_at)
execute function public.cammi_connect_mirror_hmo_decision();

-- ---------------------------------------------------------------------------
-- Backfill: existing HMO charges
-- ---------------------------------------------------------------------------

insert into public.patient_hmo (patient_id, hmo_provider_id, membership_number, verification_status)
select distinct on (appointments.patient_id, charges.hmo_provider_id)
  appointments.patient_id, charges.hmo_provider_id, charges.hmo_member_number, 'pending'
from public.appointment_charges as charges
join public.appointments as appointments on appointments.id = charges.appointment_id
where charges.hmo_provider_id is not null and charges.hmo_member_number is not null
order by appointments.patient_id, charges.hmo_provider_id, charges.created_at desc
on conflict (patient_id, hmo_provider_id) do nothing;

insert into public.appointment_hmo (
  appointment_id, patient_hmo_id, hmo_provider_id, provider_name_snapshot,
  membership_number_snapshot, authorization_status, coverage_status,
  loa_number, verified_by, verified_at
)
select
  charges.appointment_id,
  membership.id,
  charges.hmo_provider_id,
  providers.name,
  charges.hmo_member_number,
  case
    when payments.hmo_denied_reason is not null then 'rejected'
    when payments.hmo_loa_number is not null then 'approved'
    else 'pending'
  end,
  case when payments.hmo_denied_reason is not null then 'not_covered' else 'pending' end,
  payments.hmo_loa_number,
  payments.hmo_decided_by,
  payments.hmo_decided_at
from public.appointment_charges as charges
join public.hmo_providers as providers on providers.id = charges.hmo_provider_id
join public.appointments as appointments on appointments.id = charges.appointment_id
join public.patient_hmo as membership
  on membership.patient_id = appointments.patient_id
  and membership.hmo_provider_id = charges.hmo_provider_id
left join public.payments as payments on payments.charge_id = charges.id
where charges.hmo_provider_id is not null and charges.hmo_member_number is not null
on conflict (appointment_id) do nothing;

-- ---------------------------------------------------------------------------
-- Audited document view: returns the stored path for a signed link
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_record_benefit_document_view(
  p_kind text,
  p_record_id uuid,
  p_staff_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path text;
  v_target_id uuid;
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  -- A PWD record is keyed by its patient (as in cammi_connect_decide_pwd);
  -- an HMO membership by its own ID. The audit row names the record itself.
  if p_kind = 'pwd' then
    select pwd.id, pwd.pwd_id_image_path into v_target_id, v_path
    from public.patient_pwd as pwd
    where pwd.patient_id = p_record_id;
  elsif p_kind = 'hmo' then
    select membership.id, membership.hmo_card_image_path into v_target_id, v_path
    from public.patient_hmo as membership
    where membership.id = p_record_id;
  else
    raise exception 'invalid_document_kind' using errcode = 'P0001';
  end if;

  if v_path is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, new_values
  ) values (
    p_staff_id,
    'benefit.document_viewed',
    case when p_kind = 'pwd' then 'patient_pwd' else 'patient_hmo' end,
    v_target_id::text,
    jsonb_build_object('document', p_kind)
  );

  return v_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: service_role only (ADR-0003)
-- ---------------------------------------------------------------------------

revoke all on function public.cammi_connect_resolve_benefit_choice(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.cammi_connect_book_with_saved_hmo(uuid, uuid, uuid, timestamptz, text, text, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.cammi_connect_book_service_with_saved_hmo(uuid, uuid[], date, timestamptz, text, text, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.cammi_connect_mirror_hmo_decision() from public, anon, authenticated;
revoke all on function public.cammi_connect_record_benefit_document_view(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cammi_connect_record_benefit_document_view(text, uuid, uuid) to service_role;

grant execute on function public.cammi_connect_resolve_benefit_choice(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.cammi_connect_book_with_saved_hmo(uuid, uuid, uuid, timestamptz, text, text, text, text, uuid, integer) to service_role;
grant execute on function public.cammi_connect_book_service_with_saved_hmo(uuid, uuid[], date, timestamptz, text, text, text, text, uuid, integer) to service_role;
