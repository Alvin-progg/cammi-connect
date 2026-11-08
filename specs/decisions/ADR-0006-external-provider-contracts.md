# ADR-0006 — External Provider Contracts

- Status: Proposed (pending provider smoke test)
- Date: 2026-10-23
- Amended: 2026-10-30 (AI-APT-001); 2026-11-08 (generation moved to Groq)
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
- Verified Groq generation configuration.
- Timeout and retry budgets within hosting limits.
- Server-only credentials.
- Controlled provider errors.
- Reproducible smoke tests.
- Cost and quota awareness.

## Verification record

Docs checked 2026-10-30. Gemini sources: <https://ai.google.dev/gemini-api/docs/embeddings>
and <https://ai.google.dev/api/embeddings>. Groq sources are listed in the Groq section.
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

### Groq

Docs checked 2026-11-08: <https://console.groq.com/docs/openai>,
<https://console.groq.com/docs/structured-outputs>, <https://console.groq.com/docs/your-data>,
<https://console.groq.com/docs/rate-limits>. This replaces the OpenCode Zen/Go contract
(Decision 8).

| Item | Verified value | Source | Checked |
|---|---|---|---|
| Model ID | From env `GROQ_MODEL`, chosen by the owner; no default | This ADR | 2026-11-08 |
| Base URL | `https://api.groq.com/openai/v1` (env `GROQ_BASE_URL`, defaulted) | OpenAI compatibility | 2026-11-08 |
| Endpoint | `POST {base}/chat/completions` (OpenAI-compatible) | OpenAI compatibility; structured outputs | 2026-11-08 |
| Auth scheme | `Authorization: Bearer <key>`; no extra headers | Structured outputs examples | 2026-11-08 |
| Request format | `{ model, messages: [{ role, content }], response_format? }`. Unsupported: `logprobs`, `logit_bias`, `top_logprobs`, `messages[].name` (HTTP 400); `n` must be 1 | OpenAI compatibility | 2026-11-08 |
| Response format | `choices[0].message.content` (string) | OpenAI-compatible | 2026-11-08 |
| JSON mode | `response_format: { type: "json_object" }` on all models. The prompt must ask for JSON (the extraction prompt does); no schema enforcement, so callers still validate with Zod | Structured outputs | 2026-11-08 |
| Timeout/retry limits | `LLM_TIMEOUT_SECONDS` (default 20) per attempt, `LLM_MAX_RETRIES` (default 2) | This ADR | 2026-11-08 |
| Plan/quota constraints | Org-level RPM/RPD/TPM/TPD limits per model; e.g. Developer plan `openai/gpt-oss-120b` 30 RPM, 1K RPD, 8K TPM, 200K TPD. Over the limit: HTTP 429 with `retry-after`. Free-plan limits not confirmed; check the console Limits page | Rate limits | 2026-11-08 |
| Data retention | No retention of inference data by default; inputs/outputs may be kept up to 30 days for reliability troubleshooting or abuse investigation. Zero Data Retention can be turned on in Data Controls (chat completions are ZDR-eligible). Data stored in US GCP. The page does not address training use | Your data | 2026-11-08 |

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
6. **Status.** Smoke test passed 2026-10-30 (see below); awaiting owner approval. This ADR becomes Accepted once the
   smoke results below are recorded and approved.
7. **Superseded by Decision 8.** **OpenCode Go, not pay-as-you-go Zen (owner decision, 2026-10-30).** Generation uses
   the Go subscription endpoint `https://opencode.ai/inference/go/openai/v1` with
   `glm-5.3-flash`. Every request sends `user-agent: cammi-connect/0.1` and an
   `x-opencode-session` header taken from `GenerateInput.sessionId`, which must be a
   random per-conversation ID, never a patient or user identifier. Accepted risk: Go is
   documented as intended for coding agents and its traffic is monitored for abuse, so
   OpenCode could restrict this use. Switching to pay-as-you-go Zen only needs a new
   `OPENCODE_ZEN_BASE_URL` and Console credit; the headers are harmless there. Go usage
   counts against the plan's monthly limit ($60 for GLM-5.3-Flash).
8. **Groq replaces OpenCode (owner decision, 2026-11-08).** Generation uses Groq's
   OpenAI-compatible endpoint through `src/server/ai/groq.ts`, configured by
   `GROQ_API_KEY`, `GROQ_MODEL`, and optional `GROQ_BASE_URL`. There is no provider
   switch or fallback. The `x-opencode-session` header, the custom user agent, and
   `GenerateInput.sessionId` are removed, so no conversation ID leaves the app. The
   owner should turn on Zero Data Retention in Groq Data Controls before processing
   real hospital information (SPEC §7).

## Smoke results

Gemini and the former OpenCode checks are complete; the Groq check is pending. Earlier failures are kept for the record.

| Check | Result | Date |
|---|---|---|
| Gemini 768-dimension vector | Pass (`gemini-embedding-001`, top-level `taskType` / `outputDimensionality` accepted) | 2026-10-30 |
| Zen chat completion | Pass on Go with `glm-5.3-flash`, `x-opencode-session`, and a custom user agent. Earlier: `glm-5.3-flash-free` HTTP 429 (free tier is OpenCode-client only); pay-as-you-go `glm-5.3-flash` HTTP 402 (no credit); Go without the session header HTTP 400 `MissingSessionID` | 2026-10-30 |
| Zen `response_format: json_object` | Pass: accepted on Go, reply parsed as JSON | 2026-10-30 |
| Groq chat completion and JSON mode | Pending: run `npm run smoke:providers` with `GROQ_API_KEY` and `GROQ_MODEL` set | — |

## Consequences

- Adapters and their unit tests exist; S2 can size `vector(768)` columns.
- Provider smoke tests need real keys and are run manually, not in CI.
- Changing the embedding model or dimensionality requires re-embedding all chunks.

## Approval

- [x] Gemini contract verified (docs and smoke test 2026-10-30).
- [x] OpenCode contract verified on Go (docs and smoke test 2026-10-30); superseded.
- [ ] Groq contract verified (docs checked 2026-11-08; smoke test pending).
- [x] Sources and checked dates recorded.
- [x] No secrets captured in the record.
- [ ] Human owner approval recorded.
