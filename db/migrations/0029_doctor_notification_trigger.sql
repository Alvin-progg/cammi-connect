-- CamiConnect — doctor notifications from appointment events
--
-- Run after 0028_doctor_notification_confirmed.sql (in a separate run), in the
-- hosted Supabase project's SQL editor. This file can run in one go.
--
-- Until now only the seed script wrote doctor_notifications, so the doctor's
-- notification popover never showed real activity. This trigger writes one
-- row per appointment event, for every writer (Cami booking, front desk
-- booking, and the confirm, reschedule, and cancel functions in 0009–0012),
-- in the same transaction as the change. A rolled-back booking leaves no
-- notification behind.
--
--   insert, status requested        -> new_request  "New request: <patient>"
--   insert, status confirmed        -> confirmed    "Booked by the front desk: <patient>"
--   requested -> confirmed          -> confirmed    "Confirmed by the front desk"
--   -> cancelled (not by the doctor)-> cancelled    "Cancelled: <patient>"
--   scheduled_at changed            -> rescheduled  "Rescheduled by the front desk"
--
-- Rejections, check-ins, completions, and no-shows do not notify. Times are
-- shown in Asia/Manila. The table keeps its 0002 access model: RLS on, no
-- policies, and no anon/authenticated access (ADR-0003).

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

drop trigger if exists appointments_notify_doctor on public.appointments;
create trigger appointments_notify_doctor
after insert or update on public.appointments
for each row execute function public.cammi_connect_notify_doctor();
