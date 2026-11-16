import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { HmoProviderForm } from "@/components/hmo-providers/hmo-provider-form";
import { HmoProviderStatusForm } from "@/components/hmo-providers/hmo-provider-status";
import { ActiveBadge } from "@/components/ui/badge";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseHmoProviderAdminRepository } from "@/server/hmo-providers/repository";
import { getHmoProvider } from "@/server/hmo-providers/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "HMO provider" };

export default async function AdminHmoProviderPage({
  params,
}: PageProps<"/admin/hmo-providers/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`/admin/hmo-providers/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const hmoProviderId = z.uuid().safeParse(id);
  if (!hmoProviderId.success) {
    notFound();
  }
  const provider = await getHmoProvider(hmoProviderId.data, supabaseHmoProviderAdminRepository);
  if (!provider) {
    notFound();
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="hmo-providers"
      crumbs={[{ label: "HMO providers", href: "/admin/hmo-providers" }, { label: provider.name }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">Status</span>
          <ActiveBadge isActive={provider.isActive} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TaskCard title="Details">
            <HmoProviderForm provider={provider} />
          </TaskCard>
          <TaskCard title="Status">
            <HmoProviderStatusForm provider={provider} />
          </TaskCard>
        </div>
      </div>
    </AdminShell>
  );
}
