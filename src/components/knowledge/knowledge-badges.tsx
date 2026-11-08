import {
  KNOWLEDGE_PROCESSING_LABELS,
  KNOWLEDGE_STATUS_LABELS,
  type KnowledgeProcessingStatus,
  type KnowledgeStatus,
} from "@/lib/knowledge/types";

const BADGE_CLASS = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium";

const STATUS_CLASSES: Record<KnowledgeStatus, string> = {
  draft: "bg-warning-soft text-warning-soft-ink",
  published: "bg-primary-soft text-primary",
  archived: "bg-surface-muted text-ink-secondary",
};

const PROCESSING_CLASSES: Record<KnowledgeProcessingStatus, string> = {
  pending: "bg-surface-muted text-ink-secondary",
  processing: "bg-warning-soft text-warning-soft-ink",
  ready: "bg-success-soft text-success-soft-ink",
  failed: "bg-danger-soft text-danger-soft-ink",
};

export function KnowledgeStatusBadge({ status }: { status: KnowledgeStatus }) {
  return (
    <span className={`${BADGE_CLASS} ${STATUS_CLASSES[status]}`}>
      {KNOWLEDGE_STATUS_LABELS[status]}
    </span>
  );
}

export function KnowledgeProcessingBadge({ status }: { status: KnowledgeProcessingStatus }) {
  return (
    <span className={`${BADGE_CLASS} ${PROCESSING_CLASSES[status]}`}>
      {KNOWLEDGE_PROCESSING_LABELS[status]}
    </span>
  );
}
