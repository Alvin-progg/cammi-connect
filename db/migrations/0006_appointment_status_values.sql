-- CamiConnect — front desk appointment statuses (FD-001, PR 1)
--
-- Adds the two statuses the front desk lifecycle needs (SPEC-frontdesk §11):
--   * rejected    — staff declined a pending request (reason required, 0007)
--   * checked_in  — the patient arrived for a confirmed appointment
--
-- `requested` stays the stored value for what the spec calls
-- `pending_confirmation`; only the UI label changes.
--
-- Run this file ON ITS OWN, before 0007_appointment_lifecycle_audit.sql.
-- PostgreSQL cannot use a newly added enum value in the same transaction that
-- added it, and the Supabase SQL editor runs a script as one transaction.

alter type public.appointment_status add value if not exists 'rejected';
alter type public.appointment_status add value if not exists 'checked_in';
