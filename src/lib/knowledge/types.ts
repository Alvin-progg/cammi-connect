/**
 * Knowledge documents (spec §14): hospital-approved text Cami answers from.
 * Admins write them by hand (decision D7). Only published documents are
 * searched; ingestion (ADM-14) turns their content into embedded chunks.
 */
export const KNOWLEDGE_CATEGORIES = [
  "hospital_info",
  "departments",
  "specialties",
  "doctor_profiles",
  "services",
  "appointment_requirements",
  "appointment_procedures",
  "other_patient_info",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  hospital_info: "Hospital information",
  departments: "Departments",
  specialties: "Specialties",
  doctor_profiles: "Doctor profiles",
  services: "Services",
  appointment_requirements: "Appointment requirements",
  appointment_procedures: "Appointment procedures",
  other_patient_info: "Other patient information",
};

export const KNOWLEDGE_STATUSES = ["draft", "published", "archived"] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

/** Ingestion state of the document's chunks (set by ADM-14). */
export const KNOWLEDGE_PROCESSING_STATUSES = ["pending", "processing", "ready", "failed"] as const;

export type KnowledgeProcessingStatus = (typeof KNOWLEDGE_PROCESSING_STATUSES)[number];

export const KNOWLEDGE_PROCESSING_LABELS: Record<KnowledgeProcessingStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

/** A document without its content, for lists. */
export type KnowledgeDocumentSummary = {
  id: string;
  slug: string;
  title: string;
  category: KnowledgeCategory;
  status: KnowledgeStatus;
  processingStatus: KnowledgeProcessingStatus;
  processingError: string | null;
  version: number;
  sourceFileName: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

export type KnowledgeDocument = KnowledgeDocumentSummary & { content: string };

export type KnowledgeStatusFilter = "all" | KnowledgeStatus;
export type KnowledgeCategoryFilter = "all" | KnowledgeCategory;
