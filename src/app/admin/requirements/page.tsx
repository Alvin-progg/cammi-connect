import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Requirements" };

export default function AdminRequirementsPage() {
  return <AdminPlaceholderPage section="requirements" label="Requirements" path="/admin/requirements" />;
}
