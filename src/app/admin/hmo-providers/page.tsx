import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { HmoProvidersTable } from "@/components/hmo-providers/hmo-providers-table";
import { LinkButton } from "@/components/ui/button";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseHmoProviderAdminRepository } from "@/server/hmo-providers/repository";
import { listHmoProviders } from "@/server/hmo-providers/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "HMO providers" };

export default async function AdminHmoProvidersPage() {
  const session = await getAdminSession("/admin/hmo-providers");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const providers = await listHmoProviders(supabaseHmoProviderAdminRepository);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="hmo-providers"
      crumbs={[{ label: "HMO providers" }]}
      actions={
        <LinkButton size="sm" href="/admin/hmo-providers/new">
          <Plus aria-hidden="true" />
          New HMO provider
        </LinkButton>
      }
    >
      <HmoProvidersTable providers={providers} />
    </AdminShell>
  );
}
