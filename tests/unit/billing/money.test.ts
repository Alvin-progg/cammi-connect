import { describe, expect, it } from "vitest";

import { centavosToPesoInput, formatPesos, pesosToCentavos } from "@/lib/billing/money";

describe("pesosToCentavos (PAY-01: pesos in the UI, integer centavos in storage)", () => {
  it("converts whole and decimal peso amounts without floating-point error", () => {
    expect(pesosToCentavos("700")).toBe(70000);
    expect(pesosToCentavos(" 560.5 ")).toBe(56050);
    expect(pesosToCentavos("0.29")).toBe(29);
    expect(pesosToCentavos("1,120.00")).toBe(112000);
    expect(pesosToCentavos("0")).toBe(0);
    expect(pesosToCentavos("999999.99")).toBe(99999999);
  });

  it("returns null for anything that is not a peso amount", () => {
    for (const value of ["", "-5", "1.234", "abc", "1e3", "₱500", "1000000", "12.", ".5"]) {
      expect(pesosToCentavos(value), value).toBeNull();
    }
  });
});

describe("centavosToPesoInput", () => {
  it("shows centavos as a plain peso value for an input, and null as blank", () => {
    expect(centavosToPesoInput(70000)).toBe("700.00");
    expect(centavosToPesoInput(56050)).toBe("560.50");
    expect(centavosToPesoInput(29)).toBe("0.29");
    expect(centavosToPesoInput(null)).toBe("");
  });
});

describe("formatPesos", () => {
  it("formats centavos as pesos with grouping", () => {
    expect(formatPesos(150000)).toBe("₱1,500.00");
    expect(formatPesos(0)).toBe("₱0.00");
    expect(formatPesos(56000)).toBe("₱560.00");
    expect(formatPesos(1)).toBe("₱0.01");
    expect(formatPesos(99999999)).toBe("₱999,999.99");
  });
});
