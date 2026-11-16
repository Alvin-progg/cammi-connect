import { z } from "zod";

/**
 * Money is stored as integer centavos (PAY-001: ₱560.00 = 56000); admins type
 * pesos. Parsing works on the digits as text, so no float is ever involved.
 * Amounts stop at ₱999,999.99, well inside a Postgres integer.
 */
const PESO_AMOUNT = /^(\d{1,6})(?:\.(\d{1,2}))?$/;

/** "1,500.50" → 150050; null for anything that is not a non-negative peso amount. */
export function pesosToCentavos(text: string): number | null {
  const match = PESO_AMOUNT.exec(text.trim().replaceAll(",", ""));
  if (!match) {
    return null;
  }
  const [, pesos, centavos = ""] = match;
  return Number(pesos) * 100 + Number(centavos.padEnd(2, "0"));
}

/** 150050 → "1500.50", the value an admin edits; null → "". */
export function centavosToPesoInput(centavos: number | null): string {
  if (centavos === null) {
    return "";
  }
  return `${Math.trunc(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

const PESO_FORMAT = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

/** 150050 → "₱1,500.50". */
export function formatPesos(centavos: number): string {
  return PESO_FORMAT.format(centavos / 100);
}

/**
 * An optional peso form field read as centavos: blank is null, and text that
 * is not a peso amount fails with `message`.
 */
export function optionalPesoField(message: string) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value !== "string") return value;
      if (value.trim() === "") return null;
      return pesosToCentavos(value) ?? value;
    },
    z.number(message).int(message).min(0, message).nullable().default(null),
  );
}

/** Like `optionalPesoField`, but blank means ₱0 (a benefit or co-pay of none). */
export function pesoFieldOrZero(message: string) {
  return optionalPesoField(message).transform((centavos) => centavos ?? 0);
}
