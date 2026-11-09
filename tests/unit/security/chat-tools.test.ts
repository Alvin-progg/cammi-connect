// @vitest-environment node
import { describe, expect, it } from "vitest";

import { intentExtractionSchema } from "@/lib/chat/schemas";

/**
 * The model never calls tools: it only classifies a message into
 * intentExtractionSchema. Patient and appointment IDs come from the session
 * and from card events re-read against the database, so the model's output
 * must have no way to carry one.
 */
describe("chat model output", () => {
  it("has no patient or appointment ID field", () => {
    const keys = Object.keys(intentExtractionSchema.shape);

    expect(keys.filter((key) => /patient|appointment|id$/i.test(key))).toEqual([]);
  });

  it("drops IDs a prompt-injected model adds", () => {
    const parsed = intentExtractionSchema.parse({
      intent: "cancel",
      patientId: "00000000-0000-4000-8000-000000000999",
      appointmentId: "00000000-0000-4000-8000-000000000998",
    });

    expect(parsed).not.toHaveProperty("patientId");
    expect(parsed).not.toHaveProperty("appointmentId");
  });
});
