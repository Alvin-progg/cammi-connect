# CC-001 — Reconcile Repository Baseline and Stale Documentation

- Status: Proposed
- Phase: PHASE-00
- Type: Documentation / decision
- Approval required: yes
- Depends on: none
- Blocks: CC-011, PHASE-01

## Objective

Record the actual repository state, preserve uncommitted user work, and reconcile stale
current-state prose in `AGENTS.md` and `README.md` against the real code and tooling.

## Requirement and specification references

- `AGENTS.md` §Current state, §Commands, §Test tooling bootstrap
- `SPEC.md` §11 Repository Structure
- `TEST.md` §2 Tooling
- No `FR-*`, `UI-*`, or test IDs are implemented by this ticket.

## Work

- Record branch, HEAD, staged changes, unstaged changes, and untracked files.
- Record actual tool versions and scripts.
- Run and record: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Identify stale statements in `AGENTS.md` and `README.md`.
- Propose corrections, but do not edit `SPEC.md` or `TEST.md`.
- Confirm uncommitted work is preserved.

## Acceptance criteria

- Baseline record matches `git status --short` at completion.
- Every executed command has its actual result recorded.
- Stale documentation claims are listed with proposed corrections.
- No application code, dependency, schema, or deployment change.
- `SPEC.md` and `TEST.md` are unchanged.
- Human owner approves any edit to `AGENTS.md` or `README.md`.

## Evidence

- `git status --short`
- Command outputs for the four checks above
- Approved documentation diff, if any

## Out of scope

- Fixing the repository.
- Installing or removing dependencies.
- Changing requirements or acceptance criteria.
