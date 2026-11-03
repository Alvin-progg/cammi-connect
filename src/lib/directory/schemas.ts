import { z } from "zod";

/** Form fields arrive as "" when left blank; treat that as "not provided". */
const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

/** Optional description, shared with the department form. */
export const optionalDescription = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters.")
    .nullable()
    .default(null),
);
