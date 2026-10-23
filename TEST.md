# CamiConnect — Test Specification (Next.js Full-Stack)

**Companion document:** [`SPEC.md`](./SPEC.md) v2.0
**Approach:** Test-Driven Development (TDD) — write the failing test first, then the smallest implementation that passes.

> Every test traces to a requirement in `SPEC.md` (FR-xxx for server behavior, UI-xxx for interface). Tooling marked **[Proposed]** needs your approval before being added. Never skip or weaken a test just to make a build pass.

---

## 1. Principles

1. **Red → Green → Refactor.** No feature work begins without failing tests.
2. **Traceability.** Test names reference requirement IDs.
3. **Test the service layer directly** (`src/server/*`) for business rules, and test Route Handlers for HTTP concerns (auth, validation, status codes, error shape). Keep handlers thin so most logic is covered by fast unit tests.
4. **Real Postgres + pgvector** for integration tests (Docker). No SQLite substitute.
5. **External providers are mocked** in automated runs; real-provider calls live in an opt-in smoke suite.
6. **Authorization is tested on the server.** UI tests verify correct *handling* of `401`/`403`, not enforcement.
7. **Accessibility and security are test concerns from the start**, not late polish.
8. **Synthetic data only**, everywhere (fixtures, screenshots, traces).
9. **Deterministic tests:** mock time, network, and randomness; no dependence on test order.

---

## 2. Tooling **[Proposed]**

| Purpose | Tool |
|---|---|
| Unit / integration runner | Vitest |
| Route Handler tests | Invoke exported handlers with `Request` objects (or `next-test-api-route-handler`) |
| Database | Docker pgvector PostgreSQL via Testcontainers or `compose.yaml` |
| Provider mocking | Fake adapter classes; MSW for HTTP-level provider tests |
| Component tests | React Testing Library + `user-event` |
| End-to-end | Playwright |
| Accessibility | axe-core (`vitest-axe` / `@axe-core/playwright`) |
| Contract/schema | Shared Zod schemas + OpenAPI conformance check |
| Type checking / lint | `tsc --noEmit` (strict), ESLint (+ `jsx-a11y`), Prettier |
| Security | `npm audit`, bundle secret scan, `server-only` import checks |
| Performance | Lighthouse CI / Web Vitals |

### 2.1 Layout

    tests/
    ├── unit/            # src/server/* pure logic, utilities, API client
    ├── integration/     # Postgres + pgvector, migrations, transactions
    ├── api/             # Route Handler tests (auth, validation, status codes)
    ├── component/       # React components with MSW
    ├── contract/        # schema and OpenAPI conformance
    ├── e2e/             # Playwright flows
    ├── a11y/            # axe suites
    ├── smoke/           # opt-in, real providers, dev credentials only
    ├── fixtures/
    │   ├── documents/   # synthetic hospital PDFs and text
    │   ├── eval/        # evaluation dataset (§8)
    │   └── seed.ts      # synthetic users, doctors, schedules
    └── mocks/           # fake providers, MSW handlers

### 2.2 Commands (equivalents)

    docker compose up -d db          # local/test database
    npm run db:migrate
    npm run typecheck
    npm run lint
    npm run test                     # unit + integration + api + component + contract
    npm run test:e2e
    npm run test:a11y
    npm run test:smoke               # opt-in, real providers
    npm run build

---

## 3. Unit Tests (server)

No network; database only where noted.

### 3.1 Knowledge base and RAG (FR-001, FR-002, SPEC §4)

| ID | Test | Expected |
|---|---|---|
| U-RAG-01 | Extract text from a synthetic PDF (serverless-compatible library) | Readable text; page numbers preserved when available |
| U-RAG-02 | Extract from plain text | Content preserved apart from normalization |
| U-RAG-03 | Unsupported type / oversized file | Rejected with a validation error |
| U-RAG-04 | Whitespace normalization, unusable content removal | Clean text; no empty chunks |
| U-RAG-05 | Chunking size and overlap | ≈ target size; overlap present; configurable |
| U-RAG-06 | Heading preservation | Each chunk carries document title and section heading |
| U-RAG-07 | Tables / policy statements | Not split unnecessarily |
| U-RAG-08 | Content hash | Stable for same input; differs for changed input |
| U-RAG-09 | Embedding response validation | Wrong dimension, missing vectors, or count mismatch → controlled error |
| U-RAG-10 | Embedding config | Model, dimensionality, task types read from config |
| U-RAG-11 | Task types | Documents `RETRIEVAL_DOCUMENT`; queries `RETRIEVAL_QUERY` |
| U-RAG-12 | Retrieval filtering | Unpublished/unapproved/deactivated chunks never returned |
| U-RAG-13 | Top-k | Default 5; override respected |
| U-RAG-14 | Relevance filtering | Below-threshold candidates dropped; no invented scores |
| U-RAG-15 | Context length limits | Within limit; source metadata preserved |
| U-RAG-16 | Prompt construction | All required rules present (SPEC §4.6); retrieved text delimited as untrusted data |
| U-RAG-17 | Source attribution | Every source maps to a retrieved chunk; none fabricated |
| U-RAG-18 | Fallback logic | Insufficient evidence → fallback; no invented answer |
| U-RAG-19 | Batching | Embedding requests respect provider batch limits |
| U-RAG-20 | Job step planner | Given job progress, selects the next bounded batch that fits the time budget |

### 3.2 Provider adapters (SPEC §4.7)

| ID | Test | Expected |
|---|---|---|
| U-PRV-01 | Successful generation (mocked) | Text returned |
| U-PRV-02 | Malformed or empty response | Controlled application error |
| U-PRV-03 | Timeout via `AbortSignal` | Aborts at configured limit (below function limit) |
| U-PRV-04 | Transient failure (5xx, 429) | Retried with bounded exponential backoff within total time budget |
| U-PRV-05 | Non-transient failure (4xx) | Not retried |
| U-PRV-06 | Raw provider error text | Never propagated to callers |
| U-PRV-07 | API key handling | Never in logs, errors, or responses |
| U-PRV-08 | Retry budget vs function limit | Total retries cannot exceed the configured maximum duration |

### 3.3 Appointments and authorization (FR-003, FR-004, FR-005)

| ID | Test | Expected |
|---|---|---|
| U-APT-01 | Validate doctor, department, date, time | Invalid combinations rejected with structured errors |
| U-APT-02 | Past or out-of-schedule booking | Rejected |
| U-APT-03 | Valid status transitions | Allowed (e.g., pending → confirmed → completed) |
| U-APT-04 | Invalid transitions | Rejected (e.g., cancelled → confirmed) |
| U-APT-05 | Cancellation/rescheduling policy | Enforced per configuration |
| U-APT-06 | Ownership | Patient A cannot act on Patient B's appointment |
| U-APT-07 | Role permission matrix | Enforced per §7.1 |
| U-APT-08 | Error translation | Internal errors map to the consistent error schema; no stack traces |

### 3.4 Configuration and analytics

| ID | Test | Expected |
|---|---|---|
| U-CFG-01 | Missing required server env vars (SPEC §7.2) | Startup/first-use fails with a clear error |
| U-CFG-02 | Invalid values (negative timeout, top-k ≤ 0, dimension mismatch) | Validation error |
| U-CFG-03 | `server-only` boundary | Importing `src/server/*` from client code fails lint/build |
| U-CFG-04 | Public config | Only non-secret values accepted in `NEXT_PUBLIC_*` |
| U-ANL-01 | Descriptive calculators on fixed data | Exact counts, rates, peaks |
| U-ANL-02 | Period comparisons | Correct deltas/percentages; zero baselines handled |
| U-ANL-03 | Output labeling | Measured facts distinct from AI explanations; no causal claims |

### 3.5 Client utilities and API client (UI)

| ID | Test | Expected |
|---|---|---|
| FU-API-01 | Base URL and credentials via the single client layer | Same-origin default; credentials attached only where required |
| FU-API-02 | Error normalization: network, timeout, 401, 403, 404, 422, 429, 5xx | Correct `kind` for each |
| FU-API-03 | Backend error schema → `{kind, status, message, requestId, fieldErrors}` | Field errors mapped; free text never parsed |
| FU-API-04 | Idempotent GET retry | Bounded backoff, then surfaces error |
| FU-API-05 | State-changing requests | Never auto-retried |
| FU-API-06 | Response schema validation | Malformed response raises a contract error |
| FU-UTL-01 | Date/time formatting in Asia/Manila | Correct local display from UTC |
| FU-UTL-02 | Message length validation | Boundaries (max, max+1) handled |
| FU-UTL-03 | File pre-check | PDF/txt accepted; others and oversize rejected |
| FU-UTL-04 | Cache keys include identity | Users never share entries |
| FU-UTL-05 | Sign-out | Client state and caches cleared |

---

## 4. Integration Tests (real Postgres + pgvector)

| ID | Test | Requirement |
|---|---|---|
| I-DB-01 | App ↔ PostgreSQL connectivity, small bounded pool, timeouts | SPEC §6.2 |
| I-DB-02 | Migrations apply cleanly from empty and are re-runnable | SPEC §6 |
| I-DB-03 | pgvector extension present; vector column matches configured dimension | SPEC §4.4 |
| I-DB-04 | Supabase pooled connection (transaction mode, prepared statements disabled) works with concurrent short-lived "invocations" (many parallel service calls) | SPEC §2.4, §6.2 |
| I-DB-05 | Row Level Security is enabled on every application table, with no permissive policies for `anon`/`authenticated` | SPEC §7.2 |
| I-DB-06 | Migrations run over the direct/session connection and apply cleanly on a fresh Supabase project (or local Supabase stack) | SPEC §6.2 |
| I-RAG-01 | Insert synthetic chunks → similarity search returns expected nearest chunk | SPEC §4.5 |
| I-RAG-02 | Retrieval excludes unpublished and deactivated documents | FR-002 |
| I-RAG-03 | Ingestion happy path with mocked Gemini: document → chunks → vectors → published | SPEC §4.2 |
| I-RAG-04 | Re-ingesting an unchanged document creates no duplicate active chunks | SPEC §4.2 |
| I-RAG-05 | Changed document creates a new version; old version retrievable until atomic switch, then not | SPEC §4.2 |
| I-RAG-06 | Embedding failure mid-job → job failed/paused, nothing published, safe retry succeeds | SPEC §9.1 |
| I-RAG-07 | Partially ingested content never retrievable | SPEC §4.2 |
| I-RAG-08 | **Resumable job:** simulate an invocation cut off mid-batch → next invocation resumes from recorded progress with no duplicate chunks | SPEC §4.2 |
| I-RAG-09 | Two overlapping invocations on one job → no duplicate work or corrupted state (locking/lease) | SPEC §4.2 |
| I-APT-01 | Booking creates appointment + status-history row in one transaction | FR-004 |
| I-APT-02 | **Concurrent booking:** N parallel requests for one slot → exactly one succeeds, others get a structured "unavailable" error | FR-004 |
| I-APT-03 | Rescheduling frees old slot and claims new one atomically | FR-004 |
| I-APT-04 | DB constraints reject double-booking even if business logic is bypassed | SPEC §6.1 |
| I-AUD-01 | Sensitive admin actions write audit events | FR-006 |
| I-LLM-01 | No DB transaction is held open during embedding or LLM calls | SPEC §6.1 |
| I-RL-01 | Rate limiting via shared store is consistent across simulated separate instances | SPEC §7.2 |

---

## 5. API Route Handler Tests (`tests/api`)

Handlers are called with real `Request` objects, a real test database, and fake providers.

| ID | Test | Expected |
|---|---|---|
| A-AUTH-01 | No session on protected route | 401, consistent error schema |
| A-AUTH-02 | Expired / tampered / wrong-audience session | 401 |
| A-AUTH-03 | Authenticated, wrong role | 403 |
| A-AUTH-04 | Another user's resource | 403/404 without revealing existence |
| A-AUTH-05 | State-changing request without CSRF protection (if cookie sessions) | Rejected |
| A-VAL-01 | Invalid body/query (Zod) | 400/422 with field errors |
| A-VAL-02 | Oversized body | Rejected |
| A-CHAT-01 | `POST /chat` valid message | Answer + real sources + `request_id` |
| A-CHAT-02 | Message over max length | 422/400 |
| A-CHAT-03 | Rate limit exceeded | 429 |
| A-CHAT-04 | LLM unavailable | Controlled 503; no raw provider text |
| A-CHAT-05 | Embedding provider unavailable | Controlled 503 |
| A-ERR-01 | Forced internal error / DB error | Consistent schema; no stack trace, secret, or raw DB error |
| A-HLTH-01 | Health endpoints | No credentials or provider details exposed |
| A-CACHE-01 | Authenticated responses | `Cache-Control` prevents shared caching; not statically cached |

### 5.1 Authorization matrix

Every protected endpoint is tested for each role:

| Endpoint group | Anonymous | Patient | Doctor | Admin |
|---|---|---|---|---|
| `GET /departments`, `/doctors` | per policy | allow | allow | allow |
| `GET /doctors/{id}/availability` | per policy | allow | allow | allow |
| `POST /appointments` | 401 | allow (self) | deny | per policy |
| `GET /appointments/me` | 401 | allow | per policy | per policy |
| `GET/PATCH/cancel /appointments/{id}` | 401 | own only | assigned only | allow |
| Knowledge-base and signed-upload endpoints | 401 | 403 | 403 | allow |
| Analytics endpoints | 401 | 403 | 403 | allow |
| Audit endpoints | 401 | 403 | 403 | allow |

> "per policy" cells depend on Open Decisions (SPEC §15, items 3, 9, 10). Resolve before writing those tests.

---

## 6. Component Tests (with MSW)

### 6.1 Chat (UI-001)

| ID | Scenario | Expected |
|---|---|---|
| UC-CHAT-01 | Answer + sources returned | Displayed; sources exactly as returned |
| UC-CHAT-02 | No sources | No sources section; nothing fabricated |
| UC-CHAT-03 | Loading state | Indicator shown; no duplicate sends |
| UC-CHAT-04 | Counter and max-length enforcement | Over-length blocked/flagged |
| UC-CHAT-05 | Fallback answer | Distinct styling; helpful links |
| UC-CHAT-06 | `429` | Friendly message; retry later |
| UC-CHAT-07 | `503` provider unavailable | Friendly message; draft preserved |
| UC-CHAT-08 | Network error/timeout | Friendly message; retry; draft preserved |
| UC-CHAT-09 | HTML/script in assistant text | Rendered inert |
| UC-CHAT-10 | AI / not-medical-advice notice | Always visible |
| UC-CHAT-11 | `request_id` | Shown only as support reference |
| UC-CHAT-12 | New messages | Announced via `aria-live` |
| UC-CHAT-13 | Availability question | UI shows no availability claim unless from availability API |

### 6.2 Authentication and guards (UI-002)

| ID | Scenario | Expected |
|---|---|---|
| UC-AUTH-01 | Unauthenticated visit to protected route | Redirect to sign-in with return path |
| UC-AUTH-02 | Successful sign-in | Returned to destination; role-appropriate navigation |
| UC-AUTH-03 | `401` mid-session | Re-authenticate/redirect |
| UC-AUTH-04 | `403` | Access-denied view; no existence leak |
| UC-AUTH-05 | Sign-out | State and caches cleared |

### 6.3 Patient appointments (UI-003)

| ID | Scenario | Expected |
|---|---|---|
| UC-APT-01 | Browse departments/doctors | Data from API; empty/loading/error states |
| UC-APT-02 | View availability | Slots from API only |
| UC-APT-03 | Book a slot | Submit disabled while pending; status reflects server response |
| UC-APT-04 | "Slot unavailable" | Explanation; availability refreshed; choose another |
| UC-APT-05 | Double-click submit | One request only |
| UC-APT-06 | Field errors from server | Shown beside fields |
| UC-APT-07 | My appointments list/detail | Correct statuses and history |
| UC-APT-08 | Cancel | Confirmation required; reflects server result |
| UC-APT-09 | Reschedule incl. policy rejection | Server message surfaced |
| UC-APT-10 | Unconfirmed appointment | Never labeled confirmed before the server says so |

### 6.4 Doctor and admin (UI-004, UI-005)

| ID | Scenario | Expected |
|---|---|---|
| UC-DOC-01 | Schedule and assigned appointments | Matches mock data; filters work |
| UC-DOC-02 | Allowed/rejected status updates | UI reflects server result; no optimistic drift |
| UC-DOC-03 | Patient data shown | Only fields returned by API |
| UC-ADM-01 | CRUD departments/doctors/schedules | Success and validation-error paths |
| UC-ADM-02 | Signed upload of valid PDF/txt | Registered; status shown |
| UC-ADM-03 | Invalid type/oversize | Rejected client-side; server errors surfaced |
| UC-ADM-04 | Extracted-text preview | Shown before approval |
| UC-ADM-05 | Approval is explicit | Upload alone never shows "published" |
| UC-ADM-06 | Ingestion status polling | Bounded polling; stops on terminal state; handles paused/failed |
| UC-ADM-07 | Ingestion failure | Error shown with reprocess option |
| UC-ADM-08 | Deactivate/remove/reprocess | Confirmation for destructive actions |
| UC-ADM-09 | Audit events | List, pagination, empty/error states |

### 6.5 Analytics (UI-006)

| ID | Scenario | Expected |
|---|---|---|
| UC-ANL-01 | Descriptive metrics with fixed fixture | Values match exactly |
| UC-ANL-02 | Range/granularity changes | Correct request parameters |
| UC-ANL-03 | Diagnostic comparisons | Deltas as returned |
| UC-ANL-04 | AI explanation present | Labeled and separated from measured data |
| UC-ANL-05 | Copy review | No causal language for correlations |
| UC-ANL-06 | Chart alternatives | Data table or text summary |
| UC-ANL-07 | Empty/loading/error states | Present for each chart |

---

## 7. Contract Tests

| ID | Test | Expected |
|---|---|---|
| K-01 | Shared Zod schemas validate every route's request and response | Client and server cannot drift |
| K-02 | OpenAPI document generated/maintained from schemas matches handlers | CI fails on mismatch |
| K-03 | Error responses conform to the consistent error schema | Verified for 401, 403, 404, 422, 429, 5xx |
| K-04 | Chat response shape (`answer`, `sources[]`, `request_id`) | Handled; optional fields tolerated |
| K-05 | Status enums | Unknown values degrade gracefully, not crash |

Contract changes update schemas, handlers, client, mocks, and tests together. No silent changes.

---

## 8. AI Evaluation (SPEC §4.8)

A fixed dataset in `tests/fixtures/eval/`. Each item: question, category, expected relevant passages (document + section), expected behavior (answer / fallback / refuse), notes.

**Categories:** single-document; multi-passage; no answer in KB; ambiguous; misspelled/rephrased; prompt-injection attempts; appointment-availability requests; medical-diagnosis requests. Suggested starting size: ≥ 10 per category, adjusted to capstone capacity; document the final size.

| Metric | Definition |
|---|---|
| Retrieval recall@k | Fraction of known relevant passages in top-k |
| Retrieval precision@k | Fraction of top-k that are relevant |
| Answer correctness | Judged against approved evidence |
| Citation correctness | Cited sources exist and support the claim |
| Unsupported-claim rate | Claims not backed by retrieved context |
| Appropriate-fallback rate | Unanswerable questions that correctly fall back |
| Latency | Median and p95 end-to-end, measured **on the deployed serverless platform** (including cold starts) |
| Provider error rate | Failed provider calls / total |

Rules:

- Run against real providers only in an explicit opt-in run; CI uses mocks.
- Record date, embedding model, LLM model, chunking settings, top-k, threshold, and hosting platform with each result.
- Tune chunk size, overlap, top-k, and threshold against this dataset, then re-run.
- Report honestly; do not claim reliability from a few successful demos.

---

## 9. End-to-End Tests (Playwright)

Run against the built app with the local test database and fake providers; an opt-in suite can run against the deployed preview with synthetic data.

| ID | Scenario | Requirement |
|---|---|---|
| E-CHAT-01 | Visitor/patient asks a covered question → grounded answer with real sources | FR-001 |
| E-CHAT-02 | Unanswerable question → fallback with helpful links | FR-001 |
| E-CHAT-03 | Source references resolve to actual knowledge-base records | FR-001 |
| E-CHAT-04 | LLM provider down → temporary-unavailability message; retry works after restore | SPEC §9.1 |
| E-APT-01 | Patient signs in, books, views, cancels an appointment | FR-003, FR-004 |
| E-APT-02 | Two browser contexts race for one slot → one succeeds, other sees conflict flow | FR-004 |
| E-APT-03 | Patient cannot open another patient's appointment (403/404 view) | FR-003 |
| E-APT-04 | Chatbot asked about availability does not assert it; availability only from the booking flow | FR-004 |
| E-DOC-01 | Doctor sees only own schedule/appointments and updates an allowed status | FR-005 |
| E-ADM-01 | Admin uploads → previews → approves → publishes; ingestion progresses; chat then cites it | FR-002 |
| E-ADM-02 | Non-admins cannot register, approve, or publish documents | FR-002, FR-006 |
| E-ADM-03 | Deactivating a document stops retrieval | FR-002 |
| E-ANL-01 | Admin views analytics; values reconcile with seeded data | FR-007 |
| E-ANL-02 | Non-admins cannot access analytics | FR-006, FR-007 |
| E-RES-01 | Database unavailable → friendly unavailable state; public pages still navigable | SPEC §9.1 |
| E-RES-02 | Session expiry mid-flow → sign-in redirect and return | UI-002 |
| E-RES-03 | Sign-out clears data; back button reveals no protected content | SPEC §7.3 |
| E-ERR-01 | Forced server error → consistent UI error, no stack trace | SPEC §5 |

---

## 10. Accessibility Tests (SPEC §8.1)

| ID | Test | Expected |
|---|---|---|
| A11Y-01 | axe scan of every page in default, loading, empty, and error states | No serious/critical violations |
| A11Y-02 | Keyboard-only walkthrough: chat, booking, cancel, admin upload | Fully operable; no traps |
| A11Y-03 | Focus management | Dialogs trap/restore focus; errors announced |
| A11Y-04 | Screen-reader semantics | Landmarks, labels, headings, errors tied via `aria-describedby` |
| A11Y-05 | Live regions | Chat and status changes announced politely |
| A11Y-06 | Contrast and non-color cues | WCAG AA; status never by color alone |
| A11Y-07 | Reduced motion | Animations disabled under `prefers-reduced-motion` |
| A11Y-08 | 200% zoom and 320 px width | No loss of content or function |
| A11Y-09 | Chart alternatives | Table or text summary available |

Manual: screen-reader pass (NVDA/VoiceOver) on chat and booking; record results in `docs/accessibility.md`.

---

## 11. Security and Privacy Tests

| ID | Test | Expected |
|---|---|---|
| S-01 | Prompt injection in the user message | System rules hold; no prompt/config disclosure |
| S-02 | Prompt injection inside a retrieved document | Treated as untrusted; not followed |
| S-03 | Request for system prompt, keys, or config | Refused; nothing leaked |
| S-04 | **Client bundle secret scan** | No API keys, DB URLs, or auth secrets in build output |
| S-05 | Only non-secret values in `NEXT_PUBLIC_*` | Verified in CI |
| S-06 | `server-only` enforcement | Client import of server modules fails the build |
| S-07 | XSS: malicious strings in answers, names, titles, errors | Rendered inert |
| S-08 | No unsanitized `dangerouslySetInnerHTML` | Lint rule / grep check |
| S-09 | Logs and console output | No passwords, keys, auth headers, tokens, full patient messages, or chat content |
| S-10 | Error messages | Do not reveal whether another user's record exists |
| S-11 | Chat context | No patient-specific records without explicit authorized requirement |
| S-12 | **Middleware bypass check** | Protected handlers still return 401/403 when called without passing through middleware (authorization lives in handlers/services) |
| S-13 | Signed upload URLs | Expire quickly; single object key; enforced content type and size; cannot overwrite other objects |
| S-14 | Authenticated responses not shared-cached | Cache headers/config verified |
| S-15 | CSRF (if cookie sessions) | State-changing requests protected |
| S-16 | CSP and security headers | Configured and verified where feasible |
| S-17 | Production error boundary | No stack traces shown |
| S-18 | Supabase database access | TLS required; connection strings and `service_role` key not exposed; no public access beyond provider requirements |
| S-21 | Supabase Data API (PostgREST) called with the `anon` key | Cannot read or write any application table (RLS deny-by-default), or the Data API is disabled |
| S-19 | Third-party scripts | None receive patient data; inventory reviewed |
| S-20 | Dependency audit | No unreviewed high/critical findings |

---

## 12. Performance and Responsiveness

| ID | Test | Expected |
|---|---|---|
| P-01 | Chat round-trip latency on deployed platform (cold and warm) | Baseline recorded; budgets set after first measurement |
| P-02 | `POST /chat` stays under the function time limit with retry budget | Verified incl. worst-case retries |
| P-03 | Ingestion step duration | Each step completes within the function limit with margin |
| P-04 | Code-splitting of dashboards and charts | Not in the initial public bundle |
| P-05 | Lighthouse / Web Vitals on home, chat, booking | Baseline recorded; regressions flagged |
| P-06 | Viewport matrix (320, 375, 768, 1024, 1440 px) | No horizontal overflow; usable layouts |
| P-07 | Free-tier/quota check | Demo workload stays within platform and provider limits **[Open]** |

---

## 13. Smoke Tests (opt-in, real services)

Marked and excluded by default; require dev credentials and synthetic data.

| ID | Test |
|---|---|
| SM-01 | Gemini returns a 768-dim vector for each task type |
| SM-02 | OpenCode Zen returns a non-empty completion for the configured model/endpoint |
| SM-03 | Ingest a synthetic document and answer one grounded question end to end |
| SM-04 | Deployed preview: health route reachable over HTTPS; environment variables present; migrations applied |
| SM-05 | Deployed preview: sign-in, book, cancel with synthetic data |
| SM-06 | Deployed preview: ingestion job completes across multiple invocations |

---

## 14. Deployment and Operations Checks (Phases 6 and 8)

| ID | Check | Expected |
|---|---|---|
| D-01 | Local setup from a clean checkout using documented commands | App runs; tests pass |
| D-02 | Migrations from empty on local, CI, and hosted databases | Succeed; reviewed before production runs |
| D-03 | Environment variables present in hosting platform; none in repo or build output | Verified |
| D-04 | Preview/demo environments use separate databases and keys | Verified |
| D-05 | Platform limits (time, body size, memory) match assumptions in SPEC §2.4 | Documented; tests adjusted |
| D-06 | Rollback of a bad deployment | Previous version restorable |
| D-07 | Supabase backup and restore procedure (verify what the chosen plan includes) | Restored database passes an integrity check |
| D-08 | Provider quota exhaustion (Gemini, OpenCode Zen) | Controlled errors; UI degrades gracefully |

---

## 15. Acceptance Gates

A feature is complete only when:

1. Its specification is approved.
2. Its tests are written (and were failing first).
3. All applicable tests pass (unit, integration, API, component, contract, e2e).
4. Authorization is enforced and tested on the server.
5. Error and downtime paths are tested.
6. Accessibility checks pass for affected pages.
7. Type check, lint, and dependency audit are clean.
8. Documentation is updated.
9. The implementation is reviewed and the human reviewer approves.

### 15.1 Phase exit mapping

| Phase | Must pass |
|---|---|
| 1 | U-CFG-*, I-DB-01..06, D-01, D-02, S-04..06, S-21 |
| 2 | U-RAG-01..15, U-RAG-19..20, I-RAG-01..09, S-13 |
| 3 | U-RAG-16..18, U-PRV-*, A-CHAT-*, I-RL-01, E-CHAT-01..04, S-01..03, P-02, evaluation baseline |
| 4 | U-APT-*, I-APT-*, A-AUTH-*, §5.1 matrix, E-APT-*, E-DOC-*, E-ADM-*, S-12 |
| 5 | UC-*, FU-*, E-RES-*, A11Y-01..05 |
| 6 | D-03..D-06, SM-04..06, S-14, S-18, P-01, P-03 |
| 7 | U-ANL-*, UC-ANL-*, E-ANL-*, full evaluation report |
| 8 | Entire suite, A11Y-01..09, S-01..21, P-01..07, D-07, D-08 |

### 15.2 Coding-agent testing rules

- Write failing tests before implementation.
- Never bypass or weaken a failing test without approval.
- Never use real patient data in fixtures, screenshots, or traces.
- Never run destructive database commands without approval.
- Keep tests deterministic and independent of order.
- Update schemas, handlers, client, mocks, and tests together with any API contract change.
