"use client";

/*
 * Adapted from React Bits "CountUp" (https://reactbits.dev, count mode only).
 * Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0:
 * permission is granted to use, copy, modify, merge, publish, and distribute
 * the Software as part of an application, website, or product, provided this
 * notice is included; the components themselves may not be sold, sublicensed,
 * or redistributed. The Software is provided "as is", without warranty.
 */

import { animate } from "motion/react";
import { useLayoutEffect, useRef } from "react";

const NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>();

function formatNumber(value: number, decimals: number, suffix: string): string {
  let formatter = NUMBER_FORMATTERS.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    NUMBER_FORMATTERS.set(decimals, formatter);
  }
  return `${formatter.format(value)}${suffix}`;
}

/**
 * Counts from 0 up to a measured value once, on mount. The server render and
 * the screen-reader text are always the final value, so the number is right
 * without JavaScript and under `prefers-reduced-motion`.
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  durationSeconds = 0.9,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  durationSeconds?: number;
  className?: string;
}) {
  const visibleRef = useRef<HTMLSpanElement>(null);
  const finalText = formatNumber(value, decimals, suffix);

  useLayoutEffect(() => {
    const node = visibleRef.current;
    if (!node) {
      return undefined;
    }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduceMotion || value === 0) {
      node.textContent = finalText;
      return undefined;
    }

    const controls = animate(0, value, {
      duration: durationSeconds,
      ease: [0.33, 1, 0.68, 1],
      onUpdate: (latest) => {
        node.textContent = formatNumber(latest, decimals, suffix);
      },
      onComplete: () => {
        node.textContent = finalText;
      },
    });
    return () => {
      controls.stop();
      node.textContent = finalText;
    };
  }, [value, decimals, suffix, durationSeconds, finalText]);

  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      <span ref={visibleRef} aria-hidden="true">
        {finalText}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
