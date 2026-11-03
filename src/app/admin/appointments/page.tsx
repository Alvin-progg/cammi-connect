import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Appointments" };

export default function AdminAppointmentsPage() {
  return <AdminPlaceholderPage section="appointments" label="Appointments" path="/admin/appointments" />;
}
