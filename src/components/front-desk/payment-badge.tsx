import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/billing/payments";
import { paymentBadge } from "@/lib/billing/verification";

/** PAY-05 payment badge for front desk views; nothing when there is no payment row. */
export function PaymentBadge({
  payment,
  now,
}: {
  payment: { status: PaymentStatus; deadline: string | null } | null | undefined;
  now: Date;
}) {
  if (!payment) return null;
  const badge = paymentBadge(payment, now);
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}
