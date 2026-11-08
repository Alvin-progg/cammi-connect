import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_STATUSES,
  type KnowledgeCategoryFilter,
  type KnowledgeStatusFilter,
} from "./types";

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The knowledge list `?status=` filter; anything unknown shows all. */
export function parseKnowledgeStatusFilter(value: SearchParam): KnowledgeStatusFilter {
  const raw = firstValue(value);
  return KNOWLEDGE_STATUSES.find((status) => status === raw) ?? "all";
}

/** The knowledge list `?category=` filter; anything unknown shows all. */
export function parseKnowledgeCategoryFilter(value: SearchParam): KnowledgeCategoryFilter {
  const raw = firstValue(value);
  return KNOWLEDGE_CATEGORIES.find((category) => category === raw) ?? "all";
}
