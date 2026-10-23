# CamiConnect — Agent Guide

## Current state

- Next.js 16 App Router scaffold only: `src/app/` contains the stock create-next-app page. No API routes, database, auth, tests, CI, or pre-commit hooks yet.
- `SPEC.md` is the target design and requirements; `TEST.md` is the test plan. Neither describes implemented code. Verify paths and scripts before relying on them.
- `README.md` is the untouched create-next-app readme. Trust `package.json` and config files over prose.
- `specs/features`, `specs/decisions`, and `specs/tasks` exist but are empty.

## Commands

```bash
npm run dev          # http://localhost:3000
npm run lint         # ESLint flat config (eslint-config-next)
npx tsc --noEmit     # typecheck; there is no npm script
npm run build
```

- Use npm; `package-lock.json` is the lockfile.
- No test framework is installed. `npm test`, `npm run test:e2e`, `npm run typecheck`, and the database/migration commands in `TEST.md` §2.2 do not exist yet.
- Before reporting done: run `npm run lint` and `npx tsc --noEmit`; run `npm run build` after route or config changes.

## Wiring

- The App Router lives at `src/app`. `@/*` maps to `src/` (`./src/*`), so imports look like `@/app/...` (tests) or `@/server/...` (future server code).
- Tailwind v4 is wired through the `@tailwindcss/turbopack` loader in `next.config.ts`; `src/app/globals.css` uses `@import "tailwindcss"`. Do not add a PostCSS config or replace this pipeline.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`; do not assume classic Next.js caching defaults.
- Route types such as `LayoutProps<"/">` are generated into `.next/types`. Use them; do not hand-write or import them.

## Autonomy and approval

Within an approved task you may implement the feature, write tests, run checks, fix ordinary defects, and refactor without changing behavior.

Stop and request approval before:

- Creating or changing specifications or acceptance criteria.
- Expanding scope, making architectural decisions, or changing system boundaries.
- Making consequential security, authentication, authorization, or privacy decisions.
- Adding dependencies or development tooling.
- Integrating work across modules or branches; committing, merging, or deploying.
- Destructive database operations.

If blocked, stop the affected work, explain the impact, propose options, and wait for approval.

## Non-negotiables

- Once `src/server/` exists, it is server-only. Secrets stay server-side; never in `NEXT_PUBLIC_*` or client code.
- Enforce authorization in handlers and the service/data layer; never rely on middleware or UI visibility.
- Availability, appointments, and analytics come from authoritative database data. Never let the LLM confirm availability or bookings.
- Synthetic data only; no real patient data in fixtures, screenshots, or traces.
- Schema changes go through migrations; never run destructive database commands without approval.
- TDD: write the failing test first, implement minimally, and never weaken, skip, or delete assertions to pass.
- Never change a public API contract silently; update schemas, handler### Implementation discipline

Before adding an abstraction, helper, dependency, or architectural layer, determine whether it is necessary for the current approved task.

Prefer the smallest maintainable change that satisfies the acceptance criteria. Do not build for hypothetical requirements, refactor unrelated code, or introduce patterns solely because they are considered best practices.

When multiple reasonable solutions exist, prefer the simplest solution consistent with the approved architecture, existing conventions, security requirements, and testability.
My recommendation: keep this section alongside your existing TDD, security, and autonomy rules. These principles should guide every ticket, while the ticket's acceptance criteria determine what actually needs to be implemented.s, client, mocks, and tests together.
- On conflict, follow this order: safety/security/privacy > approved scope > `SPEC.md`/`TEST.md` > this file > agent preference.
- Report only checks actually run and their real results. Never claim an unexecuted test, build, or lint passed.


## Task execution and traceability

Before starting a task:

1. Inspect the relevant repository files, `git status`, and existing changes.
2. Identify the approved specification, requirement IDs, acceptance criteria, and applicable tests.
3. Confirm that the task is sufficiently defined and within the approved scope.
4. If the task requires an unapproved specification change, architectural decision, or dependency, stop and request approval.

For each task, maintain traceability between requirements, tests, implementation, and verification results. Keep changes focused and avoid unrelated refactoring. Never overwrite, revert, or discard unrelated user changes.

## Test tooling bootstrap

No test framework is currently installed. Do not assume test commands or test infrastructure exist.

Before implementing the first feature that requires automated tests, request approval to establish the required test tooling. Once approved, add the tooling and scripts, verify the setup, and document the actual commands. Follow the existing package manager and lockfile.

Until automated tests are available, report that limitation explicitly. Do not describe a feature as fully TDD-verified if its required tests were not written and executed.

## Integration boundaries

Integration within an approved feature is allowed when it does not change approved architecture, public contracts, security boundaries, or scope.

Stop for approval before merging branches, changing major system boundaries, introducing cross-module architectural changes, or integrating work that requires an unapproved contract or design decision.

## Task completion report

For each completed task, report:

- Requirement IDs and acceptance criteria addressed.
- Files and behavior changed.
- Tests written and whether they failed before implementation.
- Actual test, lint, type-check, and build results.
- Known limitations, skipped checks, and unresolved risks.
- Any required human review or approval.

Do not claim completion of acceptance criteria that have not been verified.

<!-- BEGIN:nextjs-agent-rules -->### Implementation discipline

Before adding an abstraction, helper, dependency, or architectural layer, determine whether it is necessary for the current approved task.

Prefer the smallest maintainable change that satisfies the acceptance criteria. Do not build for hypothetical requirements, refactor unrelated code, or introduce patterns solely because they are considered best practices.

When multiple reasonable solutions exist, prefer the simplest solution consistent with the approved architecture, existing conventions, security requirements, and testability.
My recommendation: keep this section alongside your existing TDD, security, and autonomy rules. These principles should guide every ticket, while the ticket's acceptance criteria determine what actually needs to be implemented.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
### Implementation discipline

Before adding an abstraction, helper, dependency, or architectural layer, determine whether it is necessary for the current approved task.

Prefer the smallest maintainable change that satisfies the acceptance criteria. Do not build for hypothetical requirements, refactor unrelated code, or introduce patterns solely because they are considered best practices.

When multiple reasonable solutions exist, prefer the simplest solution consistent with the approved architecture, existing conventions, security requirements, and testability.
My recommendation: keep this section alongside your existing TDD, security, and autonomy rules. These principles should guide every ticket, while the ticket's acceptance criteria determine what actually needs to be implemented.
<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.



<!-- END:nextjs-agent-feedback -->
## Code Quality and Readability

### Core principles

- Write code for human readability first and machine execution second.
- Prefer simple, explicit, and maintainable solutions over clever, overly abstract, or unnecessarily compact code.
- Optimize for clarity, correctness, and maintainability before micro-optimizations.
- Follow the existing project conventions and established patterns unless they introduce a concrete problem.
- Avoid unnecessary complexity, premature abstraction, and speculative flexibility.
- Every abstraction must justify its existence by improving clarity, reuse, testability, or separation of responsibilities.

### Naming and structure

- Use descriptive, intention-revealing names for variables, functions, types, components, and modules.
- Avoid vague names such as `data`, `result`, `handler`, `manager`, or `utils` when a more specific name is practical.
- Keep functions and components focused on one clear responsibility.
- Keep files organized around cohesive responsibilities rather than unrelated collections of functionality.
- Prefer early returns and guard clauses when they make control flow easier to follow.
- Avoid deeply nested conditionals and unnecessarily long functions.
- Extract repeated logic when doing so meaningfully improves consistency and readability.
- Do not extract trivial expressions into excessive helper functions merely to reduce line count.

### Complexity and duplication

- Follow the principle of doing the simplest thing that correctly satisfies the approved requirements.
- Avoid premature generalization, unnecessary design patterns, and abstractions for hypothetical future requirements.
- Follow DRY when duplication represents shared behavior or a genuine maintenance risk. Do not force unrelated code into a common abstraction merely because it looks similar.
- Avoid deeply coupled modules, circular dependencies, and hidden side effects.
- Keep business rules separate from presentation, infrastructure, and external service integrations where appropriate to the approved architecture.
- Do not introduce additional architectural layers unless they provide a concrete benefit.

### TypeScript and type safety

- Prefer explicit, meaningful types for public interfaces, API contracts, domain models, and complex function boundaries.
- Let TypeScript infer straightforward local types when the inferred type is clear.
- Avoid `any`, unsafe type assertions, non-null assertions, and type suppression directives unless justified by a documented constraint.
- Never use type casts to hide an actual type error.
- Validate untrusted input at system boundaries, including API requests, external service responses, and persisted data where appropriate.
- Represent meaningful states and outcomes with types instead of relying on ambiguous strings or loosely structured objects.
- Keep types aligned with actual runtime behavior.

### Comments and documentation

- Write code that explains itself through good naming and structure.
- Add comments to explain intent, non-obvious reasoning, constraints, trade-offs, or surprising behavior.
- Do not add comments that merely repeat what the code already says.
- Document important business rules, security assumptions, public interfaces, and non-obvious architectural decisions.
- Update relevant documentation when behavior, contracts, or implementation assumptions change.
- Remove outdated or misleading comments when encountered within the approved task.

### Error handling and side effects

- Handle errors explicitly at appropriate system boundaries.
- Do not silently swallow exceptions or replace meaningful errors with misleading success responses.
- Avoid broad catch blocks unless there is a clear recovery or translation strategy.
- Keep side effects visible and predictable.
- Avoid hidden mutations and unexpected changes to shared state.
- Do not introduce fallback behavior that conceals configuration errors, provider failures, or invalid data.
- Never expose secrets, sensitive information, or internal error details in client-facing responses or logs.

### Refactoring

- Refactor only when it improves correctness, readability, duplication, cohesion, or maintainability.
- Keep refactoring separate from unrelated behavior changes whenever practical.
- Preserve existing public contracts and observable behavior unless a change is explicitly approved.
- Make behavior-preserving refactors in small, verifiable steps.
- Run relevant tests before and after refactoring.
- Do not refactor unrelated files merely to impose personal stylistic preferences.

### Dependencies and implementation choices

- Prefer existing project utilities, dependencies, and established patterns when appropriate.
- Do not introduce a new dependency when a small, clear implementation using existing tools is sufficient.
- Request approval before adding dependencies or changing approved architectural patterns, as required by the autonomy rules.
- Avoid unnecessary configuration, wrapper functions, compatibility layers, and boilerplate.

### Definition of readable code

Before reporting a task complete, verify that:

- Names communicate intent.
- Functions and modules have cohesive responsibilities.
- Control flow is easy to follow.
- Types accurately represent expected inputs and outputs.
- Errors and side effects are handled deliberately.
- Duplication and abstractions are justified.
- Comments explain why when the reason is not obvious.
- The implementation follows established project conventions.
- Tests verify behavior without being weakened to accommodate the implementation.

Readable code does not mean minimizing line count. Prefer the clearest implementation that satisfies the approved requirements without unnecessary complexity.

### Implementation discipline

Before adding an abstraction, helper, dependency, or architectural layer, determine whether it is necessary for the current approved task.

Prefer the smallest maintainable change that satisfies the acceptance criteria. Do not build for hypothetical requirements, refactor unrelated code, or introduce patterns solely because they are considered best practices.

When multiple reasonable solutions exist, prefer the simplest solution consistent with the approved architecture, existing conventions, security requirements, and testability.