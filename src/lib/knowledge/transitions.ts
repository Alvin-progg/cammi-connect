import type { KnowledgeStatus } from "./types";

/**
 * The knowledge document lifecycle (ADM-13). The 0025 status function is the
 * authority; the UI uses this map to offer only the allowed actions.
 */
export const KNOWLEDGE_TRANSITIONS: Record<KnowledgeStatus, readonly KnowledgeStatus[]> = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: ["draft"],
};

export function canTransitionKnowledge(from: KnowledgeStatus, to: KnowledgeStatus): boolean {
  return KNOWLEDGE_TRANSITIONS[from].includes(to);
}
