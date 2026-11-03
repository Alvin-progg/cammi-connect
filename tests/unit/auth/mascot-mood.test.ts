// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  deriveMascotMood,
  gazeOffset,
  MAX_GAZE_OFFSET,
  nursePose,
  type MascotInput,
} from "@/lib/auth/mascot-mood";

const NOTHING_FOCUSED: MascotInput = {
  focusedField: null,
  focusedFieldIsSecret: false,
  passwordRevealed: false,
  hasError: false,
};

describe("deriveMascotMood", () => {
  it("is idle when no field is focused", () => {
    expect(deriveMascotMood(NOTHING_FOCUSED)).toBe("idle");
  });

  it("is curious when a plain field is focused", () => {
    expect(
      deriveMascotMood({ ...NOTHING_FOCUSED, focusedField: "email" }),
    ).toBe("curious");
  });

  it("is curious when a hidden password field is focused", () => {
    expect(
      deriveMascotMood({
        ...NOTHING_FOCUSED,
        focusedField: "password",
        focusedFieldIsSecret: true,
      }),
    ).toBe("curious");
  });

  it("looks away when the focused password field is revealed", () => {
    expect(
      deriveMascotMood({
        ...NOTHING_FOCUSED,
        focusedField: "password",
        focusedFieldIsSecret: true,
        passwordRevealed: true,
      }),
    ).toBe("look-away");
  });

  it("ignores a revealed flag on a non-secret field", () => {
    expect(
      deriveMascotMood({
        ...NOTHING_FOCUSED,
        focusedField: "email",
        passwordRevealed: true,
      }),
    ).toBe("curious");
  });

  it("disapproves after a failed submit, over every other state", () => {
    expect(deriveMascotMood({ ...NOTHING_FOCUSED, hasError: true })).toBe(
      "disapprove",
    );
    expect(
      deriveMascotMood({
        focusedField: "password",
        focusedFieldIsSecret: true,
        passwordRevealed: true,
        hasError: true,
      }),
    ).toBe("disapprove");
  });
});

describe("gazeOffset", () => {
  it("is zero before anything is typed", () => {
    expect(gazeOffset(0)).toBe(0);
  });

  it("grows as more is typed", () => {
    expect(gazeOffset(10)).toBeGreaterThan(gazeOffset(2));
  });

  it("clamps at the maximum offset", () => {
    expect(gazeOffset(500)).toBe(MAX_GAZE_OFFSET);
    expect(gazeOffset(-3)).toBe(0);
  });
});

describe("nursePose", () => {
  it("leaves the nurse following the cursor when idle", () => {
    expect(nursePose("idle")).toEqual({});
  });

  it("looks down at the form while the user types", () => {
    expect(nursePose("curious")).toEqual({ lookAt: "down" });
  });

  it("shuts her eyes bashfully while a password is shown", () => {
    expect(nursePose("look-away")).toEqual({ expression: "bashful" });
  });

  it("looks dizzy after a failed submit", () => {
    expect(nursePose("disapprove")).toEqual({ expression: "dizzy" });
  });
});
