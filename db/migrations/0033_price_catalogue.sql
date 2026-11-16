-- CamiConnect — price catalogue and HMO providers (PAY-001 slice PAY-01)
--
-- Run after 0032_specialty_routing_hints.sql, in the hosted Supabase
-- project's SQL editor. This file can run in one go.
--
-- Money is integer centavos everywhere (₱560.00 = 56000); there are no
-- floats. Nothing patient-facing reads these columns or settings yet.
--
--   * specialties.default_consultation_fee_centavos and
--     doctors.consultation_fee_centavos: nullable, non-negative. A doctor's
--     own fee wins over the specialty default (used from PAY-03).
--   * services: category, price_centavos (null = price on request),
--     vatable, philhealth_benefit_centavos (default 0), hmo_coverable,
--     requires_doctor_request, daily_capacity (walk-in cap, null = none).
--     booking_mode gains `scheduled` (service time slots, PAY-07).
--   * hmo_providers: admin-managed accredited HMOs with a co-pay. Names are
--     unique ignoring case and surrounding spaces; rows are never deleted.
--   * cammi_connect_admin_save_specialty, cammi_connect_admin_save_doctor, and
--     cammi_connect_admin_save_service gain their price parameters and record
--     them in the audit payload. The old signatures are dropped first so only
--     one save function of each exists. Bodies otherwise from 0032, 0017, and
--     0023.
--   * cammi_connect_admin_save_hmo_provider and
--     cammi_connect_admin_set_hmo_provider_active, audited like services.
--   * cammi_connect_admin_save_settings: body from 0032, plus the payment.*
--     keys. billing.privilege_discount_bps (the legal 20%) stays off the
--     allow-list, so it can't be changed.
--
-- Authorization follows ADR-0003 (see 0014): RLS is on with no policies,
-- anon/authenticated have no table access, and the functions re-check that
-- p_actor_profile_id is an active admin. A negative amount raises P0001
-- invalid_price before anything is written. Execute is revoked from public,
-- anon, and authenticated and granted to service_role only.

-- ---------------------------------------------------------------------------
-- Consultation fees
-- ---------------------------------------------------------------------------

alter table public.specialties
  add column if not exists default_consultation_fee_centavos integer;
alter table public.specialties
  drop constraint if exists specialties_default_consultation_fee_nonnegative;
alter table public.specialties
  add constraint specialties_default_consultation_fee_nonnegative
  check (default_consultation_fee_centavos >= 0);

alter table public.doctors
  add column if not exists consultation_fee_centavos integer;
alter table public.doctors
  drop constraint if exists doctors_consultation_fee_nonnegative;
alter table public.doctors
  add constraint doctors_consultation_fee_nonnegative
  check (consultation_fee_centavos >= 0);

-- ---------------------------------------------------------------------------
-- Service pricing
-- ---------------------------------------------------------------------------

alter table public.services
  add column if not exists category text not null default 'other',
  add column if not exists price_centavos integer,
  add column if not exists vatable boolean not null default false,
  add column if not exists philhealth_benefit_centavos integer not null default 0,
  add column if not exists hmo_coverable boolean not null default true,
  add column if not exists requires_doctor_request boolean not null default false,
  add column if not exists daily_capacity integer;

alter table public.services drop constraint if exists services_category_check;
alter table public.services
  add constraint services_category_check
  check (category in ('laboratory', 'imaging', 'cardiac_diagnostics', 'procedure', 'package', 'other'));

alter table public.services drop constraint if exists services_booking_mode_check;
alter table public.services
  add constraint services_booking_mode_check
  check (booking_mode in ('none', 'doctor_consultation', 'walk_in', 'scheduled'));

alter table public.services drop constraint if exists services_amounts_nonnegative;
alter table public.services
  add constraint services_amounts_nonnegative
  check (price_centavos >= 0 and philhealth_benefit_centavos >= 0);

alter table public.services drop constraint if exists services_daily_capacity_positive;
alter table public.services
  add constraint services_daily_capacity_positive
  check (daily_capacity > 0);

comment on table public.services is
  'Hospital services patients ask about, with PAY-001 prices in integer centavos.';

-- ---------------------------------------------------------------------------
-- HMO providers
-- ---------------------------------------------------------------------------

create table if not exists public.hmo_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  copay_centavos integer not null default 0 check (copay_centavos >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hmo_providers is
  'Accredited HMOs (payers). The patient pays the co-pay after HMO approval.';

create unique index if not exists hmo_providers_name_ci_key
  on public.hmo_providers (lower(btrim(name)));

drop trigger if exists hmo_providers_set_updated_at on public.hmo_providers;
create trigger hmo_providers_set_updated_at
before update on public.hmo_providers
for each row execute function public.cammi_connect_set_updated_at();

alter table public.hmo_providers enable row level security;
revoke all on table public.hmo_providers from anon, authenticated;
grant all on table public.hmo_providers to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_admin_save_specialty (body from 0032, plus the default fee)
-- ---------------------------------------------------------------------------

drop function if exists public.cammi_connect_admin_save_specialty(uuid, uuid, text, text, text);

create or replace function public.cammi_connect_admin_save_specialty(
  p_actor_profile_id uuid,
  p_specialty_id uuid,
  p_name text,
  p_description text,
  p_routing_hints text,
  p_default_consultation_fee_centavos integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_routing_hints text := nullif(btrim(coalesce(p_routing_hints, '')), '');
  v_specialty_id uuid := p_specialty_id;
  v_previous public.specialties;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if p_default_consultation_fee_centavos < 0 then
    raise exception 'invalid_price' using errcode = 'P0001';
  end if;

  if v_specialty_id is not null then
    select * into v_previous
    from public.specialties
    where id = v_specialty_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_specialty_id is null then
      insert into public.specialties (
        name, description, routing_hints, default_consultation_fee_centavos
      )
      values (v_name, v_description, v_routing_hints, p_default_consultation_fee_centavos)
      returning id into v_specialty_id;
    else
      update public.specialties
        set name = v_name,
            description = v_description,
            routing_hints = v_routing_hints,
            default_consultation_fee_centavos = p_default_consultation_fee_centavos
        where id = v_specialty_id;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate' using errcode = 'P0001';
  end;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_specialty_id is null then 'specialty.create' else 'specialty.update' end,
    'specialty', v_specialty_id::text,
    case
      when p_specialty_id is null then null
      else jsonb_build_object(
        'name', v_previous.name,
        'description', v_previous.description,
        'routing_hints', v_previous.routing_hints,
        'default_consultation_fee_centavos', v_previous.default_consultation_fee_centavos
      )
    end,
    jsonb_build_object(
      'name', v_name,
      'description', v_description,
      'routing_hints', v_routing_hints,
      'default_consultation_fee_centavos', p_default_consultation_fee_centavos
    )
  );

  return v_specialty_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_specialty(uuid, uuid, text, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_admin_save_doctor (body from 0017, plus the fee override)
-- ---------------------------------------------------------------------------

drop function if exists public.cammi_connect_admin_save_doctor(uuid, uuid, uuid, text, uuid, text, text, text, uuid[]);

-- p_doctor_id null creates a doctor: on p_account_profile_id when given (it
-- must be linkable), otherwise on a new profile without a login.
-- p_account_profile_id is ignored on update. A new or changed department must
-- be active. p_consultation_fee_centavos null uses the specialty default.
-- Returns the doctor id.
create or replace function public.cammi_connect_admin_save_doctor(
  p_actor_profile_id uuid,
  p_doctor_id uuid,
  p_account_profile_id uuid,
  p_full_name text,
  p_department_id uuid,
  p_contact_email text,
  p_contact_phone text,
  p_bio text,
  p_specialty_ids uuid[],
  p_consultation_fee_centavos integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_contact_email text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_contact_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_doctor_id uuid := p_doctor_id;
  v_previous_full_name text;
  v_previous_department_id uuid;
  v_previous_contact_email text;
  v_previous_contact_phone text;
  v_previous_bio text;
  v_previous_consultation_fee_centavos integer;
  v_new_values jsonb;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_full_name = '' then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;
  if p_department_id is null then
    raise exception 'department_required' using errcode = 'P0001';
  end if;
  if p_consultation_fee_centavos < 0 then
    raise exception 'invalid_price' using errcode = 'P0001';
  end if;

  if p_doctor_id is not null then
    select full_name, department_id, contact_email, contact_phone, bio,
           consultation_fee_centavos
    into v_previous_full_name, v_previous_department_id,
         v_previous_contact_email, v_previous_contact_phone, v_previous_bio,
         v_previous_consultation_fee_centavos
    from public.doctors
    where id = p_doctor_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  -- A doctor may keep a department that was deactivated after assignment.
  if p_doctor_id is null or p_department_id is distinct from v_previous_department_id then
    perform 1
    from public.departments
    where id = p_department_id and is_active;
    if not found then
      raise exception 'inactive_department' using errcode = 'P0001';
    end if;
  end if;

  v_new_values := jsonb_build_object(
    'full_name', v_full_name,
    'department_id', p_department_id,
    'contact_email', v_contact_email,
    'contact_phone', v_contact_phone,
    'bio', v_bio,
    'consultation_fee_centavos', p_consultation_fee_centavos
  );

  if p_doctor_id is null then
    if p_account_profile_id is null then
      insert into public.profiles (role, full_name, department_id)
      values ('doctor', v_full_name, p_department_id)
      returning id into v_doctor_id;
    else
      perform public.cammi_connect_require_linkable_doctor_account(p_account_profile_id);
      v_doctor_id := p_account_profile_id;
      update public.profiles
        set full_name = v_full_name,
            department_id = p_department_id
        where id = v_doctor_id;
    end if;

    insert into public.doctors (
      id, department_id, full_name, contact_email, contact_phone, bio,
      consultation_fee_centavos
    )
    values (
      v_doctor_id, p_department_id, v_full_name, v_contact_email, v_contact_phone, v_bio,
      p_consultation_fee_centavos
    );

    insert into public.audit_logs (
      actor_profile_id, action, target_type, target_id, new_values
    ) values (
      p_actor_profile_id, 'doctor.create', 'doctor', v_doctor_id::text, v_new_values
    );

    if p_account_profile_id is not null then
      insert into public.audit_logs (
        actor_profile_id, action, target_type, target_id, new_values
      ) values (
        p_actor_profile_id, 'doctor.link_account', 'doctor', v_doctor_id::text,
        jsonb_build_object('account_profile_id', p_account_profile_id)
      );
    end if;
  else
    update public.profiles
      set full_name = v_full_name,
          department_id = p_department_id
      where id = v_doctor_id;

    update public.doctors
      set full_name = v_full_name,
          department_id = p_department_id,
          contact_email = v_contact_email,
          contact_phone = v_contact_phone,
          bio = v_bio,
          consultation_fee_centavos = p_consultation_fee_centavos
      where id = v_doctor_id;

    if v_previous_full_name is distinct from v_full_name
       or v_previous_department_id is distinct from p_department_id
       or v_previous_contact_email is distinct from v_contact_email
       or v_previous_contact_phone is distinct from v_contact_phone
       or v_previous_bio is distinct from v_bio
       or v_previous_consultation_fee_centavos is distinct from p_consultation_fee_centavos then
      insert into public.audit_logs (
        actor_profile_id, action, target_type, target_id,
        previous_values, new_values
      ) values (
        p_actor_profile_id, 'doctor.update', 'doctor', v_doctor_id::text,
        jsonb_build_object(
          'full_name', v_previous_full_name,
          'department_id', v_previous_department_id,
          'contact_email', v_previous_contact_email,
          'contact_phone', v_previous_contact_phone,
          'bio', v_previous_bio,
          'consultation_fee_centavos', v_previous_consultation_fee_centavos
        ),
        v_new_values
      );
    end if;
  end if;

  perform public.cammi_connect_admin_set_doctor_specialties(
    p_actor_profile_id, v_doctor_id, p_specialty_ids
  );

  return v_doctor_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_doctor(uuid, uuid, uuid, text, uuid, text, text, text, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_doctor(uuid, uuid, uuid, text, uuid, text, text, text, uuid[], integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_admin_save_service (body from 0023, plus pricing)
-- ---------------------------------------------------------------------------

drop function if exists public.cammi_connect_admin_save_service(uuid, uuid, text, text, uuid, boolean, text);

create or replace function public.cammi_connect_admin_save_service(
  p_actor_profile_id uuid,
  p_service_id uuid,
  p_name text,
  p_description text,
  p_department_id uuid,
  p_requires_appointment boolean,
  p_booking_mode text,
  p_category text,
  p_price_centavos integer,
  p_vatable boolean,
  p_philhealth_benefit_centavos integer,
  p_hmo_coverable boolean,
  p_requires_doctor_request boolean,
  p_daily_capacity integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_service_id uuid := p_service_id;
  v_previous public.services;
  v_previous_department_id uuid;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if p_price_centavos < 0 or p_philhealth_benefit_centavos < 0 then
    raise exception 'invalid_price' using errcode = 'P0001';
  end if;

  if v_service_id is not null then
    select * into v_previous
    from public.services
    where id = v_service_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    v_previous_department_id := v_previous.department_id;
  end if;

  -- A service may keep a department that was deactivated after assignment.
  if p_department_id is not null
     and (p_service_id is null or p_department_id is distinct from v_previous_department_id) then
    perform 1
    from public.departments
    where id = p_department_id and is_active;
    if not found then
      raise exception 'inactive_department' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_service_id is null then
      insert into public.services (
        name, description, department_id, requires_appointment, booking_mode,
        category, price_centavos, vatable, philhealth_benefit_centavos,
        hmo_coverable, requires_doctor_request, daily_capacity
      ) values (
        v_name, v_description, p_department_id, p_requires_appointment, p_booking_mode,
        p_category, p_price_centavos, p_vatable, p_philhealth_benefit_centavos,
        p_hmo_coverable, p_requires_doctor_request, p_daily_capacity
      )
      returning id into v_service_id;
    else
      update public.services
        set name = v_name,
            description = v_description,
            department_id = p_department_id,
            requires_appointment = p_requires_appointment,
            booking_mode = p_booking_mode,
            category = p_category,
            price_centavos = p_price_centavos,
            vatable = p_vatable,
            philhealth_benefit_centavos = p_philhealth_benefit_centavos,
            hmo_coverable = p_hmo_coverable,
            requires_doctor_request = p_requires_doctor_request,
            daily_capacity = p_daily_capacity
        where id = v_service_id;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate' using errcode = 'P0001';
  end;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_service_id is null then 'service.create' else 'service.update' end,
    'service', v_service_id::text,
    case
      when p_service_id is null then null
      else jsonb_build_object(
        'name', v_previous.name,
        'description', v_previous.description,
        'department_id', v_previous.department_id,
        'requires_appointment', v_previous.requires_appointment,
        'booking_mode', v_previous.booking_mode,
        'category', v_previous.category,
        'price_centavos', v_previous.price_centavos,
        'vatable', v_previous.vatable,
        'philhealth_benefit_centavos', v_previous.philhealth_benefit_centavos,
        'hmo_coverable', v_previous.hmo_coverable,
        'requires_doctor_request', v_previous.requires_doctor_request,
        'daily_capacity', v_previous.daily_capacity
      )
    end,
    jsonb_build_object(
      'name', v_name,
      'description', v_description,
      'department_id', p_department_id,
      'requires_appointment', p_requires_appointment,
      'booking_mode', p_booking_mode,
      'category', p_category,
      'price_centavos', p_price_centavos,
      'vatable', p_vatable,
      'philhealth_benefit_centavos', p_philhealth_benefit_centavos,
      'hmo_coverable', p_hmo_coverable,
      'requires_doctor_request', p_requires_doctor_request,
      'daily_capacity', p_daily_capacity
    )
  );

  return v_service_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_service(uuid, uuid, text, text, uuid, boolean, text, text, integer, boolean, integer, boolean, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_service(uuid, uuid, text, text, uuid, boolean, text, text, integer, boolean, integer, boolean, boolean, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- HMO providers: save (create or update)
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_save_hmo_provider(
  p_actor_profile_id uuid,
  p_hmo_provider_id uuid,
  p_name text,
  p_copay_centavos integer,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_copay integer := coalesce(p_copay_centavos, 0);
  v_hmo_provider_id uuid := p_hmo_provider_id;
  v_previous public.hmo_providers;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if v_copay < 0 then
    raise exception 'invalid_price' using errcode = 'P0001';
  end if;

  if v_hmo_provider_id is not null then
    select * into v_previous
    from public.hmo_providers
    where id = v_hmo_provider_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;

  begin
    if v_hmo_provider_id is null then
      insert into public.hmo_providers (name, copay_centavos, notes)
      values (v_name, v_copay, v_notes)
      returning id into v_hmo_provider_id;
    else
      update public.hmo_providers
        set name = v_name,
            copay_centavos = v_copay,
            notes = v_notes
        where id = v_hmo_provider_id;
    end if;
  exception
    when unique_violation then
      raise exception 'duplicate' using errcode = 'P0001';
  end;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_hmo_provider_id is null then 'hmo_provider.create' else 'hmo_provider.update' end,
    'hmo_provider', v_hmo_provider_id::text,
    case
      when p_hmo_provider_id is null then null
      else jsonb_build_object(
        'name', v_previous.name,
        'copay_centavos', v_previous.copay_centavos,
        'notes', v_previous.notes
      )
    end,
    jsonb_build_object(
      'name', v_name,
      'copay_centavos', v_copay,
      'notes', v_notes
    )
  );

  return v_hmo_provider_id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_hmo_provider(uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_hmo_provider(uuid, uuid, text, integer, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- HMO providers: activate / deactivate
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_admin_set_hmo_provider_active(
  p_actor_profile_id uuid,
  p_hmo_provider_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_was_active boolean;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select is_active into v_was_active
  from public.hmo_providers
  where id = p_hmo_provider_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_was_active = p_is_active then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  update public.hmo_providers
    set is_active = p_is_active
    where id = p_hmo_provider_id;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id,
    case when p_is_active then 'hmo_provider.activate' else 'hmo_provider.deactivate' end,
    'hmo_provider', p_hmo_provider_id::text,
    jsonb_build_object('is_active', v_was_active),
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;

revoke all on function public.cammi_connect_admin_set_hmo_provider_active(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_set_hmo_provider_active(uuid, uuid, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_admin_save_settings (body from 0032, plus the payment keys)
-- ---------------------------------------------------------------------------

-- p_values: {"<key>": <value>, ...}, the keys the admin changed.
create or replace function public.cammi_connect_admin_save_settings(
  p_actor_profile_id uuid,
  p_values jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allowed constant text[] := array[
    'appointment.default_slot_minutes',
    'appointment.request_expiry_hours',
    'appointment.min_lead_hours',
    'appointment.max_advance_days',
    'appointment.max_upcoming_per_patient',
    'appointment.cancellation_policy_text',
    'appointment.reschedule_policy_text',
    'hospital.name',
    'hospital.address',
    'hospital.contact_phone',
    'hospital.contact_email',
    'hospital.operating_hours',
    'chatbot.enabled',
    'chatbot.welcome_message',
    'chatbot.enabled_categories',
    'chatbot.first_contact_specialty_adult',
    'chatbot.first_contact_specialty_child',
    'payment.enabled',
    'payment.qr_image_path',
    'payment.account_name',
    'payment.deadline_minutes',
    'payment.max_receipts',
    'payment.refund_cutoff_hours'
  ];
  v_key text;
  v_value jsonb;
  v_stored jsonb;
  v_previous jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'unknown_key' using errcode = 'P0001';
  end if;

  for v_key, v_value in select * from jsonb_each(p_values) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'unknown_key' using errcode = 'P0001';
    end if;

    select value into v_stored
    from public.system_settings
    where key = v_key
    for update;

    if v_stored is distinct from v_value then
      insert into public.system_settings (key, value, updated_by, updated_at)
      values (v_key, v_value, p_actor_profile_id, now())
      on conflict (key) do update
        set value = excluded.value,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at;

      v_previous := v_previous || jsonb_build_object(v_key, v_stored);
      v_new := v_new || jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  if v_new = '{}'::jsonb then
    raise exception 'unchanged' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, 'settings.update', 'system_settings', 'system_settings',
    v_previous, v_new
  );
end;
$$;

revoke all on function public.cammi_connect_admin_save_settings(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_settings(uuid, jsonb)
  to service_role;
