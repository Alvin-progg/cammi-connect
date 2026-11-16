import { z } from "zod";

/**
 * PAY-001 discount and coverage math. Pure and isomorphic; every amount is an
 * integer number of centavos and every division is integer division with
 * half-up rounding, so no float ever reaches a stored or shown amount.
 */

/** Senior citizen (RA 9994) and PWD (RA 10754) discount: 20%, fixed by law. */
export const PRIVILEGE_DISCOUNT_BPS = 2000;

/** One privilege per booking: a patient who is both uses one ID only. */
export const privilegeChoiceSchema = z.enum(["none", "senior", "pwd"]);
export type PrivilegeChoice = z.infer<typeof privilegeChoiceSchema>;

/** Who pays. HMO and PhilHealth are payers, not discounts. */
export const payerChoiceSchema = z.enum(["self", "hmo", "philhealth"]);
export type PayerChoice = z.infer<typeof payerChoiceSchema>;

export type ChargeLineInput = {
  /** Snapshotted price; VAT-inclusive when `vatable`. */
  baseCentavos: number;
  vatable: boolean;
  philhealthBenefitCentavos: number;
  hmoCoverable: boolean;
};

export type ChargeInput = {
  items: ChargeLineInput[];
  privilege: PrivilegeChoice;
  payer: PayerChoice;
  /** The chosen HMO's co-pay; ignored unless the payer is `hmo`. */
  hmoCopayCentavos: number;
};

export type ChargeAmounts = {
  baseCentavos: number;
  vatExemptionCentavos: number;
  privilegeDiscountCentavos: number;
  philhealthCentavos: number;
  hmoCentavos: number;
  amountDueCentavos: number;
};

export type ChargeBreakdown = {
  items: ChargeAmounts[];
  totals: ChargeAmounts;
};

/** round(numerator / denominator), half-up, for non-negative integers. */
function divideRoundHalfUp(numerator: number, denominator: number): number {
  const doubled = 2 * numerator + denominator;
  const divisor = 2 * denominator;
  return (doubled - (doubled % divisor)) / divisor;
}

function assertCentavos(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative integer number of centavos`);
  }
}

/**
 * Deductions per line item, in the order PhilHealth and the Court of Appeals
 * require: VAT exemption → 20% senior/PWD → PhilHealth → HMO; the rest is due.
 */
export function computeCharge(input: ChargeInput): ChargeBreakdown {
  assertCentavos(input.hmoCopayCentavos, "hmoCopayCentavos");
  const hasPrivilege = input.privilege !== "none";
  // The co-pay is charged once per booking: it stays with the patient on the
  // first HMO-coverable items until used up, and the HMO pays the rest.
  let copayLeft = input.payer === "hmo" ? input.hmoCopayCentavos : 0;

  const items = input.items.map((line): ChargeAmounts => {
    assertCentavos(line.baseCentavos, "baseCentavos");
    assertCentavos(line.philhealthBenefitCentavos, "philhealthBenefitCentavos");
    const base = line.baseCentavos;

    // base − round(base / 1.12), as round(base × 100 / 112).
    const vatExemption =
      hasPrivilege && line.vatable ? base - divideRoundHalfUp(base * 100, 112) : 0;
    const privilegeDiscount = hasPrivilege
      ? divideRoundHalfUp((base - vatExemption) * PRIVILEGE_DISCOUNT_BPS, 10000)
      : 0;
    let remaining = base - vatExemption - privilegeDiscount;

    const philhealth =
      input.payer === "philhealth" ? Math.min(line.philhealthBenefitCentavos, remaining) : 0;
    remaining -= philhealth;

    let hmo = 0;
    if (input.payer === "hmo" && line.hmoCoverable) {
      const copayHere = Math.min(copayLeft, remaining);
      copayLeft -= copayHere;
      hmo = remaining - copayHere;
      remaining = copayHere;
    }

    return {
      baseCentavos: base,
      vatExemptionCentavos: vatExemption,
      privilegeDiscountCentavos: privilegeDiscount,
      philhealthCentavos: philhealth,
      hmoCentavos: hmo,
      amountDueCentavos: remaining,
    };
  });

  const totals = items.reduce(
    (sum, line) => ({
      baseCentavos: sum.baseCentavos + line.baseCentavos,
      vatExemptionCentavos: sum.vatExemptionCentavos + line.vatExemptionCentavos,
      privilegeDiscountCentavos: sum.privilegeDiscountCentavos + line.privilegeDiscountCentavos,
      philhealthCentavos: sum.philhealthCentavos + line.philhealthCentavos,
      hmoCentavos: sum.hmoCentavos + line.hmoCentavos,
      amountDueCentavos: sum.amountDueCentavos + line.amountDueCentavos,
    }),
    {
      baseCentavos: 0,
      vatExemptionCentavos: 0,
      privilegeDiscountCentavos: 0,
      philhealthCentavos: 0,
      hmoCentavos: 0,
      amountDueCentavos: 0,
    },
  );

  return { items, totals };
}
