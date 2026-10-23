# CC-007 — External Provider Contracts

- Status: Proposed
- Phase: PHASE-00
- Type: Verification decision
- Approval required: yes
- ADR: [`ADR-0006`](../decisions/ADR-0006-external-provider-contracts.md)
- Depends on: none
- Blocks: CC-306, CC-401, PHASE-03, PHASE-04

## Objective

Verify and record the current Gemini embedding and OpenCode Zen generation contracts
before adapter implementation. No provider code is written in this ticket.

## Requirement and specification references

- `SPEC.md` §4.1, §4.4, §4.7, §15 item 7
- `TEST.md` `SM-01`, `SM-02`, `U-RAG-09`, `U-RAG-10`, `U-RAG-11`, `U-PRV-01..08`
- No requirement is implemented here.

## Verification required

### Gemini embeddings

- SDK and version.
- Embedding model identifier.
- Output dimensionality and truncation behavior.
- Document and query task types.
- Batch limits, quotas, retry behavior, and cost.
- Response validation requirements.

### OpenCode Zen

- Model identifier and availability.
- Base URL, endpoint, authentication scheme.
- Request and response format.
- Timeout, retry, rate-limit, and error behavior.
- Whether the chosen plan permits application API usage.
- Cost and quota implications.

## Acceptance criteria

- `ADR-0006` records verified facts with source links and checked date.
- The configured model, endpoint, and dimensionality are explicit.
- The adapter interface remains the approved `TextGenerationProvider` contract.
- No assumptions from training data are treated as verified.
- Smoke-test strategy exists for `SM-01` and `SM-02`.
- No provider key is committed or exposed.

## Evidence

- Approved `ADR-0006`.
- Provider documentation or verified API response captured without secrets.
- Human approval record.

## Out of scope

- Implementing adapters.
- Making real provider calls with production keys.
- Changing models or dimensionality silently.
