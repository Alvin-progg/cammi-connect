import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Button styles from design.md §5.1. Exported separately so a link-button or
 * a control rendered by a primitive (a dialog trigger, for example) can share
 * the same classes without nesting a <button>.
 *
 * Sizes: `sm` (36px) for dense staff screens, `md` (44px, the default and the
 * patient-facing minimum), `lg` (44px, wider padding), `icon` (40px square).
 */
export const buttonVariants = cva(
  "focus-ring pressable inline-flex items-center justify-center gap-2 whitespace-nowrap border text-sm font-medium disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-ink shadow-soft hover:bg-primary-hover",
        secondary: "border-line-strong bg-surface text-primary shadow-soft hover:bg-primary-soft",
        outline: "border-line-strong bg-surface text-ink shadow-soft hover:bg-surface-muted",
        ghost: "border-transparent bg-transparent text-ink hover:bg-surface-muted",
        danger: "border-danger bg-danger text-danger-ink shadow-soft hover:bg-danger-hover",
        // The trigger for a destructive action; the confirming button inside
        // the dialog uses `danger` (design.md §5.1 rules).
        outlineDanger: "border-line-strong bg-surface text-danger shadow-soft hover:bg-danger-soft",
        link: "border-transparent bg-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-md px-3",
        md: "min-h-11 rounded-lg px-4",
        lg: "min-h-11 rounded-lg px-6",
        icon: "size-10 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

/** A <button> with design.md variants. Defaults to `type="button"`. */
export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonVariantProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** A next/link styled as a button. */
export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonVariantProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
