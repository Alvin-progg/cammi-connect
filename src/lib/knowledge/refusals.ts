/** Codes raised by the 0025 knowledge document functions. */
export const KNOWLEDGE_REFUSALS = [
  "not_admin",
  "not_found",
  "not_editable",
  "invalid_transition",
] as const;

export type KnowledgeRefusal = (typeof KNOWLEDGE_REFUSALS)[number];

export function knowledgeRefusalFromCode(code: string | undefined | null): KnowledgeRefusal | null {
  return KNOWLEDGE_REFUSALS.find((refusal) => refusal === code) ?? null;
}
