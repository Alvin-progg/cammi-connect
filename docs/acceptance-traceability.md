# Administrator module: acceptance traceability

Maps each "Tests first" item in `pr-admin.md` (ADM-00 to ADM-16) to the place it is verified. The full specification's §20 checklist is not in the repository, so this table follows the slices instead.

Status values:

- **test**: an automated Vitest test, run by `npm test`.
- **static**: an automated test that reads source or migration files instead of running against a database.
- **manual**: the smoke steps in `db/README.md`, run against the hosted Supabase project.
- **gap**: not verified yet. RLS and integration items need a database, and there is no local one (ADR-0003). E2E items need Playwright, which is not installed.

Authorization model note: under ADR-0003, every table has RLS on with no policies, and `anon`/`authenticated` have no table access. "RLS: role X can/can't …" items therefore become "only the service-role server can read or write, after a session guard." That is covered by the static route and action checks in ADM-16, and not by per-role policies.

## ADM-00 Foundation

| Item | Status | Where |
|---|---|---|
| Session guard: no session, wrong role, inactive, admin passes | test | `tests/unit/auth/admin-session.test.ts` |
| Audit redaction strips sensitive keys, nested too | test | `tests/unit/audit/redact.test.ts`, `tests/unit/audit/service.test.ts` |
| Non-admin cannot change their own role | manual / gap | trigger in `0014`; `db/README.md` (0014) |
| Non-admin cannot read `audit_logs`; nobody can update or delete it | manual / gap | `0013` grants; no direct table access under ADR-0003 |
| Patient visiting `/admin` is denied; admin sees the shell | test | `tests/unit/security/admin-routes.test.ts`, `tests/component/admin/admin-shell.test.tsx` |

## ADM-01 Users and roles

| Item | Status | Where |
|---|---|---|
| Guard rails (self-demote, last admin) | test | `tests/unit/users/guards.test.ts` |
| Role change by non-admin denied; by admin changes the role and writes an audit row | test + manual | `tests/unit/users/actions.test.ts`, `service.test.ts`; `0014` |
| Deactivated user is denied | test | `tests/unit/auth/admin-session.test.ts` and the other `*-session` tests |
| Responses never include password, hash, or token fields | test | `tests/unit/users/repository-mapping.test.ts` |
| Invite a front desk user, who then appears in the list | manual / gap (E2E) | `db/README.md` (ADM-01) |

## ADM-02 Departments, ADM-03 Specialties, ADM-07 Services

| Item | Status | Where |
|---|---|---|
| Form schemas (required, length, trim) | test | `tests/unit/{departments,specialties,services}/schemas.test.ts` |
| Case-insensitive duplicate rejected | test + manual | the `service.test.ts` refusal mapping; unique indexes in `0015`/`0016`/`0021` |
| Deactivation refused while future appointments exist | test + manual | `tests/unit/departments/service.test.ts`; `0015` |
| Patients see active records only; non-admin writes denied | static + manual | `tests/unit/security/server-actions.test.ts`; `0015`/`0016`/`0021` |
| Create, edit, deactivate | manual / gap (E2E) | `db/README.md` |

## ADM-04 Doctors

| Item | Status | Where |
|---|---|---|
| Schema (at least 1 specialty, valid department) | test | `tests/unit/doctors/schemas.test.ts` |
| Specialty replacement is atomic; linking a non-doctor account is rejected | manual / gap | `0017` functions |
| Contact fields are admin-only; doctor A cannot update doctor B | static + test | session-scoped IDs in `tests/unit/schedules/actions.test.ts` and `tests/unit/doctors/actions.test.ts` |
| Registered doctor is bookable; deactivated doctor is not | test + gap (E2E) | `tests/unit/availability/service.test.ts`, `tests/unit/chat/tools.test.ts` |

## ADM-05 Weekly schedules, ADM-06 Exceptions

| Item | Status | Where |
|---|---|---|
| Slot generation and boundaries | test | `tests/unit/schedules/slots.test.ts` |
| Overlap detection matrix | test | `tests/unit/schedules/periods.test.ts`, `availability.test.ts` |
| Availability is weekly hours minus exceptions; holidays apply to all doctors | test | `tests/unit/schedules/availability.test.ts`, `tests/unit/availability/service.test.ts` |
| An edit or exception that would orphan an appointment is refused | test + manual | `tests/unit/schedules/service.test.ts`; `0018`/`0020` |
| DB constraint rejects overlap; concurrent inserts allow exactly one | manual / gap | `appointments_no_active_overlap` |
| Patient sees the configured slots | gap (E2E) | |

## ADM-08 Requirements

| Item | Status | Where |
|---|---|---|
| "Currently effective" predicate | test | `tests/unit/requirements/effective.test.ts` |
| Supersede keeps the old row with an end date | test + manual | `tests/unit/requirements/service.test.ts`; `0022`/`0024` |
| Drafts are not visible to patients | n/a | requirements are admin-only for now (D7) |

## ADM-09 Monitoring

| Item | Status | Where |
|---|---|---|
| Every status change writes an `appointment_audit_logs` row | static | `tests/unit/appointments/audit-coverage.test.ts` |
| Filter combinations | test | `tests/unit/appointments/monitoring.test.ts`, `tests/unit/appointments-monitoring/service.test.ts` |
| Non-admin is denied | static | `tests/unit/security/admin-routes.test.ts` |
| Filter, then open a detail page with the timeline | gap (E2E) | |

## ADM-10 to ADM-12 Analytics and dashboard

| Item | Status | Where |
|---|---|---|
| KPI values, null denominators, Manila month boundary, pending/rejected excluded, filters | test | `tests/unit/analytics/metrics.test.ts`, `service.test.ts` |
| Filter and URL serialization; previous period | test | `tests/unit/analytics/filters.test.ts`, `period.test.ts`, `tests/unit/admin/dashboard.test.ts` |
| CSV serializer and export route (403 for non-admins, audited) | test | `tests/unit/analytics/csv.test.ts`, `export-route.test.ts` |
| No patient identifiers | static | `tests/unit/security/analytics-privacy.test.ts` |
| Dashboard numbers | test | `tests/unit/analytics/dashboard-service.test.ts` |
| Charts update and the CSV downloads | gap (E2E) | |

## ADM-13, ADM-14 Knowledge base

| Item | Status | Where |
|---|---|---|
| Status transitions | test | `tests/unit/knowledge/transitions.test.ts` |
| Content normalization and hash | test | `tests/unit/knowledge/content.test.ts` |
| Upload rejects the wrong MIME type or an oversized file | test | `tests/unit/knowledge/schemas.test.ts`, `extract-text.test.ts` |
| Chunker | test | `tests/unit/chat/rag/chunking.test.ts` |
| Gemini retries and clean failure | test | `tests/unit/ai/gemini-embeddings.test.ts`, `http.test.ts` |
| Ingestion: swap, stale, failure keeps the old chunks, drafts skipped | test (fakes) + manual | `tests/unit/knowledge/ingest.test.ts`; `0026` |
| Archived documents are never retrieved | manual / gap | `0026` deletes chunks; the match function filters on published |
| Provider keys are not in the client bundle | static | `npm run check:bundle` (after `npm run build`) |

## ADM-15 Settings

| Item | Status | Where |
|---|---|---|
| Each schema: bounds, unknown key rejected | test | `tests/unit/settings/schema.test.ts` |
| Non-admin denied; admin save writes an audit row with the diff | test + manual | `tests/unit/settings/actions.test.ts`, `service.test.ts`; `0027` |
| `enabled_categories` limits retrieval | test + manual | `tests/unit/knowledge/service.test.ts`; `0027` |
| Welcome message shows in the patient chat | test + manual | `tests/component/chat/chat-shell.test.tsx`; `db/README.md` (0027) |

## ADM-16 Audit log and hardening

| Item | Status | Where |
|---|---|---|
| Viewer: filters, Manila time, linked targets, read-only | test | `tests/unit/audit/log.test.ts`, `tests/component/audit-log/audit-log.test.tsx` |
| Detail diff of previous and new values | test | `tests/unit/audit/log.test.ts`, `tests/component/audit-log/audit-log.test.tsx` |
| CSV export: admin only, audited as `audit.export`, row cap | test | `tests/unit/audit/export-route.test.ts`, `reader-service.test.ts` |
| Required audit events (§16) are written | static | `tests/unit/audit/required-events.test.ts` |
| Every admin page and API route checks the admin session | static | `tests/unit/security/admin-routes.test.ts` |
| Every Server Action checks a session | static | `tests/unit/security/server-actions.test.ts` |
| No credential keys in audit payloads | test + static | `tests/unit/audit/redact.test.ts`, `tests/unit/security/audit-payloads.test.ts` |
| Bundle contains no server secrets | static | `npm run check:bundle` |
| RLS matrix (role × table × operation) | gap | needs a database; see the ADR-0003 note above |
| PostgREST privilege escalation as each role | gap | needs a database; the anon/authenticated revokes are in every migration |
| E2E critical paths 1–5 | gap | Playwright not installed |
