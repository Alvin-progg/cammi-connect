# CC-011 — Tooling, CI, and Phase Gates

- Status: Proposed
- Phase: PHASE-00
- Type: Tooling / process decision
- Approval required: yes
- Depends on: CC-001
- Blocks: PHASE-01

## Objective

Ratify the existing test setup, approve missing test/CI tooling, and approve the phase
sequence and gate mapping. No dependencies are installed in this ticket.

## Requirement and specification references

- `AGENTS.md` §Commands, §Test tooling bootstrap
- `TEST.md` §2, §15.1, §15.2
- `SPEC.md` §2.2, §12
- No `FR-*` or `UI-*` requirement is implemented here.

## Current state to ratify

- Vitest `5.0.5`, React Testing Library, `user-event`, `jest-dom`, jsdom.
- Scripts `test`, `test:watch`, `typecheck`.
- One stock component test; no server, integration, API, E2E, or accessibility suites.
- No CI, secret scan, dependency audit, MSW, Playwright, axe-core, Zod, Drizzle, or DB harness.

## Decision required

- Ratify or reject the existing uncommitted tooling.
- Approve additions: Zod, Drizzle/drizzle-kit, MSW, Playwright, axe-core, integration DB
  harness, secret/bundle scan, dependency audit, Prettier/jsx-a11y.
- Select CI provider.
- Approve missing scripts: `db:migrate`, `test:e2e`, `test:a11y`, `test:smoke`.
- Approve Option A or Option B phase sequencing and the gate remap.
- Approve tool versions and lockfile policy.

## Acceptance criteria

- Every tool is marked approved or rejected.
- Approved tools have a purpose, version policy, and install command plan.
- CI stages are listed, including lint, typecheck, test, build, audit, and secret scan.
- Phase gate remap is approved and traceable to `TEST.md`.
- No dependency is installed before approval.
- The lockfile remains `package-lock.json`; `npm` remains the package manager.

## Evidence

- Approved tooling/CI plan.
- Approved phase-gate map.
- Human approval record.

## Out of scope

- Installing tools.
- Writing CI configuration.
- Changing `TEST.md` or acceptance criteria.
