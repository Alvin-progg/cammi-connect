import "server-only";

export type ProviderName = "gemini" | "opencode-zen";

export type ProviderErrorKind =
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "bad_request"
  | "invalid_response";

/**
 * Controlled provider failure. The message is built only from the provider
 * name, the kind, and the HTTP status, so it can never carry a key, a request
 * URL, or the raw provider body (SPEC §4.7, §7.3).
 */
export class ProviderError extends Error {
  readonly provider: ProviderName;
  readonly kind: ProviderErrorKind;
  readonly status?: number;

  constructor(provider: ProviderName, kind: ProviderErrorKind, status?: number) {
    super(`${provider} request failed (${kind}${status ? `, HTTP ${status}` : ""})`);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}

export type FetchJsonOptions = {
  provider: ProviderName;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  /** Extra attempts after the first one, for transient failures only. */
  maxRetries: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const BASE_BACKOFF_MS = 500;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function kindForStatus(status: number): ProviderErrorKind {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "bad_request";
}

async function attemptOnce(options: FetchJsonOptions): Promise<unknown> {
  const { provider, url, init, timeoutMs, signal, fetchImpl = fetch } = options;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: combinedSignal });
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw new ProviderError(provider, timeoutSignal.aborted ? "timeout" : "unavailable");
  }

  if (!response.ok) {
    // Drain the body without reading it into any message.
    await response.body?.cancel();
    throw new ProviderError(provider, kindForStatus(response.status), response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new ProviderError(provider, "invalid_response", response.status);
  }
}

function isRetryable(error: unknown): error is ProviderError {
  return (
    error instanceof ProviderError &&
    (error.kind === "timeout" || error.kind === "rate_limited" || error.kind === "unavailable")
  );
}

/**
 * POSTs to a provider with a per-attempt timeout and bounded exponential
 * backoff on 429, 5xx, timeouts, and network errors. Other 4xx responses and
 * caller aborts are not retried.
 */
export async function fetchJson(options: FetchJsonOptions): Promise<unknown> {
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) throw options.signal.reason;

    try {
      return await attemptOnce(options);
    } catch (error) {
      if (!isRetryable(error) || attempt >= options.maxRetries) throw error;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
  }
}
