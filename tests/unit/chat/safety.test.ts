import { describe, expect, it } from "vitest";

import {
  BOOKING_OFFER,
  MEDICAL_ADVICE_DECLINE,
  ROUTING_COPY,
  soundsUrgent,
} from "@/lib/chat/safety";

describe("soundsUrgent", () => {
  it.each([
    "I have chest pain since this morning",
    "My dad has CHEST PAIN and is sweating",
    "my mom is having difficulty breathing",
    "I can't breathe properly",
    "I cannot breathe",
    "there is severe bleeding from the cut",
    "the bleeding won't stop",
    "my brother is unconscious",
    "she passed out and is unresponsive",
    "he lost consciousness",
    "I think she is having a seizure",
    "I feel like I want to kill myself",
  ])("flags %j", (message) => {
    expect(soundsUrgent(message)).toBe(true);
  });

  it.each([
    "I'd like to book an appointment with cardiology",
    "I have a mild cough and a runny nose",
    "What documents should I bring?",
    "Which doctors are available on Monday?",
  ])("does not flag %j", (message) => {
    expect(soundsUrgent(message)).toBe(false);
  });
});

describe("routing templates", () => {
  // Spec AI-APT-002 §3: no diagnosis wording and no condition names.
  const BANNED = [
    /you have/i,
    /it sounds like/i,
    /diagnos/i,
    /hypertension|diabetes|infection|asthma|pneumonia|flu\b|covid|cancer|arrhythmia|heart attack/i,
  ];

  const templates = [
    ROUTING_COPY.routed("Cardiology"),
    ROUTING_COPY.firstContact("Family Medicine"),
    ROUTING_COPY.askConcern,
    ROUTING_COPY.askAge,
    BOOKING_OFFER,
    MEDICAL_ADVICE_DECLINE,
  ];

  it.each(templates)("%j names no condition and makes no diagnosis", (template) => {
    for (const pattern of BANNED) {
      expect(template).not.toMatch(pattern);
    }
  });

  it("names the routed specialty", () => {
    expect(ROUTING_COPY.routed("Cardiology")).toContain("Cardiology");
    expect(ROUTING_COPY.firstContact("Family Medicine")).toContain("Family Medicine");
  });
});
