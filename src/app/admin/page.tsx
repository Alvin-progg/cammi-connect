import type { Metadata } from "next";

import { AdminPlaceholderPage } from "./_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Administration" };

/** The admin dashboard (ADM-12). Until then it is a placeholder. */
export default function AdminDashboardPage() {
  return <AdminPlaceholderPage section="dashboard" label="Dashboard" path="/admin" />;
}
