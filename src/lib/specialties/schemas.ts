import { z } from "zod";

import { optionalDescription } from "@/lib/directory/schemas";

/**
 * Specialty name and description. Activation is a separate audited action,
 * so it is not part of this form.
 */
export const specialtyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a specialty name.")
    .max(100, "Keep the name under 100 characters."),
  description: optionalDescription,
});

export type SpecialtyFormInput = z.infer<typeof specialtyFormSchema>;
