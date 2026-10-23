# ADR-0009 — Knowledge Corpus and Evaluation Data

- Status: Proposed
- Date: 2026-10-23
- Decision owner: Human project owner
- Related ticket: `CC-010`
- Related requirements: `FR-001`, `FR-002`
- Related specification: `SPEC.md` §4.8, §6.3, §7.3, §15 item 8

## Context

The RAG system needs deterministic synthetic documents and an evaluation dataset.
Real hospital documents are not approved for development. Evaluation claims require
a fixed dataset and recorded settings.

## Decision drivers

- Synthetic data only.
- Reproducible retrieval and answer tests.
- Coverage of answer, fallback, refusal, injection, availability, and diagnosis cases.
- Traceable metrics.
- No unsupported reliability claims.

## Decision required

- Synthetic document list and topics.
- Document formats and sizes.
- Chunking and metadata expectations.
- Evaluation categories and minimum items.
- Expected behavior labels.
- Fixture layout under `tests/fixtures/`.
- Approval process for fixture changes.
- Approval process for future real documents.
- Data-retention review for providers.
- Result-recording template.

No corpus or dataset is approved yet.

## Decision

TBD. Do not create evaluation fixtures until approved.

## Consequences

- `CC-310`, `CC-407`, and `CC-705` are blocked.
- Retrieval quality cannot be measured or claimed.
- Synthetic-only rule remains in force.

## Approval

- [ ] Corpus manifest approved.
- [ ] Evaluation categories and size approved.
- [ ] Fixture locations approved.
- [ ] Real-document approval process approved.
- [ ] Human owner approval recorded.
