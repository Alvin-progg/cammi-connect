# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

`AGENTS.md` (imported above) holds the project rules: approval gates, non-negotiables, TDD, code-quality standards, and the completion-report format. This file adds commands and architecture. Where they conflict, `AGENTS.md` wins, except that its "Test tooling bootstrap" section is out of date: Vitest is installed and wired up.

## Commands

```bash
npm test                                         # vitest run (all tests)
npm run test:watch                               # vitest watch mode
npx vitest run tests/unit/appointments/service.test.ts   # single file
npx vitest run -t "<test name pattern>"          # tests whose name matches
npm run lint && npm run typecheck                # required before reporting done
npm run build                                    # after route or config changes
npm run db:seed                                  # node --env-file=.env.local scripts/seed.mjs
```

- Vitest config: `vitest.config.mts`. Default environment is `jsdom`, setup is `tests/setup.ts`, and only `tests/**/*.test.{ts,tsx}` runs. Tests for server modules start with `// @vitest-environment node` and `vi.mock("server-only", () => ({}))`.
- Tests are split into `tests/unit/<domain>/` and `tests/component/<domain>/`, mirroring `src/`.

## Stack

Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript, Tailwind v4 (via the turbopack loader), Supabase (Auth plus Postgres through `@supabase/ssr` and `supabase-js`), Zod 4, and Sonner for toasts. There is no ORM and no local database. The hosted Supabase project is the only database (ADR-0003).

## Architecture

### Layering (`src/`)

- `src/lib/<domain>/`: pure, isomorphic domain logic with no I/O. This covers Zod schemas, types, status transitions (`appointments/transitions.ts`), availability/overlap validation (`schedules/availability.ts`), filters, stats, and formatting. Most unit tests target this layer.
- `src/server/<domain>/`: server-only code. Every file imports `"server-only"`. Each domain has three files:
  - `repository.ts`: Supabase queries via `getSupabaseAdminClient()`, mapping snake_case rows to domain types.
  - `service.ts`: business rules. It defines a repository interface type (e.g. `DoctorAppointmentsReader`) and receives the repository as an argument, so tests pass in a `vi.fn()` fake instead of mocking Supabase.
  - `actions.ts`: `"use server"` Server Actions. Each one resolves the session, validates input with a `src/lib` schema, calls the service with the concrete repository, `revalidatePath`s, and returns a discriminated `{ status: "idle" | "error" | "success" }` state for `useActionState`.
- `src/components/<domain>/`: UI. Client components call Server Actions; they never touch Supabase directly.
- `src/app/`: routes. `/doctor/page.tsx` is a single server page. Its sub-views (board, list, schedule, notifications, stats, profile) are selected by search params parsed in `src/lib/appointments/dashboard.ts`, not by nested routes.

### Auth and authorization

- `src/proxy.ts` is the Next 16 replacement for middleware. It refreshes Supabase session cookies and optimistically redirects anonymous users on `/account` and `/doctor` to `/login?next=...`, setting `Cache-Control: private, no-store`. It is **not** the enforcement point.
- Enforcement lives in `src/server/auth/dal.ts`: `requireUser()` and `getDoctorSession()`. Pages and every Server Action call these. The doctor ID passed into services always comes from the session profile and never from the URL or form input, and every repository query is scoped by it.
- Two Supabase clients:
  - `src/server/auth/client.ts`: per-request cookie-bound client using the publishable key, for **Auth only**.
  - `src/server/db/admin-client.ts`: cached service-role client for **all table reads and writes**. It bypasses RLS, and the migrations revoke `anon`/`authenticated` table access, so application-layer checks are the only authorization.
- Roles (`patient`, `doctor`) live in `profiles.role`. A DB trigger creates a patient profile for every new auth user. Doctors are promoted only by the seed script, not through registration.
- Env is validated lazily with Zod: `src/lib/config.public.ts` handles `NEXT_PUBLIC_*` and `src/server/config.ts` handles the service-role key.

### Database

- Migrations are hand-written SQL in `db/migrations/NNNN_*.sql`, applied manually in the Supabase SQL editor. Never edit an applied migration; add a new numbered one. `db/README.md` covers the setup, env vars, seed, and the manual smoke test.
- `src/server/db/database.types.ts` holds the Supabase table types and must be kept in sync with the migrations by hand.
- The DB backs up the service-layer rules: the `appointments_no_active_overlap` exclusion constraint rejects overlapping requested/confirmed appointments per doctor, and status changes are guarded updates (`applyTransition` only applies when the current status is in `from`).
- All dates and times are handled in `Asia/Manila` (see `manilaDayRange`, `todayInManila`, and `formatManilaDate` in `src/lib/appointments/`).

## Specs and planning docs

- `SPEC.md` holds the target requirements (FR-/UI- IDs) and `TEST.md` the test plan. Much of it (chatbot/RAG, ingestion, admin, patient booking) is not built yet.
- `specs/decisions/ADR-*.md` holds architecture decisions, `specs/tasks/CC-*.md` the task tickets, and `specs/plan/` the implementation plan. Check the relevant ADR before making a design choice in its area.
- `design.md` is the visual source of truth (the "Calm Care" tokens defined in `src/app/globals.css`).
