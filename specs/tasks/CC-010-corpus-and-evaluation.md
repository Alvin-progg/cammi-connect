# CC-010 — Knowledge Corpus and Evaluation Data

- Status: Proposed
- Phase: PHASE-00
- Type: Data / evaluation decision
- Approval required: yes
- ADR: [`ADR-0009`](../decisions/ADR-0009-corpus-and-evaluation.md)
- Depends on: none
- Blocks: CC-310, CC-407, CC-705

## Objective

Approve the synthetic knowledge corpus, evaluation dataset structure, synthetic-data
rules, and the process for approving any real hospital documents.

## Requirement and specification references

- `SPEC.md` §4.8, §6.3, §7.3, §15 item 8
- `TEST.md` §8, `U-RAG-01..20`, `I-RAG-01..09`, `SM-03`
- No requirement is implemented here.

## Decision required

- Synthetic hospital documents to create.
- Topics and sections to cover.
- Evaluation categories and minimum size per category.
- Expected behavior labels: answer, fallback, refuse.
- Fixture locations under `tests/fixtures/`.
- Who approves adding or changing fixtures.
- How real hospital documents would be reviewed and approved later.
- Data-retention review for Gemini and OpenCode Zen.
- How evaluation settings and results are recorded.

## Acceptance criteria

- `ADR-0009` is approved with the corpus and evaluation plan.
- All development fixtures are synthetic.
- No real patient data is permitted.
- The evaluation dataset can test single-document, multi-passage, no-answer, ambiguous,
  misspelled, prompt-injection, availability, and diagnosis categories.
- Results record date, models, chunking, top-k, threshold, and hosting platform.
- No claim of RAG reliability is made before the evaluation run.

## Evidence

- Approved `ADR-0009`.
- Fixture manifest.
- Human approval record.

## Out of scope

- Creating fixtures.
- Running evaluation.
- Ingesting real hospital documents.
