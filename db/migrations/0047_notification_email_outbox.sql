-- CamiConnect — email outbox for notifications
--
-- Run in the hosted Supabase project's SQL editor after
-- 0046_patient_notification_benefit_types.sql (in a separate run). This file
-- can run in one go.
--
-- The trigger-written notification rows double as an email outbox. The app
-- (src/server/notifications/email-service.ts) claims a row by setting
-- emailed_at, sends the email, and on failure clears emailed_at and bumps
-- email_attempts so a later run retries it. A rolled-back change writes no row,
-- so no email is sent for it.
--
-- Also adds patient notifications for front desk PWD and HMO membership
-- decisions (0041). Like 0044, the text is fixed: no ID numbers, member
-- numbers, or rejection reasons. Walk-in patients have no sign-in, so no row
-- is written for them.

alter table public.patient_notifications
  add column if not exists emailed_at timestamptz,
  add column if not exists email_attempts smallint not null default 0;

alter table public.doctor_notifications
  add column if not exists emailed_at timestamptz,
  add column if not exists email_attempts smallint not null default 0;

-- Rows written before this migration are not emailed.
update public.patient_notifications set emailed_at = created_at where emailed_at is null;
update public.doctor_notifications set emailed_at = created_at where emailed_at is null;

create index if not exists patient_notifications_email_pending_idx
  on public.patient_notifications (created_at)
  where emailed_at is null;

create index if not exists doctor_notifications_email_pending_idx
  on public.doctor_notifications (created_at)
  where emailed_at is null;

create or replace function public.cammi_connect_notify_patient_benefit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_has_sign_in boolean;
  v_type public.patient_notification_type;
  v_title text;
  v_body text;
begin
  if new.verification_status is not distinct from old.verification_status then
    return null;
  end if;

  if tg_table_name = 'patient_pwd' then
    if new.verification_status = 'verified' then
      v_type := 'pwd_verified';
      v_title := 'PWD ID verified';
      v_body := 'Your PWD discount now applies to eligible bookings.';
    elsif new.verification_status = 'rejected' then
      v_type := 'pwd_rejected';
      v_title := 'PWD ID not verified';
      v_body := 'Open your benefits page for details.';
    end if;
  else
    if new.verification_status = 'verified' then
      v_type := 'hmo_membership_verified';
      v_title := 'HMO membership verified';
      v_body := 'You can now choose this HMO when you book.';
    elsif new.verification_status = 'rejected' then
      v_type := 'hmo_membership_rejected';
      v_title := 'HMO membership not verified';
      v_body := 'Open your benefits page for details.';
    end if;
  end if;

  if v_type is null then
    return null;
  end if;

  select auth_user_id is not null into v_has_sign_in
  from public.profiles
  where id = new.patient_id;

  if coalesce(v_has_sign_in, false) then
    insert into public.patient_notifications (patient_id, type, title, body)
    values (new.patient_id, v_type, v_title, v_body);
  end if;

  return null;
end;
$$;

revoke all on function public.cammi_connect_notify_patient_benefit()
  from public, anon, authenticated;

drop trigger if exists patient_pwd_notify_patient on public.patient_pwd;
create trigger patient_pwd_notify_patient
after update of verification_status on public.patient_pwd
for each row execute function public.cammi_connect_notify_patient_benefit();

drop trigger if exists patient_hmo_notify_patient on public.patient_hmo;
create trigger patient_hmo_notify_patient
after update of verification_status on public.patient_hmo
for each row execute function public.cammi_connect_notify_patient_benefit();
