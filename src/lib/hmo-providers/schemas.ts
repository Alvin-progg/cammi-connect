import { z } from "zod";

import { pesoFieldOrZero } from "@/lib/billing/money";
import { blankToNull } from "@/lib/directory/schemas";

/** The admin HMO provider form. Activation is a separate audited action. */
export const hmoProviderFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the HMO name.")
    .max(100, "Keep the name under 100 characters."),
  copayCentavos: pesoFieldOrZero("Enter the co-pay in pesos, like 100 or 100.50."),
  notes: z.preprocess(
    blankToNull,
    z.string().trim().max(500, "Keep the notes under 500 characters.").nullable().default(null),
  ),
});

export type HmoProviderFormInput = z.infer<typeof hmoProviderFormSchema>;
