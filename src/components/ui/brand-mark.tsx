import Image from "next/image";

import { cn } from "@/lib/cn";

/**
 * The CamiConnect "C wreath" mark. Uses the pack's `-small` variant, which the
 * logo README recommends for 32–48px, the size of every brand slot in the app.
 * Decorative: the adjacent "CamiConnect" text or link label names it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo/svg/cami-f-mark-color-small.svg"
      alt=""
      width={32}
      height={32}
      className={cn("shrink-0", className)}
    />
  );
}
