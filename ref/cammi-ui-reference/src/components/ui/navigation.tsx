import { Search } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/** shadcn Tabs: muted track, white active trigger. Controlled or self-managed. */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  label,
  className,
}: {
  items: { value: string; label: ReactNode; count?: number }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value);
  const current = value ?? inner;
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex flex-wrap gap-0.5 self-start rounded-lg bg-surface-muted p-[3px]", className)}>
      {items.map((item) => {
        const selected = item.value === current;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              setInner(item.value);
              onValueChange?.(item.value);
            }}
            className={cn(
              "focus-ring inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
              selected ? "border-line bg-surface text-ink shadow-soft" : "border-transparent text-ink-secondary hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className={cn("rounded px-1.5 text-xs tabular-nums", selected ? "bg-surface-muted text-ink-secondary" : "bg-surface text-ink-muted")}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control (shadcn ToggleGroup) for filters like period or role. */
export function Segmented({ options, defaultValue, label }: { options: string[]; defaultValue?: string; label: string }) {
  const [value, setValue] = useState(defaultValue ?? options[0]);
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg bg-surface-muted p-[3px]">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => setValue(option)}
          className={cn(
            "focus-ring h-8 rounded-md px-3 text-sm transition-colors",
            option === value ? "bg-surface font-medium text-ink shadow-soft" : "text-ink-secondary hover:text-ink",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ label, className, shortcut, ...props }: ComponentProps<"input"> & { label: string; shortcut?: string }) {
  return (
    <label className={cn("flex h-9 min-w-60 items-center gap-2 rounded-md border border-control-line bg-surface px-3 text-ink-muted shadow-soft focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/25", className)}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="size-4 shrink-0" />
      <input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted" {...props} />
      {shortcut ? <kbd className="rounded border border-line-strong px-1.5 font-mono text-[11px] text-ink-secondary">{shortcut}</kbd> : null}
    </label>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-ink" : undefined}>
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="focus-ring rounded hover:text-ink">
                  {item.label}
                </a>
              )}
              {last ? null : <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Row of filters above a table or chart grid. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
