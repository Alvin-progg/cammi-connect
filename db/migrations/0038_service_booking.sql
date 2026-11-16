-- CamiConnect — lab, imaging, and package booking (PAY-001 slice PAY-07)
--
-- Run after 0037_hmo_decisions.sql, in the hosted Supabase project's SQL
-- editor. This file can run in one go.
--
-- Decision D3 (ADR-0007 amendment): service visits live in `appointments`.
--
--   * appointments.kind ('consultation' default, or 'service') and
--     appointments.service_id. doctor_id may be null only for a service visit,
--     and a service visit never has a doctor. appointments_no_active_overlap
--     is unchanged: it compares doctor_id with =, and a null doctor_id never
--     equals anything, so it keeps applying to doctor appointments only.
--   * One appointment row per visit. A lab multi-select (CBC + urinalysis) is
--     one appointment with one charge and one line per test; service_id holds
--     the first service and every service is on its charge line
--     (appointment_charge_items.service_id), which is where capacity is
--     counted.
--   * service_schedules: weekly hours of a walk-in or scheduled service, with
--     slot minutes and capacity per slot, and the same Manila effective-date
--     rules and overlap exclusion as doctor periods. A walk-in service uses
--     its periods only as opening hours: the visit holds the date and starts
--     at the first service's opening time.
--   * cammi_connect_service_load: holding (requested, confirmed, checked-in)
--     service visits per service and start time, the one count both the
--     booking function and Cami's availability read.
--   * cammi_connect_book_service: in one transaction, checks the services
--     (active, walk_in or scheduled, priced; several only for walk-in lab
--     tests), the patient cap, the hours, hospital-wide holidays, and
--     capacity (services.daily_capacity per Manila date when set, and
--     capacity per slot for scheduled services), recomputes the charge like
--     0034, and writes the appointment, its audit row, the charge, one line
--     per service, the payment, and the `created` payment event. Services are
--     locked in id order, so two bookings can never both take the last place.
--     Every service visit is born with a payment row, so the PAY-05 confirm
--     gate always applies to it.
--   * appointment_charge_items: kind gains 'service' and a service_id.
--   * cammi_connect_confirm_appointment: body from 0036. The payment gate is
--     unchanged; a service visit skips the doctor checks and needs its
--     service to still be active.
--   * cammi_connect_notify_doctor: body from 0029; a service visit has no
--     doctor, so nothing is notified.
--   * cammi_connect_admin_save_service_schedule: audited create/update of a
--     service period by an active admin.
--
-- Authorization follows ADR-0003: RLS is on with no policies, anon and
-- authenticated have no table access, and execute is granted to
-- service_role only. Refusals raise P0001 with a code as the message.

-- ---------------------------------------------------------------------------
-- Service visits in appointments
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists kind text not null default 'consultation',
  add column if not exists service_id uuid references public.services (id) on delete restrict;

alter table public.appointments drop constraint if exists appointments_kind_check;
alter table public.appointments
  add constraint appointments_kind_check check (kind in ('consultation', 'service'));

alter table public.appointments alter column doctor_id drop not null;

alter table public.appointments drop constraint if exists appointments_kind_target;
alter table public.appointments
  add constraint appointments_kind_target check (
    (kind = 'consultation' and doctor_id is not null and service_id is null)
    or (kind = 'service' and doctor_id is null and service_id is not null)
  );

create index if not exists appointments_service_scheduled_at_idx
  on public.appointments (service_id, scheduled_at)
  where service_id is not null;

alter table public.appointment_charge_items
  add column if not exists service_id uuid references public.services (id) on delete restrict;

alter table public.appointment_charge_items
  drop constraint if exists appointment_charge_items_kind_check;
alter table public.appointment_charge_items
  add constraint appointment_charge_items_kind_check
  check (kind in ('consultation', 'service'));

alter table public.appointment_charge_items
  drop constraint if exists appointment_charge_items_service_line;
alter table public.appointment_charge_items
  add constraint appointment_charge_items_service_line
  check ((kind = 'service') = (service_id is not null));

create index if not exists appointment_charge_items_service_idx
  on public.appointment_charge_items (service_id)
  where service_id is not null;

-- ---------------------------------------------------------------------------
-- Service schedules
-- ---------------------------------------------------------------------------

create table if not exists public.service_schedules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null check (slot_minutes in (15, 30, 45, 60)),
  capacity_per_slot integer not null default 1 check (capacity_per_slot between 1 and 100),
  effective_from date not null default ((now() at time zone 'Asia/Manila')::date),
  effective_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A period holds at least one slot, and is at most 8 hours (the longest
  -- appointment duration), so a walk-in visit can span it.
  constraint service_schedules_period_length check (
    end_time > start_time
    and end_time - start_time >= make_interval(mins => slot_minutes)
    and end_time - start_time <= interval '8 hours'
  ),
  constraint service_schedules_effective_order
    check (effective_until is null or effective_until >= effective_from),
  constraint service_schedules_no_active_overlap exclude using gist (
    service_id with =,
    day_of_week with =,
    daterange(effective_from, effective_until, '[]') with &&,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time, '[)') with &&
  ) where (is_active)
);

comment on table public.service_schedules is
  'PAY-07 weekly hours of a walk-in or scheduled service. day_of_week is 0-6, Sunday-first; times and effective dates are Asia/Manila.';

create index if not exists service_schedules_service_day_idx
  on public.service_schedules (service_id, day_of_week);

drop trigger if exists service_schedules_set_updated_at on public.service_schedules;
create trigger service_schedules_set_updated_at
before update on public.service_schedules
for each row execute function public.cammi_connect_set_updated_at();

alter table public.service_schedules enable row level security;
revoke all on table public.service_schedules from anon, authenticated;
grant all on table public.service_schedules to service_role;

-- ---------------------------------------------------------------------------
-- Service load (shared by booking and availability)
-- ---------------------------------------------------------------------------

-- Holding service visits per service and start time in [p_from, p_to).
-- Keep the statuses in sync with SLOT_HOLDING_STATUSES in
-- src/lib/appointments/status.ts.
create or replace function public.cammi_connect_service_load(
  p_service_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
returns table (service_id uuid, scheduled_at timestamptz, bookings integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select items.service_id, appointments.scheduled_at, count(distinct appointments.id)::integer
  from public.appointments as appointments
  join public.appointment_charges as charges on charges.appointment_id = appointments.id
  join public.appointment_charge_items as items on items.charge_id = charges.id
  where appointments.kind = 'service'
    and appointments.status in ('requested', 'confirmed', 'checked_in')
    and appointments.scheduled_at >= p_from
    and appointments.scheduled_at < p_to
    and items.service_id = any (p_service_ids)
  group by items.service_id, appointments.scheduled_at;
$$;

revoke all on function public.cammi_connect_service_load(uuid[], timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cammi_connect_service_load(uuid[], timestamptz, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- cammi_connect_book_service
-- ---------------------------------------------------------------------------

-- p_service_ids: in the order the patient chose them; the first is the
-- visit's service_id. p_visit_date is the Manila date of a walk-in visit;
-- p_scheduled_at is the slot start of a scheduled one (the other is null).
-- Payment arguments as in cammi_connect_book_with_charge (0034).
create or replace function public.cammi_connect_book_service(
  p_patient_id uuid,
  p_service_ids uuid[],
  p_visit_date date,
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
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_member_number text := nullif(btrim(coalesce(p_hmo_member_number, '')), '');
  v_count integer := coalesce(cardinality(p_service_ids), 0);
  v_primary uuid := p_service_ids[1];
  v_mode text;
  v_copay integer := 0;
  v_copay_left integer;
  v_copay_here integer;
  v_upcoming integer;
  v_local timestamp;
  v_local_date date;
  v_local_time time;
  v_open time;
  v_close time;
  v_scheduled_at timestamptz;
  v_duration integer;
  v_capacity integer;
  v_day_start timestamptz;
  v_service record;
  v_line integer := 0;
  v_lines jsonb := '[]'::jsonb;
  v_philhealth_offered boolean := false;
  v_hmo_offered boolean := false;
  v_base integer;
  v_vat_exemption integer;
  v_privilege_discount integer;
  v_philhealth integer;
  v_hmo integer;
  v_remaining integer;
  v_total_base integer := 0;
  v_total_vat_exemption integer := 0;
  v_total_privilege_discount integer := 0;
  v_total_philhealth integer := 0;
  v_total_hmo integer := 0;
  v_total_due integer := 0;
  v_status public.payment_status;
  v_deadline timestamptz;
  v_deadline_minutes integer;
  v_reference text;
  v_bytes bytea;
  v_appointment_id uuid;
  v_charge_id uuid;
  v_payment_id uuid;
begin
  -- Payment choice: same rules as 0034.
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

  -- One to five distinct services.
  if v_count = 0 or v_count > 5
     or array_position(p_service_ids, null) is not null
     or (select count(distinct ids.id) from unnest(p_service_ids) as ids (id)) <> v_count then
    raise exception 'invalid_services' using errcode = 'P0001';
  end if;

  -- Serializes bookings of these services. Id order, so two bookings of
  -- overlapping sets can never deadlock. Lock order: services, then patient.
  perform 1
  from public.services as services
  where services.id = any (p_service_ids)
  order by services.id
  for update;

  -- The emergency room, pharmacy, and every other booking_mode none or
  -- doctor_consultation service are never bookable here.
  if exists (
    select 1
    from unnest(p_service_ids) as ids (id)
    left join public.services as services on services.id = ids.id
    where services.id is null
      or not services.is_active
      or services.booking_mode not in ('walk_in', 'scheduled')
  ) then
    raise exception 'service_unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.services as services
    where services.id = any (p_service_ids) and services.price_centavos is null
  ) then
    raise exception 'price_on_request' using errcode = 'P0001';
  end if;

  -- Several services in one visit only for walk-in laboratory tests.
  if v_count > 1 and exists (
    select 1 from public.services as services
    where services.id = any (p_service_ids)
      and (services.booking_mode <> 'walk_in' or services.category <> 'laboratory')
  ) then
    raise exception 'invalid_service_combination' using errcode = 'P0001';
  end if;

  select services.booking_mode into v_mode
  from public.services as services
  where services.id = v_primary;

  -- Per-patient cap, as in cammi_connect_book_appointment (0031).
  perform 1
  from public.profiles
  where id = p_patient_id
  for update;

  select count(*)
  into v_upcoming
  from public.appointments
  where patient_id = p_patient_id
    and status in ('requested', 'confirmed')
    and scheduled_at > now();

  if v_upcoming >= coalesce(
    (
      select (settings.value #>> '{}')::integer
      from public.system_settings as settings
      where settings.key = 'appointment.max_upcoming_per_patient'
    ), 3) then
    raise exception 'too_many_upcoming' using errcode = 'P0001';
  end if;

  if v_mode = 'walk_in' then
    if p_visit_date is null or p_scheduled_at is not null then
      raise exception 'outside_hours' using errcode = 'P0001';
    end if;
    v_local_date := p_visit_date;

    -- Every chosen service must be open that day.
    if exists (
      select 1
      from unnest(p_service_ids) as ids (id)
      where not exists (
        select 1
        from public.service_schedules as schedules
        where schedules.service_id = ids.id
          and schedules.is_active
          and schedules.day_of_week = extract(dow from v_local_date)
          and schedules.effective_from <= v_local_date
          and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
      )
    ) then
      raise exception 'outside_hours' using errcode = 'P0001';
    end if;

    -- The visit holds the day from the first service's opening time.
    select min(schedules.start_time), max(schedules.end_time)
    into v_open, v_close
    from public.service_schedules as schedules
    where schedules.service_id = v_primary
      and schedules.is_active
      and schedules.day_of_week = extract(dow from v_local_date)
      and schedules.effective_from <= v_local_date
      and (schedules.effective_until is null or schedules.effective_until >= v_local_date);

    v_scheduled_at := (v_local_date + v_open) at time zone 'Asia/Manila';
    v_duration := least(480, (extract(epoch from (v_close - v_open)) / 60)::integer);
  else
    if p_scheduled_at is null or p_visit_date is not null then
      raise exception 'outside_hours' using errcode = 'P0001';
    end if;
    v_scheduled_at := p_scheduled_at;
    v_local := p_scheduled_at at time zone 'Asia/Manila';
    v_local_date := v_local::date;
    v_local_time := v_local::time;

    -- The slot must start on the period's grid and end inside the period,
    -- as in cammi_connect_book_appointment.
    select schedules.slot_minutes, schedules.capacity_per_slot
    into v_duration, v_capacity
    from public.service_schedules as schedules
    where schedules.service_id = v_primary
      and schedules.is_active
      and schedules.day_of_week = extract(dow from v_local)
      and schedules.effective_from <= v_local_date
      and (schedules.effective_until is null or schedules.effective_until >= v_local_date)
      and v_local_time >= schedules.start_time
      and extract(epoch from v_local_time) / 60 + schedules.slot_minutes
        <= extract(epoch from schedules.end_time) / 60
      and mod(
        extract(epoch from (v_local_time - schedules.start_time))::integer,
        schedules.slot_minutes * 60
      ) = 0
    limit 1;

    if v_duration is null then
      raise exception 'outside_hours' using errcode = 'P0001';
    end if;

    if coalesce((
      select sum(load.bookings)
      from public.cammi_connect_service_load(
        array[v_primary], p_scheduled_at, p_scheduled_at + interval '1 minute'
      ) as load
    ), 0) >= v_capacity then
      raise exception 'slot_full' using errcode = 'P0001';
    end if;
  end if;

  if v_scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  if public.cammi_connect_exception_blocks(
    null,
    v_scheduled_at,
    v_scheduled_at + make_interval(mins => v_duration)
  ) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  -- services.daily_capacity, when set, caps each service per Manila date.
  v_day_start := v_local_date::timestamp at time zone 'Asia/Manila';
  if exists (
    select 1
    from public.services as services
    where services.id = any (p_service_ids)
      and services.daily_capacity is not null
      and coalesce((
        select sum(load.bookings)
        from public.cammi_connect_service_load(
          array[services.id], v_day_start, v_day_start + interval '1 day'
        ) as load
      ), 0) >= services.daily_capacity
  ) then
    raise exception 'service_full' using errcode = 'P0001';
  end if;

  -- Same math as src/lib/billing/compute.ts and 0034, line by line in the
  -- patient's order; the HMO co-pay is charged once, on the first
  -- HMO-coverable lines.
  v_copay_left := case when p_payer = 'hmo' then v_copay else 0 end;
  for v_service in
    select services.id, services.name, services.price_centavos, services.vatable,
           services.philhealth_benefit_centavos, services.hmo_coverable
    from unnest(p_service_ids) with ordinality as ids (id, position)
    join public.services as services on services.id = ids.id
    order by ids.position
  loop
    v_line := v_line + 1;
    v_base := v_service.price_centavos;
    v_vat_exemption := 0;
    v_privilege_discount := 0;
    v_philhealth := 0;
    v_hmo := 0;
    v_philhealth_offered := v_philhealth_offered or v_service.philhealth_benefit_centavos > 0;
    v_hmo_offered := v_hmo_offered or v_service.hmo_coverable;

    if p_privilege <> 'none' and v_service.vatable then
      v_vat_exemption := v_base - (2 * v_base * 100 + 112) / 224;
    end if;
    if p_privilege <> 'none' then
      v_privilege_discount := (2 * (v_base - v_vat_exemption) * 2000 + 10000) / 20000;
    end if;
    v_remaining := v_base - v_vat_exemption - v_privilege_discount;
    if p_payer = 'philhealth' then
      v_philhealth := least(v_service.philhealth_benefit_centavos, v_remaining);
      v_remaining := v_remaining - v_philhealth;
    end if;
    if p_payer = 'hmo' and v_service.hmo_coverable then
      v_copay_here := least(v_copay_left, v_remaining);
      v_copay_left := v_copay_left - v_copay_here;
      v_hmo := v_remaining - v_copay_here;
      v_remaining := v_copay_here;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'line_number', v_line,
      'service_id', v_service.id,
      'description', v_service.name,
      'vatable', v_service.vatable,
      'philhealth_benefit_centavos', v_service.philhealth_benefit_centavos,
      'hmo_coverable', v_service.hmo_coverable,
      'base_centavos', v_base,
      'vat_exemption_centavos', v_vat_exemption,
      'privilege_discount_centavos', v_privilege_discount,
      'philhealth_centavos', v_philhealth,
      'hmo_centavos', v_hmo,
      'amount_due_centavos', v_remaining
    );
    v_total_base := v_total_base + v_base;
    v_total_vat_exemption := v_total_vat_exemption + v_vat_exemption;
    v_total_privilege_discount := v_total_privilege_discount + v_privilege_discount;
    v_total_philhealth := v_total_philhealth + v_philhealth;
    v_total_hmo := v_total_hmo + v_hmo;
    v_total_due := v_total_due + v_remaining;
  end loop;

  -- PhilHealth only when a line has a benefit; an HMO only when it covers a line.
  if (p_payer = 'philhealth' and not v_philhealth_offered)
     or (p_payer = 'hmo' and not v_hmo_offered) then
    raise exception 'invalid_payment_choice' using errcode = 'P0001';
  end if;

  if p_expected_amount_due_centavos is distinct from v_total_due then
    raise exception 'price_changed' using errcode = 'P0001';
  end if;

  if p_payer = 'hmo' then
    v_status := 'hmo_pending';
  elsif v_total_due = 0 then
    v_status := 'not_required';
  else
    v_status := 'awaiting_payment';
    if v_scheduled_at - interval '2 hours' <= now() then
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
      v_scheduled_at - interval '2 hours'
    );
  end if;

  insert into public.appointments (
    kind, service_id, doctor_id, patient_id, scheduled_at, duration_minutes,
    status, reason, booking_source, created_by_profile_id
  )
  values (
    'service', v_primary, null, p_patient_id, v_scheduled_at, v_duration,
    'requested', nullif(btrim(coalesce(p_reason, '')), ''), 'ai_chatbot', p_patient_id
  )
  returning id into v_appointment_id;

  insert into public.appointment_audit_logs (
    appointment_id, actor_profile_id, action, previous_status, new_status,
    new_values
  )
  values (
    v_appointment_id, p_patient_id, 'created', null, 'requested',
    jsonb_build_object(
      'scheduled_at', v_scheduled_at,
      'booking_source', 'ai_chatbot',
      'service_ids', to_jsonb(p_service_ids)
    )
  );

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
    v_total_base, v_total_vat_exemption, v_total_privilege_discount,
    v_total_philhealth, v_total_hmo, v_total_due
  )
  returning id into v_charge_id;

  insert into public.appointment_charge_items (
    charge_id, line_number, kind, description, service_id, vatable,
    philhealth_benefit_centavos, hmo_coverable, base_centavos,
    vat_exemption_centavos, privilege_discount_centavos, philhealth_centavos,
    hmo_centavos, amount_due_centavos
  )
  select
    v_charge_id,
    (lines.line ->> 'line_number')::smallint,
    'service',
    lines.line ->> 'description',
    (lines.line ->> 'service_id')::uuid,
    (lines.line ->> 'vatable')::boolean,
    (lines.line ->> 'philhealth_benefit_centavos')::integer,
    (lines.line ->> 'hmo_coverable')::boolean,
    (lines.line ->> 'base_centavos')::integer,
    (lines.line ->> 'vat_exemption_centavos')::integer,
    (lines.line ->> 'privilege_discount_centavos')::integer,
    (lines.line ->> 'philhealth_centavos')::integer,
    (lines.line ->> 'hmo_centavos')::integer,
    (lines.line ->> 'amount_due_centavos')::integer
  from jsonb_array_elements(v_lines) as lines (line);

  insert into public.payments (
    charge_id, appointment_id, status, method, amount_due_centavos, deadline_at
  )
  values (
    v_charge_id, v_appointment_id, v_status,
    case when p_payer = 'self' and v_total_due > 0 then p_payment_method end,
    v_total_due, v_deadline
  )
  returning id into v_payment_id;

  insert into public.payment_events (
    payment_id, actor_profile_id, action, previous_status, new_status, new_values
  )
  values (
    v_payment_id, p_patient_id, 'created', null, v_status,
    jsonb_build_object(
      'amount_due_centavos', v_total_due,
      'deadline_at', v_deadline,
      'payer', p_payer,
      'privilege', p_privilege
    )
  );

  return query select v_appointment_id, v_reference, v_status, v_total_due, v_deadline;
end;
$$;

revoke all on function public.cammi_connect_book_service(
  uuid, uuid[], date, timestamptz, text, text, text, text, uuid, text, integer
) from public, anon, authenticated;
grant execute on function public.cammi_connect_book_service(
  uuid, uuid[], date, timestamptz, text, text, text, text, uuid, text, integer
) to service_role;

-- ---------------------------------------------------------------------------
-- Confirm (body from 0036) for service visits
-- ---------------------------------------------------------------------------

-- Raises P0001 with message not_found, not_pending, payment_not_verified,
-- inactive_doctor, service_unavailable, past, outside_hours, or blocked.
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
  -- payments off), which is not gated. Every service visit has one (0038).
  select payments.status
  into v_payment_status
  from public.payments as payments
  where payments.appointment_id = p_appointment_id
  for update;

  if found and v_payment_status not in ('verified', 'hmo_approved', 'not_required', 'collect_at_counter') then
    raise exception 'payment_not_verified' using errcode = 'P0001';
  end if;

  if v_appointment.scheduled_at <= now() then
    raise exception 'past' using errcode = 'P0001';
  end if;

  -- A service visit has no doctor; its hours and capacity were checked when
  -- it was booked, and its service must still be offered.
  if v_appointment.kind = 'service' then
    perform 1
    from public.services
    where id = v_appointment.service_id and is_active
    for update;

    if not found then
      raise exception 'service_unavailable' using errcode = 'P0001';
    end if;
  else
    -- Same lock as cammi_connect_book_appointment, so a confirmation and a
    -- booking for this doctor never interleave.
    perform 1
    from public.doctors
    where id = v_appointment.doctor_id and is_active
    for update;

    if not found then
      raise exception 'inactive_doctor' using errcode = 'P0001';
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
-- Doctor notifications (body from 0029): none for service visits
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
-- Admin: save a service period (audited)
-- ---------------------------------------------------------------------------

-- p_schedule_id null creates a period; otherwise the service's own period is
-- updated (is_active false deactivates it). Returns the period id. Raises
-- P0001 not_admin, not_found, not_bookable, invalid_period, or overlap.
create or replace function public.cammi_connect_admin_save_service_schedule(
  p_actor_profile_id uuid,
  p_schedule_id uuid,
  p_service_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_slot_minutes integer,
  p_capacity_per_slot integer,
  p_effective_from date,
  p_effective_until date,
  p_is_active boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mode text;
  v_previous public.service_schedules;
  v_saved public.service_schedules;
  v_action text;
begin
  perform public.cammi_connect_require_admin_actor(p_actor_profile_id);

  select booking_mode into v_mode
  from public.services
  where id = p_service_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_mode not in ('walk_in', 'scheduled') then
    raise exception 'not_bookable' using errcode = 'P0001';
  end if;

  begin
    if p_schedule_id is null then
      insert into public.service_schedules (
        service_id, day_of_week, start_time, end_time, slot_minutes,
        capacity_per_slot, effective_from, effective_until, is_active
      ) values (
        p_service_id, p_day_of_week, p_start_time, p_end_time, p_slot_minutes,
        p_capacity_per_slot, p_effective_from, p_effective_until, p_is_active
      )
      returning * into v_saved;
      v_action := 'service_schedule.create';
    else
      select * into v_previous
      from public.service_schedules
      where id = p_schedule_id and service_id = p_service_id
      for update;
      if not found then
        raise exception 'not_found' using errcode = 'P0001';
      end if;

      update public.service_schedules
        set day_of_week = p_day_of_week,
            start_time = p_start_time,
            end_time = p_end_time,
            slot_minutes = p_slot_minutes,
            capacity_per_slot = p_capacity_per_slot,
            effective_from = p_effective_from,
            effective_until = p_effective_until,
            is_active = p_is_active
        where id = p_schedule_id
        returning * into v_saved;
      v_action := case
        when v_previous.is_active and not p_is_active then 'service_schedule.deactivate'
        else 'service_schedule.update'
      end;
    end if;
  exception
    when check_violation or not_null_violation then
      raise exception 'invalid_period' using errcode = 'P0001';
    when exclusion_violation then
      raise exception 'overlap' using errcode = 'P0001';
  end;

  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id,
    previous_values, new_values
  ) values (
    p_actor_profile_id, v_action, 'service_schedule', v_saved.id::text,
    case when v_previous.id is null then null else jsonb_build_object(
      'service_id', v_previous.service_id,
      'day_of_week', v_previous.day_of_week,
      'start_time', v_previous.start_time,
      'end_time', v_previous.end_time,
      'slot_minutes', v_previous.slot_minutes,
      'capacity_per_slot', v_previous.capacity_per_slot,
      'effective_from', v_previous.effective_from,
      'effective_until', v_previous.effective_until,
      'is_active', v_previous.is_active
    ) end,
    jsonb_build_object(
      'service_id', v_saved.service_id,
      'day_of_week', v_saved.day_of_week,
      'start_time', v_saved.start_time,
      'end_time', v_saved.end_time,
      'slot_minutes', v_saved.slot_minutes,
      'capacity_per_slot', v_saved.capacity_per_slot,
      'effective_from', v_saved.effective_from,
      'effective_until', v_saved.effective_until,
      'is_active', v_saved.is_active
    )
  );

  return v_saved.id;
end;
$$;

revoke all on function public.cammi_connect_admin_save_service_schedule(
  uuid, uuid, uuid, smallint, time, time, integer, integer, date, date, boolean
) from public, anon, authenticated;
grant execute on function public.cammi_connect_admin_save_service_schedule(
  uuid, uuid, uuid, smallint, time, time, integer, integer, date, date, boolean
) to service_role;
