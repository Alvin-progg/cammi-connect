-- CamiConnect — hospital-wide holiday exception type (ADM-06)
--
-- Run after 0018_admin_schedules.sql, in the hosted Supabase project's SQL
-- editor, ON ITS OWN. Postgres cannot use a new enum value in the same
-- transaction that adds it, and 0020 uses 'holiday' in a check constraint.

alter type public.schedule_exception_type add value if not exists 'holiday';
