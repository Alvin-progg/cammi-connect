# ADR-0006 — External Provider Contracts

- Status: Proposed (pending provider smoke test)
- Date: 2026-10-23
- Amended: 2026-10-30 (AI-APT-001)
- Decision owner: Human project owner
- Related ticket: `CC-007`
- Related requirements: `FR-001`, `FR-002`
- Related specification: `SPEC.md` §4.1, §4.4, §4.7, §15 item 7

## Context

Provider identifiers, endpoints, authentication, request formats, dimensions, and limits
must be verified before adapter code is written. Training-data assumptions are not
acceptable evidence.

## Decision drivers

- Verified Gemini embedding configuration.
- Verified OpenCode Zen generation configuration.
- Timeout and retry budgets within hosting limits.
- Server-only credentials.
- Controlled provider errors.
- Reproducible smoke tests.
- Cost and quota awareness.

## Verification record

Docs checked 2026-10-30. Gemini sources: <https://ai.google.dev/gemini-api/docs/embeddings>
and <https://ai.google.dev/api/embeddings>. Zen source: <https://opencode.ai/docs/zen>.
Values marked *smoke* are confirmed only by `npm run smoke:providers` (see Smoke results).

### Gemini embeddings

| Item | Verified value | Source | Checked |
|---|---|---|---|
| SDK/version | None. REST `v1beta` with plain `fetch` | API reference | 2026-10-30 |
| Endpoint | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent` and `:batchEmbedContents` | API reference | 2026-10-30 |
| Auth | `x-goog-api-key` header (never a URL query parameter) | API reference examples | 2026-10-30 |
| Model ID | `gemini-embedding-001` (env `GEMINI_EMBEDDING_MODEL`) | Embeddings guide | 2026-10-30 |
| Output dimensionality | 768 (env `EMBEDDING_DIMENSIONS`); 768, 1536, and 3072 are recommended. Non-3072 vectors are **not normalized** by `gemini-embedding-001` and must be L2-normalized by the client | Embeddings guide | 2026-10-30 |
| Request fields | `content.parts[].text`, top-level `taskType` and `outputDimensionality` (as in the guide's `gemini-embedding-001` REST example). The reference marks these top-level fields deprecated in favour of `embedContentConfig`; switch if the smoke test rejects them | Guide and API reference | 2026-10-30 |
| Batch request | `{ requests: [{ model: "models/{model}", content, taskType, outputDimensionality }] }`; responses keep request order | API reference | 2026-10-30 |
| Response | `embedding.values` (single) or `embeddings[].values` (batch) | API reference | 2026-10-30 |
| Document task type | `RETRIEVAL_DOCUMENT` | API reference (TaskType) | 2026-10-30 |
| Query task type | `RETRIEVAL_QUERY` | API reference (TaskType) | 2026-10-30 |
| Batch/rate limits | Not stated on the pages read; recheck before S2 ingestion of large batches | — | 2026-10-30 |

### OpenCode Zen

| Item | Verified value | Source | Checked |
|---|---|---|---|
| Model ID | From env `OPENCODE_ZEN_MODEL`, chosen by the owner; must be a paid (non-free) model, because free-tier chat models require the OpenCode client | Zen docs | 2026-10-30 |
| Base URL | `https://opencode.ai/inference/openai/v1` (env `OPENCODE_ZEN_BASE_URL`) | Zen docs | 2026-10-30 |
| Endpoint | `POST {base}/chat/completions` (OpenAI-compatible). The docs say every text model also works through the other APIs, which Zen translates | Zen docs | 2026-10-30 |
| Auth scheme | `Authorization: Bearer <key>` (the docs show it only for one endpoint; *smoke*) | Zen docs | 2026-10-30 |
| Request format | `{ model, messages: [{ role, content }], response_format? }` | OpenAI-compatible; *smoke* | 2026-10-30 |
| Response format | `choices[0].message.content` (string) | OpenAI-compatible; *smoke* | 2026-10-30 |
| JSON mode | `response_format: { type: "json_object" }` is not documented; *smoke* | — | 2026-10-30 |
| Timeout/retry limits | `LLM_TIMEOUT_SECONDS` (default 20) per attempt, `LLM_MAX_RETRIES` (default 2) | This ADR | 2026-10-30 |
| Plan/quota constraints | Pay-as-you-go credits with workspace budgets; no request-rate limits stated. OpenAI- and Anthropic-hosted models retain requests for 30 days; most others are zero-retention | Zen docs | 2026-10-30 |

## Decision (2026-10-30, AI-APT-001)

1. **Plain `fetch`, no SDKs.** Both providers are called through small adapters in
   `src/server/ai/` with Zod-validated responses. This is a recorded deviation from
   SPEC §2.2 (Google Gen AI SDK, OpenAI-compatible client) and avoids new dependencies.
2. **Shared transport.** `fetchJson` (`src/server/ai/http.ts`) applies an
   `AbortSignal.timeout` per attempt and retries only 429, 5xx, timeouts, and network
   errors, with exponential backoff (500 ms, 1 s, ...) bounded by `LLM_MAX_RETRIES`.
   Other 4xx responses and caller aborts are not retried. Failures throw a
   `ProviderError` whose message holds only the provider, kind, and HTTP status — never
   the key, URL, or raw body.
3. **Embeddings.** `embedTexts(texts, taskType)` uses `embedContent` for one text and
   `batchEmbedContents` for several, checks the vector count and dimension, and
   L2-normalizes every vector before it is stored or compared.
4. **Generation.** `generate({ systemPrompt, messages, json?, signal })` posts an
   OpenAI-compatible chat completion. It takes a `messages` array instead of SPEC
   §4.7's single `userPrompt` so multi-turn history can be sent (recorded deviation).
   `json: true` adds `response_format: json_object`; callers always validate the reply
   with Zod. If the smoke test shows JSON mode is unsupported, extraction uses
   prompt-instructed JSON validated with Zod instead.
5. **Retry budget.** With the defaults a call can take up to about 3 × 20 s plus 1.5 s
   of backoff. ADR-0002 has not recorded the function time limit yet; lower
   `LLM_TIMEOUT_SECONDS` / `LLM_MAX_RETRIES` to fit it once it is known.
6. **Status.** Pending the provider smoke test. This ADR becomes Accepted once the
   smoke results below are recorded and approved.

## Smoke results

Pending: run `npm run smoke:providers` with the keys and model in `.env.local`.

| Check | Result | Date |
|---|---|---|
| Gemini 768-dimension vector | TBD | TBD |
| Zen chat completion | TBD | TBD |
| Zen `response_format: json_object` | TBD | TBD |

## Consequences

- Adapters and their unit tests exist; S2 can size `vector(768)` columns.
- Provider smoke tests need real keys and are run manually, not in CI.
- Changing the embedding model or dimensionality requires re-embedding all chunks.

## Approval

- [ ] Gemini contract verified (docs checked 2026-10-30; smoke pending).
- [ ] OpenCode Zen contract verified (docs checked 2026-10-30; smoke pending).
- [x] Sources and checked dates recorded.
- [x] No secrets captured in the record.
- [ ] Human owner approval recorded.
