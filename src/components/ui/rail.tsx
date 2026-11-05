import type { ReactNode } from "react";

/** Shared look of the workspace navigation rails (doctor and admin). */
export const RAIL_ITEM_BASE =
  "group focus-ring relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-snappy active:scale-[0.97] motion-reduce:transition-none";

/** Label shown inline when expanded, or as a hover/focus tooltip when collapsed. */
export function RailLabel({ expanded, children }: { expanded: boolean; children: ReactNode }) {
  if (expanded) {
    return <span className="truncate">{children}</span>;
  }
  return (
    <>
      <span className="sr-only">{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 origin-left -translate-y-1/2 scale-[0.97] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 transition-[opacity,transform] duration-150 ease-snappy group-focus-visible:scale-100 group-focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-100 [@media(hover:hover)]:group-hover:opacity-100"
      >
        {children}
      </span>
    </>
  );
}

/** Two-letter initials for a rail's profile avatar. */
export function initialsOf(name: string, fallback: string): string {
  const parts = name
    .replace(/^Dr\.\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || fallback;
}
