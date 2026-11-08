"use client";

import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ComponentProps, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Landing-page motion (design.md 0.1.2: React Bits effects, landing only).
 * Nothing loops or autoplays: entrance effects play once and scroll-linked
 * effects (ScrollHeader, HeroParallax, ScrollProgressLine) only move while the
 * visitor scrolls. Under prefers-reduced-motion each one renders its final state.
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

const HOVER_LIFT = { y: -3, transition: { duration: 0.2, ease: EASE_OUT } };

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
  return <motion.div variants={ITEM_VARIANTS} whileHover={HOVER_LIFT} {...props} />;
}

/** One list item in an `<ol>` `RevealGroup`. */
export function RevealListItem(props: RevealItemProps) {
  const reduced = useReducedMotion();
  if (reduced) return <li {...props} />;
  return <motion.li variants={ITEM_VARIANTS} whileHover={HOVER_LIFT} {...props} />;
}

/**
 * Content inside a `RevealItem` that appears `delay` seconds after its tile,
 * once (e.g. a chat reply after the question). Follows the group's variants.
 */
export function RevealDelayed({ delay, className, children }: { delay: number; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8, scale: 0.96 },
        shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, delay, ease: EASE_OUT } },
      }}
    >
      {children}
    </motion.div>
  );
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

const SCROLLED_AFTER_PX = 8;

/** Sticky header that gains a soft shadow (via `data-scrolled`) once the page scrolls. */
export function ScrollHeader({ className, children }: { className?: string; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function updateScrolled() {
      setScrolled(window.scrollY > SCROLLED_AFTER_PX);
    }
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);
  return (
    <header className={className} data-scrolled={scrolled}>
      {children}
    </header>
  );
}

/** Hero mockup drifts up 24 px while it crosses the viewport. */
export function HeroParallax({ className, children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -24]);
  if (reduced) return <div ref={ref} className={className}>{children}</div>;
  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}

/** Wraps the steps list; a baseline fills left to right as it scrolls through (md and up). */
export function ScrollProgressLine({ className, children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const fillClassName = "absolute inset-0 origin-left bg-primary";
  return (
    <div ref={ref} className={cn("relative", className)}>
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-4 hidden h-0.5 bg-line md:block">
        {reduced ? (
          <div data-testid="progress-line-fill" className={fillClassName} style={{ transform: "none" }} />
        ) : (
          <motion.div data-testid="progress-line-fill" className={fillClassName} style={{ scaleX: scrollYProgress }} />
        )}
      </div>
    </div>
  );
}
