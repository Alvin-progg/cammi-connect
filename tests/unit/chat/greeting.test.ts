import { describe, expect, it } from "vitest";

import { greetingFor } from "@/lib/chat/greeting";

// Manila is UTC+8 with no DST, so 00:00Z is 08:00 in Manila.
function manilaTime(hhmm: string): Date {
  return new Date(`2026-10-30T${hhmm}:00+08:00`);
}

describe("greetingFor", () => {
  it.each([
    ["00:00", "Good Morning"],
    ["11:59", "Good Morning"],
    ["12:00", "Good Afternoon"],
    ["17:59", "Good Afternoon"],
    ["18:00", "Good Evening"],
    ["23:59", "Good Evening"],
  ])("uses the Manila hour at %s", (time, salutation) => {
    expect(greetingFor("Ana Cruz", manilaTime(time)).salutation).toBe(salutation);
  });

  it("does not use the server's local hour", () => {
    // 20:00 UTC is 04:00 the next day in Manila.
    const greeting = greetingFor("Ana Cruz", new Date("2026-10-30T20:00:00Z"));
    expect(greeting.salutation).toBe("Good Morning");
  });

  it("uses only the first name", () => {
    expect(greetingFor("  Ana Maria Cruz ", manilaTime("09:00")).firstName).toBe("Ana");
  });

  it("falls back to a neutral word for an empty name", () => {
    expect(greetingFor("   ", manilaTime("09:00")).firstName).toBe("there");
  });
});
