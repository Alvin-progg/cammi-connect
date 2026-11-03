import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return <AdminPlaceholderPage section="users" label="Users" path="/admin/users" />;
}
