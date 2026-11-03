import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <AdminPlaceholderPage section="settings" label="Settings" path="/admin/settings" />;
}
