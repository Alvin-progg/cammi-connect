import { BadgeCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** Shows only the benefits the front desk has verified; unverified ones stay hidden. */
export function VerifiedBenefitBadges({
  pwdVerified,
  hmoVerified,
}: {
  pwdVerified: boolean;
  hmoVerified: boolean;
}) {
  if (!pwdVerified && !hmoVerified) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {pwdVerified ? (
        <Badge tone="success">
          <BadgeCheck aria-hidden="true" />
          PWD verified
        </Badge>
      ) : null}
      {hmoVerified ? (
        <Badge tone="success">
          <BadgeCheck aria-hidden="true" />
          HMO verified
        </Badge>
      ) : null}
    </div>
  );
}
