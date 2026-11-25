-- CamiConnect — patient notification types for PWD and HMO membership decisions
--
-- Run in the hosted Supabase project's SQL editor ON ITS OWN, before
-- 0047_notification_email_outbox.sql. Postgres cannot use a new enum value in
-- the same transaction that adds it.

alter type public.patient_notification_type add value if not exists 'pwd_verified';
alter type public.patient_notification_type add value if not exists 'pwd_rejected';
alter type public.patient_notification_type add value if not exists 'hmo_membership_verified';
alter type public.patient_notification_type add value if not exists 'hmo_membership_rejected';
