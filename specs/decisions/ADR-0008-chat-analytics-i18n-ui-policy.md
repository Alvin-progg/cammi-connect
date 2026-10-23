# ADR-0008 — Chat Access, Analytics, i18n, and UI Policy

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-009`
- Related requirements: `FR-001`, `FR-007`, `UI-001`, `UI-006`
- Related specification: `SPEC.md` §4.5, §4.8, §8, §15 items 10, 11, 13

## Context

Several product policies affect authentication, rate limiting, UI copy, analytics
labeling, and localization. They must be decided before their tickets are written.

## Decision required

### Chat access

- Anonymous visitors, patients only, or another policy.
- Authentication requirement before generation.
- Rate-limit keying for anonymous and authenticated users.
- Chat behavior when providers or database are unavailable.

### Analytics explanations

- Whether AI-generated explanations are required.
- If required, provider, prompt, and labeling policy.
- Separation of measured facts from generated text.
- Prohibition of causal claims.

### i18n and UI

- English-only or English + Filipino.
- Display timezone, default Asia/Manila.
- Preserve, replace, or extend the stock create-next-app page.
- Design-system constraints.

No policy is selected.

## Decision

TBD. Do not implement chat policy, analytics explanations, localization, or UI shell
until approved.

## Consequences

- `CC-402`, `CC-405`, `CC-601`, `CC-602`, and `CC-704` are blocked or conditional.
- Accessibility copy and error messages cannot be finalized.
- Analytics scope may change.

## Approval

- [ ] Chat access policy approved.
- [ ] Analytics explanation policy approved.
- [ ] Localization and timezone approved.
- [ ] Existing UI decision approved.
- [ ] Human owner approval recorded.
