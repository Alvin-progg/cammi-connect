import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Redesigned Button. Keeps the repo's variant names (primary, secondary,
 * ghost, danger, outlineDanger) and adds `outline` (shadcn's neutral
 * outline). Sizes: `sm` (36px) for dense staff screens, `md` (44px, the
 * default and the patient-facing minimum), `lg` (44px, wider padding).
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

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonVariantProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** An <a> styled as a button (the repo uses next/link here). */
export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"a"> & ButtonVariantProps) {
  return <a className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
