"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ComponentProps, PointerEvent, ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Landing-page motion (design.md 0.1.2: React Bits effects, landing only).
 * Every effect plays once, nothing loops or autoplays, and under
 * prefers-reduced-motion each one renders its final state.
 */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Blur Text: the headline resolves word by word, once on load (~600 ms). */
export function BlurText({ segments }: { segments: { text: string; className?: string }[] }) {
  const reduced = useReducedMotion();
  const words = segments.flatMap((segment) =>
    segment.text.split(" ").filter(Boolean).map((word) => ({ word, className: segment.className })),
  );
  if (reduced) {
    return (
      <>
        {words.map((item, index) => (
          <span key={index} className={item.className}>
            {index > 0 ? " " : null}
            {item.word}
          </span>
        ))}
      </>
    );
  }
  // Word durations overlap so the whole line settles in about 600 ms.
  const step = words.length > 1 ? 0.3 / (words.length - 1) : 0;
  return (
    <>
      {words.map((item, index) => (
        <span key={index}>
          {index > 0 ? " " : null}
          <motion.span
            className={cn("inline-block", item.className)}
            initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.3, delay: index * step, ease: EASE_OUT }}
          >
            {item.word}
          </motion.span>
        </span>
      ))}
    </>
  );
}

/** Fade Content on load: rises 16 px and fades in once, after `delay` seconds. */
export function FadeIn({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/**
 * Fade Content on first scroll into view: children (`RevealItem`) rise in
 * order, `stagger` seconds apart, once.
 */
export function RevealGroup({
  as = "div",
  stagger,
  className,
  children,
}: {
  as?: "div" | "ol";
  stagger: number;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const Tag = as === "ol" ? motion.ol : motion.div;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.2 }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </Tag>
  );
}

type RevealItemProps = {
  className?: string;
  children?: ReactNode;
  role?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

/** One tile in a `RevealGroup` (div). */
export function RevealItem(props: RevealItemProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div {...props} />;
  return <motion.div variants={ITEM_VARIANTS} {...props} />;
}

/** One list item in an `<ol>` `RevealGroup`. */
export function RevealListItem(props: RevealItemProps) {
  const reduced = useReducedMotion();
  if (reduced) return <li {...props} />;
  return <motion.li variants={ITEM_VARIANTS} {...props} />;
}

/**
 * Spotlight Card: a soft blue light follows the pointer, on hover only. The
 * light is a static gradient positioned by CSS variables; nothing animates on
 * its own.
 */
export function SpotlightCard({ className, children, ...props }: ComponentProps<"article">) {
  const reduced = useReducedMotion();
  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
  }
  return (
    <article
      className={cn("group/spot relative", className)}
      onPointerMove={reduced ? undefined : moveSpotlight}
      {...props}
    >
      {reduced ? null : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{
            background:
              "radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgb(26 98 242 / 0.12), transparent 70%)",
          }}
        />
      )}
      {children}
    </article>
  );
}
