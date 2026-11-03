"use client";

import type { CSSProperties } from "react";

import type { MascotMood } from "@/lib/auth/mascot-mood";

import { useMascot } from "./mascot-stage";

/**
 * Decorative flat illustration for the auth pages (design.md §6.2): a hospital
 * building, a clipboard, a smiling blob, a capsule holding a thermometer, and
 * a heart with a pulse line. The characters react to the form through
 * `useMascot()`: curious while typing, looking away while a password is
 * shown, disapproving after a failed submit. Colors come from the Calm Care
 * tokens. Purely decorative, so it is hidden from assistive technology.
 */
const BLINK_CLASS =
  "origin-center [transform-box:fill-box] motion-safe:animate-blink";

const MOVE_CLASS =
  "transition-[transform,opacity] duration-200 ease-snappy motion-reduce:transition-none";

/** Largest pupil shift that still keeps the pupil inside the eye. */
const MAX_PUPIL_SHIFT = 3.5;

function pupilShift(mood: MascotMood, gaze: number): CSSProperties {
  switch (mood) {
    case "curious": {
      // Look toward the form (right) and follow the text as it grows.
      const dx = Math.min(MAX_PUPIL_SHIFT, 1.5 + gaze / 2);
      return { transform: `translate(${dx}px, 0.5px)` };
    }
    case "look-away":
      return { transform: "translate(-3.5px, -2.5px)" };
    case "disapprove":
      return { transform: "translate(0px, 1px)" };
    case "idle":
      return { transform: "translate(0px, 0px)" };
  }
}

export function HospitalIllustration({ className }: { className?: string }) {
  const { mood, gaze, errorCount } = useMascot();
  const disapproving = mood === "disapprove";
  const blinkClass =
    mood === "idle" || mood === "curious" ? BLINK_CLASS : undefined;
  const pupils = pupilShift(mood, gaze);
  const happy = { opacity: disapproving ? 0 : 1 };
  const grumpy = { opacity: disapproving ? 1 : 0 };

  return (
    <svg
      data-testid="hospital-illustration"
      data-mood={mood}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 480 400"
      className={className}
    >
      {/* Pulse line and heart */}
      <polyline
        points="320,150 352,150 364,124 378,176 390,138 402,150 450,150"
        fill="none"
        stroke="var(--primary)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M400 92c-6-14-28-12-28 6 0 14 18 24 28 32 10-8 28-18 28-32 0-18-22-20-28-6Z"
        fill="var(--danger)"
      />

      {/* A new key on every failed submit replays the head shake. */}
      <g
        key={errorCount}
        className={disapproving ? "motion-safe:animate-head-shake" : undefined}
      >
        {/* Hospital building */}
        <rect x="110" y="60" width="150" height="300" fill="var(--primary)" />
        <rect
          x="160"
          y="80"
          width="50"
          height="50"
          rx="10"
          fill="var(--surface)"
        />
        <rect x="180" y="88" width="10" height="34" rx="2" fill="var(--danger)" />
        <rect
          x="168"
          y="100"
          width="34"
          height="10"
          rx="2"
          fill="var(--danger)"
        />
        <g className={blinkClass}>
          <circle cx="165" cy="160" r="7" fill="var(--surface)" />
          <circle cx="205" cy="160" r="7" fill="var(--surface)" />
          <g className={MOVE_CLASS} style={pupils}>
            <circle cx="165" cy="160" r="3" fill="var(--ink)" />
            <circle cx="205" cy="160" r="3" fill="var(--ink)" />
          </g>
        </g>
        <g
          fill="none"
          stroke="var(--ink)"
          strokeWidth={3}
          strokeLinecap="round"
        >
          <g className={MOVE_CLASS} style={grumpy}>
            <line x1="157" y1="147" x2="171" y2="151" />
            <line x1="199" y1="151" x2="213" y2="147" />
          </g>
          <path className={MOVE_CLASS} style={happy} d="M178 178q7 5 14 0" />
          <path className={MOVE_CLASS} style={grumpy} d="M178 182q7-5 14 0" />
        </g>
        <g fill="var(--surface)" opacity="0.3">
          <rect x="132" y="205" width="22" height="22" rx="3" />
          <rect x="174" y="205" width="22" height="22" rx="3" />
          <rect x="216" y="205" width="22" height="22" rx="3" />
        </g>

        {/* Clipboard */}
        <rect x="240" y="170" width="80" height="190" fill="var(--ink)" />
        <rect
          x="262"
          y="160"
          width="36"
          height="20"
          rx="6"
          fill="var(--line-strong)"
        />
        <g className={blinkClass}>
          <circle cx="264" cy="210" r="9" fill="var(--surface)" />
          <circle cx="296" cy="210" r="9" fill="var(--surface)" />
          <g className={MOVE_CLASS} style={pupils}>
            <circle cx="264" cy="210" r="4" fill="var(--ink)" />
            <circle cx="296" cy="210" r="4" fill="var(--ink)" />
          </g>
        </g>
        <g
          fill="none"
          stroke="var(--surface)"
          strokeWidth={3}
          strokeLinecap="round"
        >
          <g className={MOVE_CLASS} style={grumpy}>
            <line x1="255" y1="196" x2="270" y2="200" />
            <line x1="290" y1="200" x2="305" y2="196" />
          </g>
          <path className={MOVE_CLASS} style={happy} d="M272 232q8 5 16 0" />
          <path className={MOVE_CLASS} style={grumpy} d="M272 236q8-5 16 0" />
        </g>
        <g
          stroke="var(--surface)"
          strokeWidth={4}
          strokeLinecap="round"
          opacity="0.4"
        >
          <line x1="252" y1="255" x2="288" y2="255" />
          <line x1="252" y1="275" x2="288" y2="275" />
          <line x1="252" y1="295" x2="288" y2="295" />
        </g>

        {/* Capsule holding a thermometer */}
        <path d="M300 360V250a45 45 0 0 1 90 0v110Z" fill="var(--chart-4)" />
        <g className={MOVE_CLASS} style={pupils}>
          <circle cx="332" cy="248" r="4.5" fill="var(--ink)" />
        </g>
        <line
          className={MOVE_CLASS}
          style={grumpy}
          x1="325"
          y1="236"
          x2="339"
          y2="240"
          stroke="var(--ink)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1="360"
          y1="272"
          x2="424"
          y2="272"
          stroke="var(--ink)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <circle cx="428" cy="272" r="8" fill="var(--danger)" />

        {/* Smiling blob in front */}
        <path d="M60 360a115 115 0 0 1 230 0Z" fill="var(--accent)" />
        <g className={blinkClass}>
          <circle cx="148" cy="300" r="8" fill="var(--surface)" />
          <circle cx="202" cy="300" r="8" fill="var(--surface)" />
          <g className={MOVE_CLASS} style={pupils}>
            <circle cx="148" cy="300" r="3.5" fill="var(--ink)" />
            <circle cx="202" cy="300" r="3.5" fill="var(--ink)" />
          </g>
        </g>
        <g
          className={MOVE_CLASS}
          style={grumpy}
          stroke="var(--surface)"
          strokeWidth={3}
          strokeLinecap="round"
        >
          <line x1="139" y1="286" x2="155" y2="290" />
          <line x1="195" y1="290" x2="211" y2="286" />
        </g>
        <g fill="var(--surface)">
          <path
            className={MOVE_CLASS}
            style={happy}
            d="M162 316a13 13 0 0 0 26 0Z"
          />
          <path
            className={MOVE_CLASS}
            style={grumpy}
            d="M162 330a13 13 0 0 1 26 0Z"
          />
        </g>
      </g>

      {/* Ground */}
      <line
        x1="40"
        y1="360"
        x2="450"
        y2="360"
        stroke="var(--line-strong)"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
