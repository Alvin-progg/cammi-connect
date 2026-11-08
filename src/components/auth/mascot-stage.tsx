"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type ReactNode,
} from "react";

import {
  deriveMascotMood,
  gazeOffset,
  type MascotMood,
} from "@/lib/auth/mascot-mood";

type MascotContextValue = {
  mood: MascotMood;
  /** Sideways pupil shift that grows with the text in the focused field. */
  gaze: number;
  /** Bumps on every failed submit so the head shake can replay. */
  errorCount: number;
  setPasswordRevealed: (fieldName: string, revealed: boolean) => void;
  reportError: () => void;
};

// Forms rendered outside a stage (e.g. in isolation tests) get a no-op.
const MascotContext = createContext<MascotContextValue>({
  mood: "idle",
  gaze: 0,
  errorCount: 0,
  setPasswordRevealed: () => {},
  reportError: () => {},
});

export function useMascot() {
  return useContext(MascotContext);
}

type FocusedField = { name: string; isSecret: boolean };

/** Finds the FormField wrapper (marked with data-mascot-field) around an event target. */
function findField(target: EventTarget): FocusedField | null {
  if (!(target instanceof Element)) return null;
  const wrapper = target.closest<HTMLElement>("[data-mascot-field]");
  if (!wrapper) return null;
  return {
    name: wrapper.dataset.mascotField ?? "",
    isSecret: wrapper.dataset.mascotSecret === "true",
  };
}

/**
 * Tracks focus and typing inside the auth page through bubbling events, so the
 * form fields only need data attributes, and shares the resulting mascot mood
 * with the nurse. `data-mood` exposes the current mood on the stage.
 */
export function MascotStage({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [focusedField, setFocusedField] = useState<FocusedField | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [typedLength, setTypedLength] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  const setPasswordRevealed = useCallback(
    (fieldName: string, revealed: boolean) => {
      setRevealedFields((current) => ({ ...current, [fieldName]: revealed }));
    },
    [],
  );

  const reportError = useCallback(() => {
    setHasError(true);
    setErrorCount((count) => count + 1);
  }, []);

  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    const field = findField(event.target);
    setFocusedField(field);
    if (field && event.target instanceof HTMLInputElement) {
      setTypedLength(event.target.value.length);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // Moving focus inside the same field (input <-> show-password toggle)
    // keeps it focused; the matching focus event will set it again anyway.
    if (event.relatedTarget && findField(event.relatedTarget)) return;
    setFocusedField(null);
  }

  function handleChange(event: ChangeEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLInputElement)) return;
    setTypedLength(event.target.value.length);
    setHasError(false);
  }

  const value = useMemo<MascotContextValue>(
    () => ({
      mood: deriveMascotMood({
        focusedField: focusedField?.name ?? null,
        focusedFieldIsSecret: focusedField?.isSecret ?? false,
        passwordRevealed: focusedField
          ? (revealedFields[focusedField.name] ?? false)
          : false,
        hasError,
      }),
      gaze: gazeOffset(typedLength),
      errorCount,
      setPasswordRevealed,
      reportError,
    }),
    [
      focusedField,
      revealedFields,
      hasError,
      typedLength,
      errorCount,
      setPasswordRevealed,
      reportError,
    ],
  );

  return (
    <MascotContext value={value}>
      <div
        className={className}
        data-mood={value.mood}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
      >
        {children}
      </div>
    </MascotContext>
  );
}
