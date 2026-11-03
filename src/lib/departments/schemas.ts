import { z } from "zod";

import { optionalDescription } from "@/lib/directory/schemas";

/**
 * Department name, code, and description. Activation is a separate audited
 * action (it can be refused), so it is not part of this form.
 */
export const departmentFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a department name.")
    .max(100, "Keep the name under 100 characters."),
  code: z
    .string()
    .trim()
    .min(1, "Enter a short department code.")
    .max(10, "Keep the code to 10 characters or fewer.")
    .transform((code) => code.toUpperCase()),
  description: optionalDescription,
});

export type DepartmentFormInput = z.infer<typeof departmentFormSchema>;
