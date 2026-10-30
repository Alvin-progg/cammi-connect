// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { fetchJson, ProviderError } from "@/server/ai/http";

vi.mock("server-only", () => ({}));

const SECRET_KEY = "sk-test-secret-key-123";
const RAW_BODY = "upstream said: patient Juan has chest pain";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

function options(fetchImpl: typeof fetch, overrides: { maxRetries?: number; timeoutMs?: number } = {}) {
  return {
    provider: "opencode-zen" as const,
    url: "https://provider.example.test/v1/chat/completions",
    init: {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET_KEY}` },
      body: "{}",
    },
    timeoutMs: overrides.timeoutMs ?? 1000,
    maxRetries: overrides.maxRetries ?? 2,
    fetchImpl,
    sleep: vi.fn(async () => {}),
  };
}

async function captureError(promise: Promise<unknown>): Promise<ProviderError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProviderError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

describe("fetchJson", () => {
  it("returns the parsed JSON body on success", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));

    await expect(fetchJson(options(fetchImpl))).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails with a timeout error when the provider does not answer in time", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );

    const error = await captureError(
      fetchJson(options(fetchImpl, { timeoutMs: 10, maxRetries: 0 })),
    );

    expect(error.kind).toBe("timeout");
    expect(error.provider).toBe("opencode-zen");
  });

  it("retries a 503 and succeeds on the next attempt with backoff", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(textResponse(RAW_BODY, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const opts = options(fetchImpl);

    await expect(fetchJson(opts)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(opts.sleep).toHaveBeenCalledWith(500);
  });

  it("stops after maxRetries + 1 attempts with exponential backoff", async () => {
    const fetchImpl = vi.fn(async () => textResponse(RAW_BODY, 503));
    const opts = options(fetchImpl, { maxRetries: 2 });

    const error = await captureError(fetchJson(opts));

    expect(error.kind).toBe("unavailable");
    expect(error.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(opts.sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it("retries a 429 and reports rate limiting when retries run out", async () => {
    const fetchImpl = vi.fn(async () => textResponse(RAW_BODY, 429));

    const error = await captureError(fetchJson(options(fetchImpl, { maxRetries: 1 })));

    expect(error.kind).toBe("rate_limited");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries network failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(fetchJson(options(fetchImpl))).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx other than 429", async () => {
    const fetchImpl = vi.fn(async () => textResponse(RAW_BODY, 400));

    const error = await captureError(fetchJson(options(fetchImpl)));

    expect(error.kind).toBe("bad_request");
    expect(error.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a non-JSON success body as an invalid response", async () => {
    const fetchImpl = vi.fn(async () => textResponse("<html>oops</html>", 200));

    const error = await captureError(fetchJson(options(fetchImpl)));

    expect(error.kind).toBe("invalid_response");
  });

  it("does not retry once the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));

    await expect(
      fetchJson({ ...options(fetchImpl), signal: controller.signal }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never includes the key or the raw provider body in the error", async () => {
    const fetchImpl = vi.fn(async () => textResponse(`${RAW_BODY} ${SECRET_KEY}`, 401));

    const error = await captureError(fetchJson(options(fetchImpl)));
    const rendered = `${String(error)} ${error.message} ${JSON.stringify(error)}`;

    expect(rendered).not.toContain(SECRET_KEY);
    expect(rendered).not.toContain(RAW_BODY);
  });
});
