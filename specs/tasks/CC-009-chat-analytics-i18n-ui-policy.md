# CC-009 — Chat Access, Analytics, i18n, and UI Policy

- Status: Proposed
- Phase: PHASE-00
- Type: Product / security policy decision
- Approval required: yes
- ADR: [`ADR-0008`](../decisions/ADR-0008-chat-analytics-i18n-ui-policy.md)
- Depends on: CC-002
- Blocks: CC-402, CC-405, CC-601, CC-602, CC-704

## Objective

Approve the remaining product policies that affect chat, analytics, localization, and
the existing stock UI. No feature code is written in this ticket.

## Requirement and specification references

- `FR-001`, `FR-007`, `UI-001`, `UI-006`
- `SPEC.md` §4.5, §4.8, §8, §15 items 10, 11, 13
- `TEST.md` `A-CHAT-01..05`, `UC-CHAT-01..13`, `UC-ANL-01..07`, `E-CHAT-01..04`

## Decision required

### Chat access

- Anonymous visitors, patients only, or another approved policy.
- Whether authentication is required before generation.
- Rate-limit keying for anonymous and authenticated users.
- Whether chat is disabled when providers are unavailable.

### Analytics explanations

- Whether AI-generated explanations are required.
- If required, which provider and prompt policy.
- How measured facts and generated text are separated and labeled.
- How causal language is prohibited.

### i18n and UI

- English-only or English + Filipino.
- Timezone display rule; default Asia/Manila.
- Preserve, replace, or extend the stock create-next-app page.
- Any design-system or component constraints.

## Acceptance criteria

- `ADR-0008` is approved for every item above.
- Chat access policy is testable and consistent with authorization requirements.
- Analytics output labeling is explicit.
- Localization scope and timezone behavior are explicit.
- Existing UI decision is explicit.
- No implementation starts before approval.

## Evidence

- Approved `ADR-0008`.
- Human approval record.

## Out of scope

- Implementing chat, analytics, localization, or UI.
- Changing `SPEC.md` or `TEST.md`.
