import { describe, expect, it } from "vitest";

import {
  PRIVILEGE_DISCOUNT_BPS,
  computeCharge,
  payerChoiceSchema,
  privilegeChoiceSchema,
  type ChargeInput,
  type ChargeLineInput,
} from "@/lib/billing/compute";

function item(baseCentavos: number, overrides: Partial<ChargeLineInput> = {}): ChargeLineInput {
  return {
    baseCentavos,
    vatable: false,
    philhealthBenefitCentavos: 0,
    hmoCoverable: true,
    ...overrides,
  };
}

function charge(input: Partial<ChargeInput> & Pick<ChargeInput, "items">) {
  return computeCharge({ privilege: "none", payer: "self", hmoCopayCentavos: 0, ...input });
}

function expectAllIntegers(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isInteger(value), String(value)).toBe(true);
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) expectAllIntegers(nested);
  }
}

describe("computeCharge — PAY-001 worked examples", () => {
  it.each([
    {
      name: "Cardiology consult, no discount, self-pay",
      input: charge({ items: [item(70000)] }),
      expected: { vat: 0, privilege: 0, philhealth: 0, hmo: 0, due: 70000 },
    },
    {
      name: "Cardiology consult, senior, self-pay",
      input: charge({ items: [item(70000)], privilege: "senior" }),
      expected: { vat: 0, privilege: 14000, philhealth: 0, hmo: 0, due: 56000 },
    },
    {
      name: "VAT-able ₱1,120 fee, PWD, self-pay",
      input: charge({ items: [item(112000, { vatable: true })], privilege: "pwd" }),
      expected: { vat: 12000, privilege: 20000, philhealth: 0, hmo: 0, due: 80000 },
    },
    {
      name: "Ultrasound ₱1,500 with ₱500 PhilHealth benefit, senior",
      input: charge({
        items: [item(150000, { philhealthBenefitCentavos: 50000 })],
        privilege: "senior",
        payer: "philhealth",
      }),
      expected: { vat: 0, privilege: 30000, philhealth: 50000, hmo: 0, due: 70000 },
    },
    {
      name: "IM consult, HMO full coverage",
      input: charge({ items: [item(50000)], payer: "hmo" }),
      expected: { vat: 0, privilege: 0, philhealth: 0, hmo: 50000, due: 0 },
    },
  ])("$name", ({ input, expected }) => {
    expect(input.totals).toEqual({
      baseCentavos: input.items[0].baseCentavos,
      vatExemptionCentavos: expected.vat,
      privilegeDiscountCentavos: expected.privilege,
      philhealthCentavos: expected.philhealth,
      hmoCentavos: expected.hmo,
      amountDueCentavos: expected.due,
    });
  });
});

describe("computeCharge — pricing doc discount examples", () => {
  it("senior, Internal Medicine consult ₱500 → ₱400", () => {
    const result = charge({ items: [item(50000)], privilege: "senior" });
    expect(result.totals.privilegeDiscountCentavos).toBe(10000);
    expect(result.totals.amountDueCentavos).toBe(40000);
  });

  it("PWD, CBC + urinalysis + FBS ₱520 as three line items → ₱416", () => {
    const result = charge({ items: [item(25000), item(12000), item(15000)], privilege: "pwd" });
    expect(result.items.map((line) => line.privilegeDiscountCentavos)).toEqual([5000, 2400, 3000]);
    expect(result.items.map((line) => line.amountDueCentavos)).toEqual([20000, 9600, 12000]);
    expect(result.totals.baseCentavos).toBe(52000);
    expect(result.totals.privilegeDiscountCentavos).toBe(10400);
    expect(result.totals.amountDueCentavos).toBe(41600);
  });

  it("senior, whole abdomen ultrasound ₱1,500 with ₱500 PhilHealth → ₱700", () => {
    const result = charge({
      items: [item(150000, { philhealthBenefitCentavos: 50000 })],
      privilege: "senior",
      payer: "philhealth",
    });
    expect(result.totals.amountDueCentavos).toBe(70000);
  });

  it("HMO member, Cardiology consult ₱700 → ₱0", () => {
    const result = charge({ items: [item(70000)], payer: "hmo" });
    expect(result.totals.hmoCentavos).toBe(70000);
    expect(result.totals.amountDueCentavos).toBe(0);
  });
});

describe("computeCharge — order and rules", () => {
  it("applies the 20% after the VAT exemption, not on the VAT-inclusive price", () => {
    const [line] = charge({ items: [item(112000, { vatable: true })], privilege: "senior" }).items;
    // 20% of 1,120.00 would be 224.00; the law takes it from 1,000.00.
    expect(line.privilegeDiscountCentavos).toBe(20000);
  });

  it("gives no VAT exemption without a privilege, even on a VAT-able item", () => {
    const [line] = charge({ items: [item(112000, { vatable: true })] }).items;
    expect(line.vatExemptionCentavos).toBe(0);
    expect(line.amountDueCentavos).toBe(112000);
  });

  it("gives no VAT exemption on a non-VAT-able item, even with a privilege", () => {
    const [line] = charge({ items: [item(112000)], privilege: "pwd" }).items;
    expect(line.vatExemptionCentavos).toBe(0);
    expect(line.privilegeDiscountCentavos).toBe(22400);
  });

  it("uses the 20% rate from basis points", () => {
    expect(PRIVILEGE_DISCOUNT_BPS).toBe(2000);
  });

  it("ignores the PhilHealth benefit unless PhilHealth is the payer", () => {
    const result = charge({ items: [item(150000, { philhealthBenefitCentavos: 50000 })] });
    expect(result.totals.philhealthCentavos).toBe(0);
    expect(result.totals.amountDueCentavos).toBe(150000);
  });

  it("clamps a PhilHealth benefit larger than what is left; never negative", () => {
    const [line] = charge({
      items: [item(50000, { philhealthBenefitCentavos: 90000 })],
      privilege: "senior",
      payer: "philhealth",
    }).items;
    expect(line.philhealthCentavos).toBe(40000);
    expect(line.amountDueCentavos).toBe(0);
  });

  it("leaves an item that is not HMO-coverable for the patient to pay", () => {
    const result = charge({
      items: [item(50000), item(30000, { hmoCoverable: false })],
      payer: "hmo",
    });
    expect(result.items.map((line) => line.hmoCentavos)).toEqual([50000, 0]);
    expect(result.totals.amountDueCentavos).toBe(30000);
  });

  it("charges the HMO co-pay once per booking, from the first coverable items", () => {
    const result = charge({
      items: [item(5000, { hmoCoverable: false }), item(10000), item(20000)],
      payer: "hmo",
      hmoCopayCentavos: 15000,
    });
    // 10,000 of the co-pay sits on the first coverable item, the other 5,000 on the next.
    expect(result.items.map((line) => line.hmoCentavos)).toEqual([0, 0, 15000]);
    expect(result.items.map((line) => line.amountDueCentavos)).toEqual([5000, 10000, 5000]);
    expect(result.totals.amountDueCentavos).toBe(20000);
  });

  it("never lets a co-pay larger than the coverable total make the HMO share negative", () => {
    const result = charge({ items: [item(30000)], payer: "hmo", hmoCopayCentavos: 50000 });
    expect(result.totals.hmoCentavos).toBe(0);
    expect(result.totals.amountDueCentavos).toBe(30000);
  });

  it("handles a zero price", () => {
    const result = charge({
      items: [item(0, { vatable: true, philhealthBenefitCentavos: 50000 })],
      privilege: "senior",
      payer: "philhealth",
    });
    expect(result.totals).toEqual({
      baseCentavos: 0,
      vatExemptionCentavos: 0,
      privilegeDiscountCentavos: 0,
      philhealthCentavos: 0,
      hmoCentavos: 0,
      amountDueCentavos: 0,
    });
  });

  it("handles a booking with no items", () => {
    expect(charge({ items: [] }).totals.amountDueCentavos).toBe(0);
  });

  it("refuses a non-integer or negative amount", () => {
    expect(() => charge({ items: [item(100.5)] })).toThrow();
    expect(() => charge({ items: [item(-1)] })).toThrow();
    expect(() => charge({ items: [item(100, { philhealthBenefitCentavos: 0.1 })] })).toThrow();
    expect(() => charge({ items: [item(100)], payer: "hmo", hmoCopayCentavos: -5 })).toThrow();
  });
});

describe("computeCharge — rounding (half-up, integer math)", () => {
  it("rounds the VAT-exclusive price half-up: 0.14 / 1.12 = 0.125 → 0.13", () => {
    const [line] = charge({ items: [item(14, { vatable: true })], privilege: "senior" }).items;
    expect(line.vatExemptionCentavos).toBe(1);
    // 20% of 0.13 = 0.026 → 0.03
    expect(line.privilegeDiscountCentavos).toBe(3);
    expect(line.amountDueCentavos).toBe(10);
  });

  it("rounds just below the half down: 0.13 / 1.12 = 0.116 → 0.12", () => {
    const [line] = charge({ items: [item(13, { vatable: true })], privilege: "pwd" }).items;
    expect(line.vatExemptionCentavos).toBe(1);
  });

  it("rounds the 20% half-up and down at the centavo", () => {
    // 20% of 0.07 = 0.014 → 0.01; 20% of 0.08 = 0.016 → 0.02
    expect(charge({ items: [item(7)], privilege: "senior" }).items[0].privilegeDiscountCentavos).toBe(1);
    expect(charge({ items: [item(8)], privilege: "senior" }).items[0].privilegeDiscountCentavos).toBe(2);
  });

  it("never leaks a float, for any price and choice", () => {
    for (let base = 0; base <= 2000; base += 7) {
      for (const privilege of ["none", "senior", "pwd"] as const) {
        for (const payer of ["self", "hmo", "philhealth"] as const) {
          const result = charge({
            items: [item(base, { vatable: true, philhealthBenefitCentavos: 333 }), item(base * 3 + 1)],
            privilege,
            payer,
            hmoCopayCentavos: 499,
          });
          expectAllIntegers(result);
          for (const line of result.items) {
            expect(
              line.vatExemptionCentavos +
                line.privilegeDiscountCentavos +
                line.philhealthCentavos +
                line.hmoCentavos +
                line.amountDueCentavos,
            ).toBe(line.baseCentavos);
            expect(line.amountDueCentavos).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe("privilege and payer choices", () => {
  it("accepts exactly one privilege: none, senior, or pwd", () => {
    expect(privilegeChoiceSchema.options).toEqual(["none", "senior", "pwd"]);
    expect(privilegeChoiceSchema.safeParse("senior_pwd").success).toBe(false);
    expect(privilegeChoiceSchema.safeParse(["senior", "pwd"]).success).toBe(false);
  });

  it("accepts self, hmo, or philhealth as payer", () => {
    expect(payerChoiceSchema.options).toEqual(["self", "hmo", "philhealth"]);
    expect(payerChoiceSchema.safeParse("cash").success).toBe(false);
  });
});
