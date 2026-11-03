"use client";

import { nursePose } from "@/lib/auth/mascot-mood";

import { Mascot } from "./mascot";
import { useMascot } from "./mascot-stage";

/** The nurse above the auth heading, posed by the shared mascot mood. */
export function NurseMascot() {
  const { mood } = useMascot();
  const { lookAt, expression } = nursePose(mood);

  return (
    <Mascot
      directions="/mascots/nurse-directions.webp"
      reactions="/mascots/nurse-reactions.webp"
      size={112}
      label="nurse"
      lookAt={lookAt}
      expression={expression}
      className="focus-ring mx-auto rounded-full"
    />
  );
}
