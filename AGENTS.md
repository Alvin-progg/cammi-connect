# CamiConnect — Agent Guide

## Current state

- Implemented slices: Supabase Auth (`/login`, `/register`, `/account`, `/auth/callback`), and the doctor dashboard suite at `/doctor` (kanban board, list, schedule & availability calendar, notifications, statistics, profile) with Supabase-backed appointments, schedules, blocked slots, notifications, and status history.
- Doctor, specialty, and schedule management (DOC-SCH-001): admin directory and schedule management at `/admin`, multiple effective-dated consultation periods, typed schedule exceptions, server-side slot generation, and the atomic `cammi_connect_book_appointment` function.
- Front desk module (FD-001, in progress): PR 1 lifecycle schema and append-only `appointment_audit_logs`; PR 2 `front_desk` role, `getFrontDeskSession`, and the `/front-desk` shell; PR 3 Cami request queue (`/front-desk/requests`) and request details with audit history; PR 4 atomic confirm/reject (`0009` functions) by front desk only — doctors no longer confirm; PR 5 daily schedule (`/front-desk/schedule`) and atomic check-in/completed/no-show (`0010` function); doctors may complete checked-in visits; PR 6 atomic reschedule (same doctor, free-slot picker at `/front-desk/requests/[id]/reschedule`) and cancel with preset reasons (`0011` functions); PR 7 staff-assisted booking at `/front-desk/book` (patient search, walk-in patient records with no login, bookings confirmed at once by the `0012` function); PR 8 dashboard overview at `/front-desk` (Manila-day summary cards, pending first, today's schedule, recent activity, patient name/phone quick search; no migration); PR 8a UI pass (shared `Button` in `src/components/ui/button.tsx` built with cva/clsx, base-ui dialogs, labelled table frames, ⌘K quick-search palette via cmdk and the read-only `searchAppointmentsQuickAction`).
- Administrator module (`spec-admin.md`, in progress): ADM-00 `/admin/<section>` routes with a 13-item sidebar (unbuilt sections show placeholders), `profiles.is_active` (inactive profiles are denied by every session guard), and the append-only `audit_logs` table with `recordAdminAudit` (`0013`); ADM-01 user and role management at `/admin/users` (list/search/filter, staff invites, role changes, activate/deactivate with Supabase sign-in ban, profile edits, password reset emails, per-user activity). Role changes go only through `0014` functions; a trigger rejects any other `profiles.role` update. Invite and reset emails land on `/auth/confirm` → `/account/password` (Supabase email templates are edited manually, see `db/README.md`). ADM-02 departments at `/admin/departments` (list with doctor and 30-day appointment counts, `/admin/departments/[id]` detail, audited save and activate/deactivate through `0015` functions; deactivation is refused while the department has future requested/confirmed appointments). ADM-03 specialties at `/admin/specialties` (list with doctor counts, `/admin/specialties/[id]` detail with its doctors, audited save and activate/deactivate through `0016` functions; deactivation only hides a specialty from patients). ADM-04 doctors at `/admin/doctors` (list filtered by department, specialty, and status; `/admin/doctors/new`; `/admin/doctors/[id]` with Profile, Schedule, and Appointments tabs; admin-only contact and bio; audited save, specialty replacement, account linking, and activate/deactivate through `0017` functions; deactivation is refused while the doctor has future requested/confirmed appointments). Doctors stay a 1:1 extension of profiles: linking gives a directory-only doctor the sign-in of an unlinked `doctor` account. ADM-05 weekly schedules: every period save (doctor or admin) goes through the audited `0018` function, which refuses an edit that would move an upcoming requested/confirmed/checked-in appointment outside the doctor's hours; the doctor's Schedule tab shows a Mon–Sun weekly overview plus the period editor, and `/admin/schedules` without a doctor lists every doctor's hours, filterable by department. Slots are still generated server-side in TypeScript (`generateAvailableSlots`), not by a SQL function, and slot lengths stay 15/30/45/60. ADM-06 schedule exceptions: every exception add/remove (doctor or admin) goes through the audited `0020` functions, which refuse an exception covering a requested/confirmed/checked-in appointment (nothing is moved); hospital-wide holidays are `schedule_exceptions` rows with `doctor_id` null and type `holiday`, managed by admins at `/admin/schedules/exceptions` and applied to every doctor by the TS availability code and the booking-path SQL functions (`cammi_connect_exception_blocks`). ADM-07 hospital services at `/admin/services` (list filtered by department and status, `/admin/services/new`, `/admin/services/[id]`; audited save and activate/deactivate through `0021` functions). Services are informational only (no scheduling or capacity), admin-only for now: patients and Cami do not see them until knowledge documents (ADM-13). The detail page lists the service's requirements and has a disabled "Publish to Cami AI" button. ADM-08 appointment requirements at `/admin/requirements` (grouped by service or specialty, filtered by kind and status; `/admin/requirements/new`, `/admin/requirements/[id]`): each requirement belongs to exactly one service or specialty, has Manila effective dates, and moves draft → published → archived through audited `0022` functions. Only drafts are edited; a published requirement is changed by Supersede (end-dated the day before the new version, cloned into a new draft; it can be superseded again if that draft is archived, `0024`). `0023` fixes create in the department, specialty, service, and requirement save functions. Admin-only for now, like services. ADM-09 read-only appointment monitoring at `/admin/appointments` (server-paginated, URL filters for patient name, doctor, department, multi-status, source, and Manila scheduled-date range; patient name and ID only in the list) and `/admin/appointments/[id]` (contact details, who created and confirmed it, and the `appointment_audit_logs` timeline with from → to). There are no admin status actions (D3) and no migration. Deviations from the slice: no audit trigger, because every writer inserts its own audit row and `tests/unit/appointments/audit-coverage.test.ts` guards that; `cancelled_at`/`completed_at`/`no_show_at` are deferred to ADM-10; and there is no Conflicts view, because `appointments_no_active_overlap` and ADM-06's refusal rule leave it permanently empty. ADM-10 analytics metric layer: pure TS metrics in `src/lib/analytics/` (KPIs, monthly volume, by doctor, weekday × daytime-slot heatmap, outcomes by month, rates by weekday; rates over the outcome cohort of finished visits; data-written takeaways in `takeaways.ts`) over rows read by `src/server/analytics/` (`loadAnalytics`); definitions v2 (owner-approved 2026-11-08) in `docs/analytics-definitions.md`; no SQL functions and no migration, because SQL math can't be unit-tested without a local DB. ADM-11 analytics page at `/admin/analytics` (URL filters, 4 KPIs, 6 charts with data tables, audited CSV export at `/api/admin/analytics/export`); Recharts and motion (React Bits CountUp) are approved for it, and Recharts is imported only by `src/components/analytics/analytics-charts.tsx`. ADM-12 admin dashboard at `/admin` (URL filters Today / This week / This month / Custom plus doctor and department, no status filter; 6 cards labelled with their D4 date basis that link into `/admin/appointments`; trend vs the previous equal-length period; daily activity and status charts; top-5 doctors; read-only front desk queue; recent `appointment_audit_logs` and `audit_logs` feeds). `loadDashboard` reuses the ADM-10 metric layer; no migration. ADM-13 knowledge documents at `/admin/knowledge-base` (list filtered by category and status with a failed-processing panel, `/admin/knowledge-base/new`, `/admin/knowledge-base/[id]`): `0025` extends the existing `knowledge_documents` table (category, content, draft/published/archived status, processing status) instead of adding one, drops `is_published`, and retrieval searches only published documents. Audited save and publish/archive/restore go through `0025` functions with old/new `content_hash` and version; editing a published document's content bumps its version and marks it pending while its old chunks stay searchable. Content is typed or uploaded (`.txt`/`.md`/`.pdf` up to 5 MB; PDF text via the approved `unpdf` dependency; Server Action body limit 6 MB). `npm run kb:ingest` also stores the corpus files' content and category. The service "Publish to Cami AI" button stays disabled (D7). ADM-14 ingestion: publish, editing a published document's content, and Reprocess (audited, `0026`) chunk and embed the document inline in the Server Action (`src/server/knowledge/ingest.ts`, ADR-0004 interim decision); `cammi_connect_store_knowledge_chunks` swaps the chunks atomically and only while the document is still published at the embedded version, so the old chunks stay searchable until then and after a failure; archiving deletes a document's chunks. Failures store a fixed message, never provider text. `/admin/knowledge-base` shows a per-category coverage table (published, ready, failed, last updated; categories with nothing published are flagged). There is still one vector table (`knowledge_chunks`). ADM-15 system settings at `/admin/settings` (Appointment, Hospital, and Chatbot tabs; a review-changes dialog before each save): `system_settings` holds only the allow-listed keys in `src/lib/settings/schema.ts` (no model, prompt, or key settings), a missing key uses its TS default, and every save goes through the audited `0027` function (`settings.update` with per-key previous/new values). Settings are read per request (`getSettings`, no cache). Wired: `chatbot.enabled` (the `/chat` page shows a maintenance message and `POST /api/v1/chat` refuses with 503 `chat_disabled`), `chatbot.welcome_message`, `chatbot.enabled_categories` (the `0027` match function's `categories` filter), `appointment.max_advance_days` (Cami's booking horizon), `appointment.min_lead_hours` (Cami's slots only; front desk and the SQL booking functions are unchanged), and `appointment.default_slot_minutes` (new-period default in the schedule editor, still 15/30/45/60). Stored with no effect yet: request expiry (D8, off), hospital name/address/email/hours, and the policy texts, which "Send to knowledge base" turns into a draft `appointment_procedures` document. ADM-16 audit log at `/admin/audit-log`: read-only, URL filters (actor, action prefix, target type, Manila dates), `/admin/audit-log/[id]` with a previous/new diff, and an audited (`audit.export`) CSV export at `/api/admin/audit-log/export`, capped at 10,000 rows; no migration. Security checks are static tests in `tests/unit/security/` (every admin route calls `getAdminSession`, every exported Server Action calls a session guard, SQL audit payloads name no credential keys, analytics carry no patient fields) plus `npm run check:bundle` after a build. `docs/acceptance-traceability.md` maps each slice's tests; the RLS matrix, escalation tests, and Playwright E2E remain gaps.
- UI redesign (branch `feat/ui-redesign`, from `ref/cammi-ui-reference/`): shadcn-style kit in `src/components/ui/` (`badge`, `card`, `field` with the shared `CONTROL_CLASS`, `navigation`, `data`; `cn()` in `src/lib/cn.ts` with the approved `tailwind-merge`; icons from the approved `lucide-react`), `StaffShell` grouped 240px sidebar for admin and front desk (`src/components/shell/staff-shell.tsx`), redesigned landing page with landing-only motion (`src/components/landing/landing-motion.tsx`), split sign-in card with an inline error Alert, and a dev-only `/dev/kit` gallery. Front desk follows the reference screens: reference overview cards and merged activity feed (`SPEC-frontdesk.md` §4 amended 2026-11-08), request Board/List views (`?view=`), Next request on details, schedule day navigation and Print list, and fieldset-based booking. Presentation only; no server, action, or migration changes.
- AI-assisted conversational booking (AI-APT-001): patients land on `/chat`, where the assistant "Cami" (persona in `src/lib/chat/persona.ts`) lets them ask hospital questions (RAG over `db/knowledge/`), book by specialty or by doctor, and view and cancel their own appointments. There is no form-based booking page.
- Database schema is hand-written SQL in `db/migrations/` (`0001`–`0030`; run `0006` on its own before `0007`, `0008` on its own, `0019` on its own before `0020`, and `0028` on its own before `0029`); apply manually in the hosted Supabase SQL editor (see `db/README.md`). Synthetic seed: `npm run db:seed`; knowledge corpus: `npm run kb:ingest`. Admin reference reads (departments, specialties, doctors, services, requirements, schedules, knowledge documents) are cached under the `reference` tag (`src/server/cache/reference-tag.ts`), and every action that writes them calls `updateTag`; appointment, notification, chat, and analytics reads are never cached (`tests/unit/security/reference-cache.test.ts`).
- `SPEC.md` is the target design and requirements; `TEST.md` is the test plan. Not everything in them is implemented. Verify paths and scripts before relying on them.
- `README.md` is the untouched create-next-app readme. Trust `package.json` and config files over prose.
- `design.md` is the visual source of truth (Calm Care tokens; white page/auth backgrounds approved 2026-10-25).

## Commands

```bash
npm run dev          # http://localhost:3000
npm run lint         # ESLint flat config (eslint-config-next)
npm test             # Vitest unit + component tests
npm run typecheck    # tsc --noEmit
npm run db:seed      # synthetic seed (needs .env.local; see db/README.md)
npm run build
npm run check:bundle # after a build: no server secret names/values in .next/static
```

- Use npm; `package-lock.json` is the lockfile.
- Before reporting done: run `npm test`, `npm run lint`, and `npm run typecheck`; run `npm run build` after route or config changes.

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

<!-- BEGIN:nextjs-agent-rules -->

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