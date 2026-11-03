import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Services" };

export default function AdminServicesPage() {
  return <AdminPlaceholderPage section="services" label="Services" path="/admin/services" />;
}
