# ADR-0001 — Auth Provider and Identity Architecture

- Status: Proposed
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

No option is selected.

## Decision

TBD. Do not implement authentication until this ADR is approved.

## Consequences

- `CC-201` through `CC-203` cannot start.
- `users`, `roles`, and profile ownership cannot be finalized.
- CSRF and session test strategy cannot be written.
- Phase 2 remains blocked.

## Approval

- [ ] Provider selected.
- [ ] Session model selected.
- [ ] Identity ownership recorded.
- [ ] CSRF approach recorded.
- [ ] Test strategy approved.
- [ ] Human owner approval recorded.
