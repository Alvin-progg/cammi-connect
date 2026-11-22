-- CamiConnect — patient PWD and HMO benefits (benefits slice BEN-01)
--
-- Run after 0040_remove_refunds.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go, and again (every step is idempotent).
--
--   * patient_pwd: one PWD declaration per patient, with the ID number and
--     the ID image in the private benefit-documents bucket. Any new
--     submission resets it to pending, so a changed ID is re-verified.
--   * patient_hmo: a patient's HMO memberships (one per provider). A new
--     submission resets that membership to pending.
--   * doctor_hmo_accreditations: which HMOs each doctor accepts, with
--     status and validity dates. One row per doctor and provider.
--   * appointment_hmo: the HMO authorization and coverage of one
--     appointment, kept separate from payments.hmo_* (0037). Snapshots
--     keep the provider, membership, and accreditation as they were.
--     Rows are created by the booking functions in a later migration.
--
-- Functions (service_role only, ADR-0003). Staff ID is the session's
-- profile ID; each function re-checks it is an active profile of the right
-- role (not_allowed). Refusals raise P0001 with the message named below.
--   * cammi_connect_submit_pwd(patient, id number, image path)
--       patient only; → pending. Refuses not_allowed.
--   * cammi_connect_decide_pwd(patient, staff, verify|reject, reason)
--       front desk or admin; from pending only (not_pending). Reject needs
--       a reason (reason_required). Audited as benefit.pwd_*.
--   * cammi_connect_submit_hmo(patient, provider, membership, card path)
--       patient only; the provider must be active (provider_inactive).
--       → pending. Returns the patient_hmo ID.
--   * cammi_connect_decide_hmo_membership(patient_hmo, staff, verify|reject, reason)
--       front desk or admin; from pending only. Audited as benefit.hmo_*.
--   * cammi_connect_save_doctor_hmo_accreditation(doctor, provider, status,
--       valid from, valid until, admin)
--       admin only. Doctor and provider must exist (not_found), the
--       provider must be active (provider_inactive), and valid until must
--       not be before valid from (invalid_dates). Audited as
--       doctor_hmo.save.
--   * cammi_connect_update_appointment_hmo(appointment, staff, authorization,
--       coverage, loa number, remarks)
--       front desk or admin; the row must exist (not_found). Authorization
--       and coverage are set independently; an accredited doctor does not
--       imply coverage. Audited as appointment_hmo.update.
--
-- Access follows ADR-0003: the tables keep RLS on with no policies, and
-- anon/authenticated are revoked. The application checks are the only
-- authorization; patient-facing reads are masked in the app layer.

-- ---------------------------------------------------------------------------
-- Private document bucket (same policy as payment-receipts, 0035)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'benefit-documents', 'benefit-documents', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- patient_pwd
-- ---------------------------------------------------------------------------

create table if not exists public.patient_pwd (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.profiles (id) on delete restrict,
  pwd_id_number text not null check (char_length(btrim(pwd_id_number)) between 1 and 50),
  pwd_id_image_path text not null check (btrim(pwd_id_image_path) <> ''),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired')),
  verified_by uuid references public.profiles (id) on delete restrict,
  verified_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(btrim(rejection_reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_pwd_verified_has_reviewer
    check (verification_status <> 'verified' or (verified_by is not null and verified_at is not null)),
  constraint patient_pwd_rejected_has_reason
    check (verification_status <> 'rejected' or rejection_reason is not null)
);

comment on table public.patient_pwd is
  'PWD declaration of one patient. Benefits apply only while verification_status is verified (spec §2.5).';

drop trigger if exists patient_pwd_set_updated_at on public.patient_pwd;
create trigger patient_pwd_set_updated_at
before update on public.patient_pwd
for each row execute function public.cammi_connect_set_updated_at();

alter table public.patient_pwd enable row level security;
revoke all on table public.patient_pwd from anon, authenticated;
grant all on table public.patient_pwd to service_role;

-- ---------------------------------------------------------------------------
-- patient_hmo
-- ---------------------------------------------------------------------------

create table if not exists public.patient_hmo (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  hmo_provider_id uuid not null references public.hmo_providers (id) on delete restrict,
  membership_number text not null check (char_length(btrim(membership_number)) between 1 and 50),
  hmo_card_image_path text check (hmo_card_image_path is null or btrim(hmo_card_image_path) <> ''),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired')),
  verified_by uuid references public.profiles (id) on delete restrict,
  verified_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(btrim(rejection_reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_hmo_one_per_provider unique (patient_id, hmo_provider_id),
  constraint patient_hmo_verified_has_reviewer
    check (verification_status <> 'verified' or (verified_by is not null and verified_at is not null)),
  constraint patient_hmo_rejected_has_reason
    check (verification_status <> 'rejected' or rejection_reason is not null)
);

comment on table public.patient_hmo is
  'HMO memberships of one patient, one per provider. A verified membership does not imply coverage (spec §3.3).';

create index if not exists patient_hmo_patient_idx on public.patient_hmo (patient_id);

drop trigger if exists patient_hmo_set_updated_at on public.patient_hmo;
create trigger patient_hmo_set_updated_at
before update on public.patient_hmo
for each row execute function public.cammi_connect_set_updated_at();

alter table public.patient_hmo enable row level security;
revoke all on table public.patient_hmo from anon, authenticated;
grant all on table public.patient_hmo to service_role;

-- ---------------------------------------------------------------------------
-- doctor_hmo_accreditations
-- ---------------------------------------------------------------------------

create table if not exists public.doctor_hmo_accreditations (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete restrict,
  hmo_provider_id uuid not null references public.hmo_providers (id) on delete restrict,
  status text not null
    check (status in ('pending', 'active', 'inactive', 'expired', 'rejected')),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_hmo_accreditations_one_per_pair unique (doctor_id, hmo_provider_id),
  constraint doctor_hmo_accreditations_dates_order
    check (valid_until is null or valid_until >= valid_from)
);

comment on table public.doctor_hmo_accreditations is
  'Which HMO providers a doctor accepts. Booking offers HMO only when status is active and today (Manila) is inside the validity dates.';

drop trigger if exists doctor_hmo_accreditations_set_updated_at on public.doctor_hmo_accreditations;
create trigger doctor_hmo_accreditations_set_updated_at
before update on public.doctor_hmo_accreditations
for each row execute function public.cammi_connect_set_updated_at();

alter table public.doctor_hmo_accreditations enable row level security;
revoke all on table public.doctor_hmo_accreditations from anon, authenticated;
grant all on table public.doctor_hmo_accreditations to service_role;

-- ---------------------------------------------------------------------------
-- appointment_hmo
-- ---------------------------------------------------------------------------

create table if not exists public.appointment_hmo (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete restrict,
  patient_hmo_id uuid not null references public.patient_hmo (id) on delete restrict,
  hmo_provider_id uuid not null references public.hmo_providers (id) on delete restrict,
  -- Snapshots: the record keeps what applied at booking, even if the
  -- patient's membership or the doctor's accreditation changes later.
  provider_name_snapshot text not null check (btrim(provider_name_snapshot) <> ''),
  membership_number_snapshot text not null
    check (char_length(btrim(membership_number_snapshot)) between 1 and 50),
  accreditation_status_snapshot text not null
    check (accreditation_status_snapshot in ('pending', 'active', 'inactive', 'expired', 'rejected')),
  accreditation_valid_from_snapshot date not null,
  accreditation_valid_until_snapshot date,
  authorization_status text not null default 'pending'
    check (authorization_status in ('not_required', 'pending', 'approved', 'rejected', 'expired')),
  coverage_status text not null default 'pending'
    check (coverage_status in ('pending', 'covered', 'partially_covered', 'not_covered')),
  loa_number text check (loa_number is null or char_length(btrim(loa_number)) between 1 and 100),
  verified_by uuid references public.profiles (id) on delete restrict,
  verified_at timestamptz,
  remarks text check (remarks is null or char_length(btrim(remarks)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.appointment_hmo is
  'HMO authorization and coverage of one appointment. Independent of payments.hmo_* (0037) until the booking migration links them.';

drop trigger if exists appointment_hmo_set_updated_at on public.appointment_hmo;
create trigger appointment_hmo_set_updated_at
before update on public.appointment_hmo
for each row execute function public.cammi_connect_set_updated_at();

alter table public.appointment_hmo enable row level security;
revoke all on table public.appointment_hmo from anon, authenticated;
grant all on table public.appointment_hmo to service_role;

-- ---------------------------------------------------------------------------
-- Patient submissions
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_submit_pwd(
  p_patient_id uuid,
  p_pwd_id_number text,
  p_pwd_id_image_path text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_patient_id and profiles.role = 'patient' and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  -- Any new submission is pending again, including one that changes a
  -- verified number or image: the change needs a new review (spec §8).
  insert into public.patient_pwd as patient_pwd (
    patient_id, pwd_id_number, pwd_id_image_path, verification_status
  ) values (
    p_patient_id, btrim(p_pwd_id_number), p_pwd_id_image_path, 'pending'
  )
  on conflict (patient_id) do update
  set pwd_id_number = excluded.pwd_id_number,
      pwd_id_image_path = excluded.pwd_id_image_path,
      verification_status = 'pending',
      verified_by = null,
      verified_at = null,
      rejection_reason = null;
end;
$$;

create or replace function public.cammi_connect_submit_hmo(
  p_patient_id uuid,
  p_hmo_provider_id uuid,
  p_membership_number text,
  p_hmo_card_image_path text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_patient_hmo_id uuid;
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_patient_id and profiles.role = 'patient' and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.hmo_providers as providers
    where providers.id = p_hmo_provider_id and providers.is_active
  ) then
    raise exception 'provider_inactive' using errcode = 'P0001';
  end if;

  insert into public.patient_hmo as patient_hmo (
    patient_id, hmo_provider_id, membership_number, hmo_card_image_path, verification_status
  ) values (
    p_patient_id, p_hmo_provider_id, btrim(p_membership_number), p_hmo_card_image_path, 'pending'
  )
  on conflict (patient_id, hmo_provider_id) do update
  set membership_number = excluded.membership_number,
      hmo_card_image_path = coalesce(excluded.hmo_card_image_path, patient_hmo.hmo_card_image_path),
      verification_status = 'pending',
      verified_by = null,
      verified_at = null,
      rejection_reason = null
  returning id into v_patient_hmo_id;

  return v_patient_hmo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Front desk decisions on PWD and HMO memberships
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_decide_pwd(
  p_patient_id uuid,
  p_staff_id uuid,
  p_decision text,
  p_reason text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_row public.patient_pwd;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_new_status text;
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if p_decision not in ('verify', 'reject') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision = 'reject' and v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_row from public.patient_pwd where patient_id = p_patient_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_row.verification_status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  v_new_status := case p_decision when 'verify' then 'verified' else 'rejected' end;

  update public.patient_pwd
  set verification_status = v_new_status,
      verified_by = case when v_new_status = 'verified' then p_staff_id else null end,
      verified_at = case when v_new_status = 'verified' then now() else null end,
      rejection_reason = case when v_new_status = 'rejected' then v_reason else null end
  where id = v_row.id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values, reason
  ) values (
    p_staff_id,
    case when v_new_status = 'verified' then 'benefit.pwd_verify' else 'benefit.pwd_reject' end,
    'patient_pwd', v_row.id::text,
    jsonb_build_object('verification_status', v_row.verification_status),
    jsonb_build_object('verification_status', v_new_status),
    v_reason
  );

  return v_new_status;
end;
$$;

create or replace function public.cammi_connect_decide_hmo_membership(
  p_patient_hmo_id uuid,
  p_staff_id uuid,
  p_decision text,
  p_reason text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_row public.patient_hmo;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_new_status text;
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if p_decision not in ('verify', 'reject') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision = 'reject' and v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_row from public.patient_hmo where id = p_patient_hmo_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_row.verification_status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  v_new_status := case p_decision when 'verify' then 'verified' else 'rejected' end;

  update public.patient_hmo
  set verification_status = v_new_status,
      verified_by = case when v_new_status = 'verified' then p_staff_id else null end,
      verified_at = case when v_new_status = 'verified' then now() else null end,
      rejection_reason = case when v_new_status = 'rejected' then v_reason else null end
  where id = v_row.id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values, reason
  ) values (
    p_staff_id,
    case when v_new_status = 'verified' then 'benefit.hmo_verify' else 'benefit.hmo_reject' end,
    'patient_hmo', v_row.id::text,
    jsonb_build_object('verification_status', v_row.verification_status),
    jsonb_build_object('verification_status', v_new_status),
    v_reason
  );

  return v_new_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: doctor HMO accreditation
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_save_doctor_hmo_accreditation(
  p_doctor_id uuid,
  p_hmo_provider_id uuid,
  p_status text,
  p_valid_from date,
  p_valid_until date,
  p_actor_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_previous public.doctor_hmo_accreditations;
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_actor_id and profiles.role = 'admin' and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.doctors where id = p_doctor_id)
    or not exists (select 1 from public.hmo_providers where id = p_hmo_provider_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.hmo_providers as providers
    where providers.id = p_hmo_provider_id and providers.is_active
  ) then
    raise exception 'provider_inactive' using errcode = 'P0001';
  end if;

  if p_status not in ('pending', 'active', 'inactive', 'expired', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  if p_valid_until is not null and p_valid_until < p_valid_from then
    raise exception 'invalid_dates' using errcode = 'P0001';
  end if;

  select * into v_previous
  from public.doctor_hmo_accreditations
  where doctor_id = p_doctor_id and hmo_provider_id = p_hmo_provider_id
  for update;

  insert into public.doctor_hmo_accreditations as accreditations (
    doctor_id, hmo_provider_id, status, valid_from, valid_until
  ) values (
    p_doctor_id, p_hmo_provider_id, p_status, p_valid_from, p_valid_until
  )
  on conflict (doctor_id, hmo_provider_id) do update
  set status = excluded.status,
      valid_from = excluded.valid_from,
      valid_until = excluded.valid_until
  returning id into v_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_id, 'doctor_hmo.save', 'doctor_hmo_accreditation', v_id::text,
    case when v_previous.id is null then null else jsonb_build_object(
      'status', v_previous.status,
      'valid_from', v_previous.valid_from,
      'valid_until', v_previous.valid_until
    ) end,
    jsonb_build_object(
      'status', p_status,
      'valid_from', p_valid_from,
      'valid_until', p_valid_until
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Front desk: appointment-specific HMO authorization and coverage
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_update_appointment_hmo(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_authorization_status text,
  p_coverage_status text,
  p_loa_number text,
  p_remarks text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_row public.appointment_hmo;
  v_loa text := nullif(btrim(coalesce(p_loa_number, '')), '');
  v_remarks text := nullif(btrim(coalesce(p_remarks, '')), '');
begin
  if not exists (
    select 1 from public.profiles as profiles
    where profiles.id = p_staff_id and profiles.role in ('front_desk', 'admin') and profiles.is_active
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if p_authorization_status not in ('not_required', 'pending', 'approved', 'rejected', 'expired')
    or p_coverage_status not in ('pending', 'covered', 'partially_covered', 'not_covered') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_row from public.appointment_hmo where appointment_id = p_appointment_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  update public.appointment_hmo
  set authorization_status = p_authorization_status,
      coverage_status = p_coverage_status,
      loa_number = v_loa,
      remarks = v_remarks,
      verified_by = p_staff_id,
      verified_at = now()
  where id = v_row.id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values, reason
  ) values (
    p_staff_id, 'appointment_hmo.update', 'appointment_hmo', v_row.id::text,
    jsonb_build_object(
      'authorization_status', v_row.authorization_status,
      'coverage_status', v_row.coverage_status,
      'loa_number', v_row.loa_number
    ),
    jsonb_build_object(
      'authorization_status', p_authorization_status,
      'coverage_status', p_coverage_status,
      'loa_number', v_loa
    ),
    v_remarks
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: service_role only (ADR-0003)
-- ---------------------------------------------------------------------------

revoke all on function public.cammi_connect_submit_pwd(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cammi_connect_submit_hmo(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cammi_connect_decide_pwd(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cammi_connect_decide_hmo_membership(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cammi_connect_save_doctor_hmo_accreditation(uuid, uuid, text, date, date, uuid) from public, anon, authenticated;
revoke all on function public.cammi_connect_update_appointment_hmo(uuid, uuid, text, text, text, text) from public, anon, authenticated;

grant execute on function public.cammi_connect_submit_pwd(uuid, text, text) to service_role;
grant execute on function public.cammi_connect_submit_hmo(uuid, uuid, text, text) to service_role;
grant execute on function public.cammi_connect_decide_pwd(uuid, uuid, text, text) to service_role;
grant execute on function public.cammi_connect_decide_hmo_membership(uuid, uuid, text, text) to service_role;
grant execute on function public.cammi_connect_save_doctor_hmo_accreditation(uuid, uuid, text, date, date, uuid) to service_role;
grant execute on function public.cammi_connect_update_appointment_hmo(uuid, uuid, text, text, text, text) to service_role;
