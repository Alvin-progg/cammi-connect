#!/usr/bin/env node
/**
 * Provider smoke test for AI-APT-001 S0 (ADR-0006).
 *
 * Run with: npm run smoke:providers
 * Requires .env.local with GEMINI_API_KEY, OPENCODE_ZEN_API_KEY,
 * OPENCODE_ZEN_BASE_URL, and OPENCODE_ZEN_MODEL. GEMINI_EMBEDDING_MODEL and
 * EMBEDDING_DIMENSIONS are optional (defaults: gemini-embedding-001, 768).
 *
 * Makes one Gemini embedding call and one Zen chat completion with synthetic
 * text. It prints only pass/fail lines and HTTP statuses, never keys or
 * response bodies.
 */

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 30_000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`FAIL  missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = response.ok ? await response.json().catch(() => null) : null;
  if (!response.ok) await response.body?.cancel();
  return { status: response.status, ok: response.ok, json };
}

async function smokeGemini() {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || 768);

  const { status, ok, json } = await postJson(
    `${GEMINI_API_BASE_URL}/models/${model}:embedContent`,
    { "x-goog-api-key": apiKey },
    {
      model: `models/${model}`,
      content: { parts: [{ text: "What documents should I bring to my appointment?" }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: dimensions,
    },
  );

  const length = json?.embedding?.values?.length;
  if (ok && length === dimensions) {
    console.log(`PASS  Gemini ${model}: ${length}-dimension vector`);
    return true;
  }
  console.error(
    `FAIL  Gemini ${model}: HTTP ${status}, vector length ${length ?? "missing"} (expected ${dimensions})`,
  );
  return false;
}

async function smokeZen() {
  const apiKey = requireEnv("OPENCODE_ZEN_API_KEY");
  const baseUrl = requireEnv("OPENCODE_ZEN_BASE_URL").replace(/\/+$/, "");
  const model = requireEnv("OPENCODE_ZEN_MODEL");
  const url = `${baseUrl}/chat/completions`;
  const headers = { authorization: `Bearer ${apiKey}` };
  const messages = [
    {
      role: "system",
      content: 'Reply with only a JSON object of the form {"intent": string}.',
    },
    { role: "user", content: "I would like to book a consultation." },
  ];

  const jsonMode = await postJson(url, headers, {
    model,
    messages,
    response_format: { type: "json_object" },
  });
  const jsonModeContent = jsonMode.json?.choices?.[0]?.message?.content;
  if (jsonMode.ok && typeof jsonModeContent === "string") {
    const parses = isJson(jsonModeContent);
    console.log(`PASS  Zen ${model}: chat completion with response_format json_object`);
    console.log(`INFO  json mode supported: yes; reply parses as JSON: ${parses ? "yes" : "no"}`);
    return true;
  }

  console.log(`INFO  json mode request returned HTTP ${jsonMode.status}; retrying without it`);
  const plain = await postJson(url, headers, { model, messages });
  const plainContent = plain.json?.choices?.[0]?.message?.content;
  if (plain.ok && typeof plainContent === "string") {
    console.log(`PASS  Zen ${model}: chat completion without response_format`);
    console.log(
      `INFO  json mode supported: no; use prompt-instructed JSON fallback (reply parses as JSON: ${isJson(plainContent) ? "yes" : "no"})`,
    );
    return true;
  }
  console.error(`FAIL  Zen ${model}: HTTP ${plain.status}, no message content`);
  return false;
}

function isJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

async function run(label, check) {
  try {
    return await check();
  } catch (error) {
    // Only the error name is printed; fetch errors can echo request details.
    console.error(`FAIL  ${label}: ${error?.name ?? "error"}`);
    return false;
  }
}

const results = [await run("Gemini", smokeGemini), await run("Zen", smokeZen)];
if (results.every(Boolean)) {
  console.log("Provider smoke test passed.");
} else {
  console.error("Provider smoke test failed.");
  process.exit(1);
}
