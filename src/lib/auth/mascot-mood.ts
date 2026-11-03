/**
 * Mood of the decorative auth-page mascots (design.md §6.2). Derived purely
 * from what the user is doing in the form. A failed submit always produces
 * the same mood, so the mascots never hint at whether an account exists.
 */
export type MascotMood = "idle" | "curious" | "look-away" | "disapprove";

export type MascotInput = {
  /** Name of the form field that has focus, or null when none does. */
  focusedField: string | null;
  /** The focused field is a password field. */
  focusedFieldIsSecret: boolean;
  /** The focused password field is currently shown as plain text. */
  passwordRevealed: boolean;
  /** The last submit failed and the user has not typed since. */
  hasError: boolean;
};

export function deriveMascotMood({
  focusedField,
  focusedFieldIsSecret,
  passwordRevealed,
  hasError,
}: MascotInput): MascotMood {
  if (hasError) return "disapprove";
  if (focusedField === null) return "idle";
  if (focusedFieldIsSecret && passwordRevealed) return "look-away";
  return "curious";
}

/** Largest sideways pupil shift, in illustration (SVG) units. */
export const MAX_GAZE_OFFSET = 4;

const CHARACTERS_PER_GAZE_UNIT = 6;

/** How far the pupils follow the text as it grows, so the eyes track typing. */
export function gazeOffset(typedLength: number): number {
  const offset = typedLength / CHARACTERS_PER_GAZE_UNIT;
  return Math.min(MAX_GAZE_OFFSET, Math.max(0, offset));
}

/**
 * How the nurse sprite mascot shows each mood. Values are cells of its sprite
 * sheets (see `Mascot` in src/components/auth/mascot.tsx). An empty pose leaves
 * her following the cursor.
 */
export type NursePose = {
  lookAt?: "down";
  expression?: "bashful" | "dizzy";
};

export function nursePose(mood: MascotMood): NursePose {
  switch (mood) {
    case "idle":
      return {};
    case "curious":
      // She sits above the heading, so the form is below her.
      return { lookAt: "down" };
    case "look-away":
      return { expression: "bashful" };
    case "disapprove":
      return { expression: "dizzy" };
  }
}
