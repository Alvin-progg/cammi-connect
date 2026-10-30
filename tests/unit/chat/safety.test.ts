import { describe, expect, it } from "vitest";

import { soundsUrgent } from "@/lib/chat/safety";

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
