import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { HmoProviderForm } from "@/components/hmo-providers/hmo-provider-form";
import { getAdminSession } from "@/server/auth/dal";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "New HMO provider" };

export default async function AdminNewHmoProviderPage() {
  const session = await getAdminSession("/admin/hmo-providers/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="hmo-providers"
      crumbs={[{ label: "HMO providers", href: "/admin/hmo-providers" }, { label: "New HMO provider" }]}
    >
      <HmoProviderForm />
    </AdminShell>
  );
}
