import { z } from "zod";

import { optionalDescription } from "@/lib/directory/schemas";

import { REQUIREMENT_TARGET_KINDS } from "./types";

const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const TARGET_MESSAGE = "Choose a service or specialty.";

/** The "Applies to" select value, "service:<uuid>" or "specialty:<uuid>". */
const requirementTarget = z
  .string(TARGET_MESSAGE)
  .transform((value, context) => {
    const [kind, id, ...rest] = value.split(":");
    const parsedKind = z.enum(REQUIREMENT_TARGET_KINDS).safeParse(kind);
    const parsedId = z.uuid().safeParse(id);
    if (rest.length > 0 || !parsedKind.success || !parsedId.success) {
      context.addIssue({ code: "custom", message: TARGET_MESSAGE });
      return z.NEVER;
    }
    return { kind: parsedKind.data, id: parsedId.data };
  });

/**
 * The admin requirement form. Only drafts are edited with it; status changes
 * are separate audited actions. An unchecked checkbox is absent from the form
 * data, which reads as "optional".
 */
export const requirementFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter a requirement title.")
      .max(150, "Keep the title under 150 characters."),
    description: optionalDescription,
    target: requirementTarget,
    isMandatory: z.preprocess(
      (value) => value === "on" || value === "true" || value === true,
      z.boolean(),
    ),
    effectiveFrom: z.iso.date("Enter a valid start date."),
    effectiveTo: z.preprocess(
      blankToNull,
      z.iso.date("Enter a valid end date.").nullable().default(null),
    ),
  })
  .refine(
    (input) => input.effectiveTo === null || input.effectiveTo >= input.effectiveFrom,
    { message: "The end date can't be before the start date.", path: ["effectiveTo"] },
  );

export type RequirementFormInput = z.infer<typeof requirementFormSchema>;

/** Supersede: the date the new version takes over from the current one. */
export const supersedeRequirementSchema = z.object({
  startsOn: z.iso.date("Enter the date the new version starts."),
});
