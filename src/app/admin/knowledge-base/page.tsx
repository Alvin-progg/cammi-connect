import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Knowledge Base" };

export default function AdminKnowledgeBasePage() {
  return <AdminPlaceholderPage section="knowledge-base" label="Knowledge Base" path="/admin/knowledge-base" />;
}
