# BEN-001 — Patient PWD Benefits and HMO Management

- Status: **Approved** 2026-11-22 (whole spec, per owner request). Built in one slice; QA pending.
- Type: Feature
- Module: Patient Management, Appointment Management, Front Desk, Administrator
- Requirements: `SPEC.md` §17 (`FR-040`–`FR-052`)
- ADRs: `ADR-0010`; touches `ADR-0003` (service_role access), `ADR-0007` (booking policy)
- Source spec: the "Patient PWD Benefits & HMO Management" specification
  (sections 1–14 of that document), summarised in SPEC.md §17.

## Slices

| Slice | Scope | Migration |
|---|---|---|
| BEN-01 | Tables, bucket, submit/decide/accreditation/appointment functions | `0041` |
| BEN-02 | Booking RPCs take saved membership, check PWD verification and accreditation, write `appointment_hmo`; `0037` decisions mirror to `appointment_hmo`; backfill | `0042` |
| BEN-03 | Server layer: repository, service, actions, documents, upload route | — |
| BEN-04 | UI: `/account/benefits`, registration section, `/front-desk/benefits`, request HMO panel, admin doctor HMO tab | — |
| BEN-05 | Chat: PWD chip only when verified, HMO from saved membership, doctor-not-accepted message | — |
| BEN-06 | Docs and traceability: `database.types.ts`, `db/README.md`, `AGENTS.md`, `docs/acceptance-traceability.md`, Cami knowledge doc | — |

## Acceptance criteria

The `SPEC.md` §12 checklist is the acceptance list. Each item is mapped to its
test in `docs/acceptance-traceability.md` once built.

## Out of scope

Billing system, HMO claims or API integration, LOA generation, external
eligibility checks, official receipts, new PWD/HMO combination math (spec §13).
