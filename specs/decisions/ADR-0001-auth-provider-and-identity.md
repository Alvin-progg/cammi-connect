# ADR-0001 — Auth Provider and Identity Architecture

- Status: Accepted
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-002`
- Related requirements: `FR-003`, `UI-002`
- Related specification: `SPEC.md` §7.1, §15 item 3

## Context

CamiConnect requires authenticated patients, doctors, and administrators. Authorization
must be enforced in handlers and the service/data layer, never by middleware or UI alone.
The auth provider determines session validation, CSRF handling, identity table ownership,
and test strategy.

## Decision drivers

- Server-side session validation.
- Role and ownership enforcement.
- Cookie-session CSRF behavior.
- Compatibility with Next.js 16 server components and Route Handlers.
- Supabase database integration.
- Testability with synthetic users.
- No secrets in client code or `NEXT_PUBLIC_*`.

## Options considered

### Supabase Auth

- Native fit with the selected database.
- Identity data may be provider-owned.
- Requires verification of session validation and RLS interactions.

### Auth.js

- Framework-oriented auth integration.
- Requires database adapter and session design.
- Requires verification of Next.js 16 compatibility.

### Custom session implementation

- Maximum control.
- Highest security and maintenance burden.
- Not preferred without a specific requirement.

## Decision

- **Provider:** Supabase Auth (email + password).
- **Sessions:** cookie-based via `@supabase/ssr`. `src/proxy.ts` refreshes and
  verifies tokens with `supabase.auth.getClaims()`; the DAL uses
  `supabase.auth.getUser()` for secure checks. Never trust `getSession()` for
  authorization.
- **Identity ownership:** Supabase owns `auth.users`, credentials, email
  verification, and sessions. The app database owns `profiles` and roles in a
  later phase, keyed by `auth.users.id`. No passwords stored in the app
  database. Role is never read from `user_metadata`.
- **Roles:** self-registration creates patient accounts only. Doctor/admin
  accounts are provisioned by admins. No role picker on registration.
  Role-aware navigation is deferred until roles exist in the app database.
- **CSRF:** auth mutations go through Server Actions (Next.js built-in
  Origin/Host check) with `SameSite=Lax` cookies. `/auth/callback` is a GET that
  sets a session but is protected by PKCE (single-use code + code verifier). No
  state-changing GETs otherwise. No separate CSRF token for auth forms.
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (public-safe by design). No service-role key in the auth slice.
- **Test strategy:** mock the Supabase client in unit/component tests; manual
  smoke test against the hosted dev project with synthetic users.

## Consequences

- Registration is patient-only; doctor/admin provisioning comes with app-DB
  roles in a later phase.
- Session cookies are not HttpOnly by design (the browser needs the refresh
  token). XSS risk is documented; a CSP is planned for a later phase.
- Authorization is enforced in the DAL and actions, never by middleware/proxy
  or UI visibility.

## Approval

- [x] Provider selected: Supabase Auth.
- [x] Session model selected: cookie-based via `@supabase/ssr`.
- [x] Identity ownership recorded: Supabase owns `auth.users`; app DB owns profiles.
- [x] CSRF approach recorded: Server Actions + PKCE callback.
- [x] Test strategy approved: mocked Supabase client + synthetic manual smoke.
- [x] Human owner approval recorded: approved 2026-10-23 via `PLN-001`.
