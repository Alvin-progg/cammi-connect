-- CamiConnect — doctor notification "confirmed" type
--
-- Adds the confirmed value to doctor_notification_type, so a doctor is told
-- when the front desk confirms or books one of their appointments. The trigger
-- that writes these rows is 0029_doctor_notification_trigger.sql.
--
-- Run this file ON ITS OWN, after 0027_admin_system_settings.sql and before
-- 0029. PostgreSQL cannot use a newly added enum value in the same
-- transaction that added it, and the Supabase SQL editor runs a script as one
-- transaction.

alter type public.doctor_notification_type add value if not exists 'confirmed';
