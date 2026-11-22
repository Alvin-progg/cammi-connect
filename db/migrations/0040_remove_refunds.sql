-- CamiConnect — remove refunds (no-refund policy)
--
-- Run after 0039_payment_expiry.sql, in the hosted Supabase project's SQL
-- editor, after a backup of public.payments and public.payment_events. This
-- file can run in one go, and again (every step is idempotent).
--
--   * Drops the D4 refund trigger and its functions (0036). A verified payment
--     now stays verified when its appointment is cancelled or rejected.
--   * Existing refund_due and refunded payments go back to verified. Their
--     refund history rows (refund_due, no_refund, refunded in payment_events)
--     are deleted, because the append-only check constraint no longer allows
--     them. payment_events is append-only, so its immutability trigger is
--     disabled only for the delete and re-enabled in the same script.
--   * Drops payments.refund_reference, refunded_by, and refunded_at.
--   * Removes payment.refund_cutoff_hours from system_settings and from the
--     allow-list of cammi_connect_admin_save_settings (body from 0033).
--
-- The payment_status enum keeps its refund_due and refunded labels: Postgres
-- cannot drop enum values in place, and three booking functions return
-- payment_status in their RETURNS TABLE. Nothing writes those labels any more.

-- ---------------------------------------------------------------------------
-- Refund trigger and functions (0036)
-- ---------------------------------------------------------------------------

drop trigger if exists appointments_payment_refund on public.appointments;
drop function if exists public.cammi_connect_payment_refund_on_cancel();
drop function if exists public.cammi_connect_mark_refunded(uuid, uuid, text);

-- ---------------------------------------------------------------------------
-- Existing refund rows
-- ---------------------------------------------------------------------------

update public.payments
set status = 'verified'
where status in ('refund_due', 'refunded');

alter table public.payment_events disable trigger payment_events_immutable;
delete from public.payment_events
where action in ('refund_due', 'no_refund', 'refunded');
alter table public.payment_events enable trigger payment_events_immutable;

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
      'expired'
    )
  );

-- ---------------------------------------------------------------------------
-- Refund columns
-- ---------------------------------------------------------------------------

alter table public.payments drop column if exists refund_reference;
alter table public.payments drop column if exists refunded_by;
alter table public.payments drop column if exists refunded_at;

-- ---------------------------------------------------------------------------
-- Setting and settings save function (body from 0033, without the key)
-- ---------------------------------------------------------------------------

delete from public.system_settings where key = 'payment.refund_cutoff_hours';

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
    'payment.max_receipts'
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
