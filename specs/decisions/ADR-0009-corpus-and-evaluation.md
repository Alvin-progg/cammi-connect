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

## Decision (2026-10-30, AI-APT-001 — corpus only)

Approved by the human owner through `PLN-002`:

- **Corpus:** a small synthetic, clearly labelled Markdown corpus in
  `db/knowledge/*.md` (created in AI-APT-001 S2) covering hospital services, a
  departments overview, appointment requirements, required documents, and visit
  guidelines.
- **Excluded facts:** the corpus contains no doctor names, specialties per doctor, or
  schedules. Those are answered from the database only, so RAG can never contradict
  availability.
- **Format and chunking:** Markdown with headings; heading-aware chunks of about 500
  tokens with about 75 overlap; each chunk keeps its document title and section title.
- **Real documents:** still not approved. Any real hospital document needs a new
  decision here and a provider data-retention review (SPEC §7.3).
- **Evaluation set:** deferred. No evaluation fixtures are created, and no retrieval
  quality is claimed. S2 uses only targeted smoke checks (one cited answer, one
  fallback).

## Consequences

- `CC-310`, `CC-407`, and `CC-705` are blocked.
- Retrieval quality cannot be measured or claimed.
- Synthetic-only rule remains in force.

## Approval

- [x] Corpus manifest approved 2026-10-30 via `PLN-002` (synthetic topics above).
- [ ] Evaluation categories and size approved.
- [ ] Fixture locations approved.
- [ ] Real-document approval process approved.
- [ ] Human owner approval recorded.
