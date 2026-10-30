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

- English-only or English + Filipino (full i18n policy still open).
- Display timezone, default Asia/Manila.
- Preserve, replace, or extend the stock create-next-app page.
- Design-system constraints.

## Decisions recorded (partial)

The following UI policy for the auth slice was approved 2026-10-23 via
`PLN-001`; chat access and analytics explanation policies remain open:

- **Existing UI:** keep the stock landing page; add clean `/login` and
  `/register` pages.
- **Auth copy:** English-only for this slice. The full i18n decision
  (English-only vs English + Filipino) is not made here.
- **Design system:** for the initial auth slice, no new design system; utility
  styling only. The 2026-10-23 approval of `design.md` supersedes this for
  `/login` and `/register`; see the section below.

## Superseding auth-slice UI policy (2026-10-23)

The human owner approved `design.md` for the auth slice. For `/login` and
`/register`:

- The semantic token, visible-grid, and focus system replaces the one-off `zinc`
  utility styling. The original "no new design system" policy is superseded for
  this slice only.
- `sonner@^2.0.8` is the single toast implementation and is rendered once from
  the root layout.
- Credential failures keep the inline `role="alert"` summary as the
  authoritative message. A supplementary Sonner error toast may repeat the
  generic credential message.
- Successful sign-in redirects with a one-time `auth_notice=signed-in` query
  parameter. A client notice shows a success toast on the destination and
  removes the parameter. The redirect remains authoritative.
- The stock landing page remains unchanged.

## Chat access decision (2026-10-30, AI-APT-001)

Approved by the human owner through `PLN-002`:

- **Who:** signed-in patients only. Anonymous visitors, doctors, and admins have no chat
  access. `POST /api/v1/chat` returns 401 (no session) or 403 (not a patient).
- **Order:** request validation and authentication run before any provider call, so an
  unauthenticated request never reaches Gemini or OpenCode Zen.
- **Rate limit:** 10 user messages per minute per patient, counted from
  `chat_messages` in the database (no shared store yet; ADR-0005 stays open). Over the
  limit returns 429.
- **Provider or database unavailable:** a controlled 503 with a friendly message. The
  assistant never fabricates an answer, and the patient's draft is kept for retry.
- **Privacy notice:** the chat UI always shows that messages are stored, are sent to AI
  providers (Google Gemini and OpenCode Zen) to produce answers, are AI-generated, and
  are not medical advice or an appointment confirmation.
- **Data minimization:** the patient's identity (name, email, IDs) is never sent to the
  providers beyond what the patient types. Booking data stays server-side.
- **Logging:** request IDs and outcomes only; message text is never logged (SPEC §7.3).
- **Retention:** `chat_messages` are kept for **90 days**. Purging is a documented
  manual SQL step in `db/README.md`; there is no automated job (consistent with
  ADR-0004). Conversations with no remaining messages may be deleted in the same step.
- **Copy:** English-only, as in the auth slice. Display timezone is `Asia/Manila`.

## Decision

The chat access policy is approved above (2026-10-30). The analytics explanation
policy remains TBD. The auth-slice UI
policy above is approved and recorded.

## Consequences

- `CC-402`, `CC-405`, `CC-601`, `CC-602`, and `CC-704` remain blocked or
  conditional pending the full i18n, chat access, and analytics decisions.
- Auth slice copy is English-only for now.
- The auth slice uses the approved `design.md` token/grid system; other screens
  remain on utility styling until their own migrations.

## Approval

- [x] Chat access policy approved 2026-10-30 via `PLN-002` (AI-APT-001).
- [ ] Analytics explanation policy approved.
- [ ] Localization and timezone approved.
- [x] Existing UI decision approved (auth slice: keep stock landing).
- [x] Auth-slice visual migration and `sonner@^2.0.8` approved 2026-10-23 via `design.md`.
- [x] Human owner approval recorded: UI policy items approved 2026-10-23 via `PLN-001`.
