import { z } from "zod";

import type { ChargeLineInput } from "./compute";

/**
 * PAY-06 HMO and PhilHealth rules. The 0037 SQL function enforces the same
 * decision rules; these drive the chat payer step and the front desk forms.
 */

/**
 * "••••4417". Member numbers are shown in full only on the front desk
 * request details; everywhere else (chat, queue, admin) they are masked.
 */
export function maskMemberNumber(memberNumber: string): string {
  return `••••${memberNumber.slice(-4)}`;
}

/** PhilHealth is a payer choice only when a chosen item has a benefit above ₱0. */
export function philhealthOffered(lines: readonly ChargeLineInput[]): boolean {
  return lines.some((line) => line.philhealthBenefitCentavos > 0);
}

/** The HMO section of the front desk payment panel. */
export type FrontDeskHmo = {
  providerName: string;
  /** In full: only the front desk request details may show it. */
  memberNumber: string;
  loaNumber: string | null;
  deniedReason: string | null;
};

const ids = {
  paymentId: z.uuid("Invalid payment reference."),
  appointmentId: z.uuid("Invalid appointment reference."),
};

export const hmoDecisionSchema = z.discriminatedUnion(
  "decision",
  [
    z.object({
      decision: z.literal("approve"),
      ...ids,
      loaNumber: z
        .string("Enter the LOA number from the HMO.")
        .trim()
        .min(1, "Enter the LOA number from the HMO.")
        .max(100, "Keep the LOA number under 100 characters."),
    }),
    z.object({
      decision: z.literal("deny"),
      ...ids,
      reason: z
        .string("Write the reason the HMO denied coverage.")
        .trim()
        .min(1, "Write the reason the HMO denied coverage.")
        .max(500, "Keep the reason under 500 characters."),
    }),
  ],
  "Choose approve or deny.",
);

export type HmoDecision = z.infer<typeof hmoDecisionSchema>;
