"use client";

import { nursePose } from "@/lib/auth/mascot-mood";
import { cn } from "@/lib/cn";

import { Mascot } from "./mascot";
import { useMascot } from "./mascot-stage";

/** The auth-page nurse, posed by the shared mascot mood. */
export function NurseMascot({ size = 112, className }: { size?: number; className?: string }) {
  const { mood } = useMascot();
  const { lookAt, expression } = nursePose(mood);

  return (
    <Mascot
      directions="/mascots/nurse-directions.webp"
      reactions="/mascots/nurse-reactions.webp"
      size={size}
      label="nurse"
      lookAt={lookAt}
      expression={expression}
      className={cn("focus-ring", className)}
    />
  );
}
