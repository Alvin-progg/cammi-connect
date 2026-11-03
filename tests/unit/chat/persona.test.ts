// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CAMI_IDENTITY, CAMI_INTRO, SMALL_TALK_SYSTEM_PROMPT } from "@/lib/chat/persona";

describe("CAMI_IDENTITY", () => {
  it("introduces Cami as the hospital's appointment assistant", () => {
    expect(CAMI_IDENTITY).toContain("Cami");
    expect(CAMI_IDENTITY).toContain("United Doctors of St. Camillus De Lellis Hospital");
  });

  it("lists only the capabilities that exist and says rescheduling is not available", () => {
    expect(CAMI_IDENTITY).toMatch(/book/i);
    expect(CAMI_IDENTITY).toMatch(/hospital information|questions about the hospital/i);
    expect(CAMI_IDENTITY).toMatch(/cancel/i);
    expect(CAMI_IDENTITY).toMatch(/reschedul.*not available/i);
  });

  it("states the healthcare safety boundaries", () => {
    expect(CAMI_IDENTITY).toMatch(/diagnos/i);
    expect(CAMI_IDENTITY).toMatch(/medicine|medication/i);
    expect(CAMI_IDENTITY).toMatch(/never invent/i);
  });
});

describe("SMALL_TALK_SYSTEM_PROMPT", () => {
  it("builds on the Cami identity", () => {
    expect(SMALL_TALK_SYSTEM_PROMPT).toContain(CAMI_IDENTITY);
  });

  it("forbids stating directory, availability, or booking facts", () => {
    expect(SMALL_TALK_SYSTEM_PROMPT).toMatch(/never state .*doctor/i);
    expect(SMALL_TALK_SYSTEM_PROMPT).toMatch(/availability/i);
    expect(SMALL_TALK_SYSTEM_PROMPT).toMatch(/booked or cancelled/i);
  });

  it("treats the conversation as data and keeps the instructions private", () => {
    expect(SMALL_TALK_SYSTEM_PROMPT).toMatch(/not .*instructions/i);
    expect(SMALL_TALK_SYSTEM_PROMPT).toMatch(/never reveal/i);
  });
});

describe("CAMI_INTRO", () => {
  it("introduces Cami and what she can help with", () => {
    expect(CAMI_INTRO).toContain("Cami");
    expect(CAMI_INTRO).toMatch(/book/i);
    expect(CAMI_INTRO).toMatch(/cancel/i);
  });
});
