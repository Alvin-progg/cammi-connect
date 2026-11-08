-- 0030: indexes for hot list and filter queries.
--
-- Existing indexes lead with doctor_id, patient_id, or appointment_id, so
-- queries that filter only by date, status, or actor fell back to sequential
-- scans. These cover the front desk queue, day schedule, and dashboard feeds,
-- admin appointment monitoring, analytics, the admin dashboard activity feed,
-- and the audit log actor and action-prefix filters.
--
-- Plain non-unique indexes: no data change, safe to re-run.

create index if not exists appointments_scheduled_at_idx
  on public.appointments (scheduled_at);

create index if not exists appointments_status_created_at_idx
  on public.appointments (status, created_at);

create index if not exists appointments_confirmed_at_idx
  on public.appointments (confirmed_at desc);

create index if not exists appointments_status_updated_at_idx
  on public.appointments (status, updated_at desc);

create index if not exists appointment_audit_logs_created_at_idx
  on public.appointment_audit_logs (created_at desc);

create index if not exists audit_logs_actor_created_at_idx
  on public.audit_logs (actor_profile_id, created_at desc);

-- text_pattern_ops lets `action like 'department.%'` use the index.
create index if not exists audit_logs_action_pattern_idx
  on public.audit_logs (action text_pattern_ops);
