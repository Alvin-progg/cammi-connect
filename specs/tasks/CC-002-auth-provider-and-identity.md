# CC-002 — Auth Provider and Identity Architecture

- Status: Proposed
- Phase: PHASE-00
- Type: Architecture decision
- Approval required: yes
- ADR: [`ADR-0001`](../decisions/ADR-0001-auth-provider-and-identity.md)
- Depends on: CC-001
- Blocks: CC-201, CC-202, CC-203, CC-601

## Objective

Approve the authentication provider, session model, identity ownership, role model, and
CSRF approach. No auth code is written in this ticket.

## Requirement and test references

- `FR-003`; `UI-002`; `SPEC.md` §7.1, §15 item 3
- `TEST.md` `A-AUTH-01`, `A-AUTH-02`, `A-AUTH-03`, `A-AUTH-04`, `A-AUTH-05`, `U-APT-07`

## Decision required

- Provider and hosting compatibility.
- Session mechanism: cookie or token; server-side validation method.
- Ownership of `users`, `roles`, `patient_profiles`, `doctor_profiles`.
- Link between auth subject and application profile.
- Role model: patient, doctor, admin; scope rules.
- CSRF protection if cookie sessions are used.
- Required server environment variables.
- How auth will be mocked in tests.

## Options to evaluate

- Supabase Auth.
- Auth.js with the chosen database/provider.
- Custom session implementation.
- Any other reviewed option.

No option is selected by this ticket.

## Acceptance criteria

- `ADR-0001` is approved with the selected provider and session model.
- Identity table ownership and auth-subject linkage are explicit.
- CSRF decision is explicit.
- Test strategy for valid, expired, tampered, wrong-audience, and missing sessions exists.
- Authorization remains server-enforced, not middleware-only.
- No secrets are placed in `NEXT_PUBLIC_*` or client code.
- No implementation is started before approval.

## Evidence

- Approved `ADR-0001`.
- Linked provider documentation and version/date checked.
- Human approval record.

## Out of scope

- Installing the auth provider.
- Creating identity tables or routes.
- Building sign-in UI.
