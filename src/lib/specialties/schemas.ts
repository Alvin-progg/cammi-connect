import { z } from "zod";

import { blankToNull, optionalDescription } from "@/lib/directory/schemas";

/** Matches the specialties.routing_hints check in 0032. */
export const ROUTING_HINTS_MAX_LENGTH = 1000;

/**
 * Specialty name, description, and routing hints (AI-APT-002). Activation is
 * a separate audited action, so it is not part of this form.
 */
export const specialtyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a specialty name.")
    .max(100, "Keep the name under 100 characters."),
  description: optionalDescription,
  routingHints: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(ROUTING_HINTS_MAX_LENGTH, "Keep the routing hints under 1,000 characters.")
      .nullable()
      .default(null),
  ),
});

export type SpecialtyFormInput = z.infer<typeof specialtyFormSchema>;
