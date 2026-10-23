# PHASE-00 — Specification Review and Decision Closure

- Status: Proposed
- Phase gate: G0
- Depends on: none
- Blocks: PHASE-01, PHASE-02
- Approval: human project owner
- Date: 2026-10-23

## Objective

Resolve the open architectural, security, provider, and product decisions that would
otherwise cause rework or unsafe implementation in later phases. Ratify the actual
repository state and the test/CI tooling baseline. Produce an approved Phase 1 handoff.

No application code, dependencies, schema, migrations, or deployment changes are made
in this phase.

## Entry criteria

- Planning report reviewed.
- Current uncommitted work preserved.
- Human owner agrees to start Phase 0.
- `SPEC.md`, `TEST.md`, and `AGENTS.md` remain the source of truth.

## Scope

### In scope

- Repository baseline reconciliation and stale-document corrections.
- Architecture decision records for auth, hosting, database/RLS, ingestion jobs,
  storage/rate limiting, and provider contracts.
- Product/security policy decisions for appointments, chat access, analytics,
  i18n, and existing UI.
- Synthetic corpus and evaluation-data plan.
- Test tooling, CI, and phase-gate approval plan.
- Phase 1 and Phase 2 entry criteria.

### Out of scope

- Application code or route handlers.
- Installing dependencies.
- Creating database schemas or migrations.
- Implementing authentication, RAG, appointments, analytics, or UI.
- Editing `SPEC.md`, `TEST.md`, or acceptance criteria.
- Deployment, commits, merges, or destructive database commands.
- Real patient data.

## Deliverables

- `specs/phases/PHASE-00-decisions.md` (this file).
- `specs/tasks/CC-001` through `CC-011`.
- `specs/decisions/ADR-0001` through `ADR-0009`.
- Approved decision records, or explicit deferrals with deadlines.
- Approved tooling/CI plan.
- Approved phase-gate mapping.
- Handoff statement for Phase 1.

## Requirements covered

Phase 0 implements no `FR-*` or `UI-*` requirement. It governs all of them by resolving
the decisions that block their implementation and verification.

| Requirement | Why Phase 0 matters |
|---|---|
| `FR-001` | Chat access policy, provider contract, rate-limit store |
| `FR-002` | Auth for admin operations, storage, ingestion jobs |
| `FR-003` | Auth provider and identity ownership |
| `FR-004` | Appointment policy, doctor scope, timezone |
| `FR-005` | Doctor scope and minimum patient fields |
| `FR-006` | Role model, audit model, admin authorization |
| `FR-007` | Analytics explanation policy and data definitions |
| `UI-001` | Chat access, safety copy, i18n |
| `UI-002` | Auth provider and session model |
| `UI-003` | Appointment policy and availability rules |
| `UI-004` | Doctor scope and patient-field minimization |
| `UI-005` | Admin roles, storage, KB approval workflow |
| `UI-006` | Analytics explanation policy, i18n, accessible charts |

## Ordered tickets

| Order | Ticket | Output | Depends on |
|---|---|---|---|
| 1 | [`CC-001`](../tasks/CC-001-baseline-reconciliation.md) | Baseline and stale-doc reconciliation | None |
| 2 | [`CC-002`](../tasks/CC-002-auth-provider-and-identity.md) | `ADR-0001` | CC-001 |
| 3 | [`CC-004`](../tasks/CC-004-database-connections-and-rls.md) | `ADR-0003` | CC-001 |
| 4 | [`CC-011`](../tasks/CC-011-tooling-ci-and-phase-gates.md) | Tooling/CI and phase-gate approval | CC-001 |
| 5 | [`CC-003`](../tasks/CC-003-hosting-and-serverless-limits.md) | `ADR-0002` | CC-001 |
| 6 | [`CC-005`](../tasks/CC-005-ingestion-job-execution.md) | `ADR-0004` | CC-004 |
| 7 | [`CC-006`](../tasks/CC-006-storage-and-rate-limiting.md) | `ADR-0005` | CC-003 |
| 8 | [`CC-007`](../tasks/CC-007-provider-contracts.md) | `ADR-0006` | None |
| 9 | [`CC-008`](../tasks/CC-008-appointment-and-doctor-policy.md) | `ADR-0007` | None |
| 10 | [`CC-009`](../tasks/CC-009-chat-analytics-i18n-ui-policy.md) | `ADR-0008` | CC-002 |
| 11 | [`CC-010`](../tasks/CC-010-corpus-and-evaluation.md) | `ADR-0009` | None |

## Acceptance criteria

- Every decision ticket is either approved or explicitly deferred with a deadline.
- No decision is made by an agent without human approval.
- The actual repository state and stale documentation are recorded.
- Test tooling is either ratified or rejected; missing tools and scripts are listed.
- The Phase 1 and Phase 2 entry conditions are unambiguous.
- The phase-gate mapping is approved, including any deviation from `TEST.md` §15.1.
- No application code, dependency, schema, migration, or deployment is changed.

## Required verification

This phase is documentation-only.

- Review `git diff -- specs/` and confirm changes are limited to approved Phase 0 files.
- Confirm `SPEC.md`, `TEST.md`, and `AGENTS.md` are unchanged unless separately approved.
- Confirm no dependency files changed.
- Record the actual results of any command used as evidence.
- Do not claim a test, build, or lint passed unless it was executed.

## Exit criteria

- G0 approved by the human owner.
- `ADR-0001` through `ADR-0009` are approved or explicitly deferred.
- Test tooling and CI plan is approved.
- Option A or Option B phase sequence is approved.
- Phase 1 entry criteria are satisfied.
- Handoff evidence is linked from each ticket.

## Unresolved decisions and risks

- Option A versus Option B phase sequencing is not approved yet.
- Auth provider, hosting, job mechanism, storage, rate-limit store, and provider
  contracts remain open until their ADRs are approved.
- Test tooling was partially added without ratification; this phase must resolve it.
- `SPEC.md` §12 places authentication after knowledge-base and chat work; this creates
  a security sequencing gap unless Option A or Option B is explicitly approved.
- Real hospital documents are not available for development; synthetic fixtures only
  until approval.
- Analytics AI explanations may or may not be required; no implementation until
  `ADR-0008` is approved.

## Handoff to Phase 1

Phase 1 may begin only when:

- The tooling/CI plan is approved.
- The local database and RLS approach is approved.
- Hosting is approved if the Phase 1 deployment spike is included.
- `AGENTS.md` and `README.md` corrections are approved.
- Phase 1 tickets are created from the approved roadmap.

Handoff evidence:

- Approved ADRs.
- Approved tooling list and commands.
- Approved Option A/B gate mapping.
- Actual baseline command results.
- No unresolved decision that blocks Phase 1.
