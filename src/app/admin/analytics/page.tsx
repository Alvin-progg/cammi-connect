import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Analytics" };

export default function AdminAnalyticsPage() {
  return <AdminPlaceholderPage section="analytics" label="Analytics" path="/admin/analytics" />;
}
