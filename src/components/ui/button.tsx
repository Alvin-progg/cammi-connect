import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

/**
 * Button styles from design.md §5.1. Exported separately so a link-button or
 * a control rendered by a primitive (a dialog trigger, for example) can share
 * the same classes without nesting a <button>.
 */
export const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-medium pressable disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-ink hover:bg-primary-hover",
        secondary: "border-line-strong bg-surface text-primary hover:bg-primary-soft",
        ghost: "border-transparent bg-transparent text-ink hover:bg-surface-muted",
        danger: "border-danger bg-danger text-danger-ink hover:bg-danger-hover",
        // The trigger for a destructive action; the confirming button inside
        // the dialog uses `danger` (design.md §5.1 rules).
        outlineDanger: "border-line-strong bg-surface text-danger hover:bg-danger-soft",
      },
      size: {
        // Both sizes keep the 44px target; `sm` only narrows the padding for
        // dense rows such as the attendance actions.
        sm: "min-h-11 px-3",
        md: "min-h-11 px-4",
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
  return (
    <button type={type} className={buttonVariants({ variant, size, className })} {...props} />
  );
}
