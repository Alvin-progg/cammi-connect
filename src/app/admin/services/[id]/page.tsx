import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActiveBadge } from "@/components/admin/active-badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/admin/empty-state";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { ServiceForm } from "@/components/services/service-form";
import { ServicePublishPlaceholder } from "@/components/services/service-publish";
import { ServiceStatusForm } from "@/components/services/service-status";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseServiceAdminRepository } from "@/server/services/repository";
import { getServiceDetail } from "@/server/services/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Service" };

export default async function AdminServicePage({ params }: PageProps<"/admin/services/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`/admin/services/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const serviceId = z.uuid().safeParse(id);
  const [service, departments] = await Promise.all([
    serviceId.success
      ? getServiceDetail(serviceId.data, supabaseServiceAdminRepository)
      : Promise.resolve(null),
    supabaseDirectoryRepository.listDepartments(),
  ]);
  if (!service) {
    notFound();
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="services"
      crumbs={[{ label: "Services", href: "/admin/services" }, { label: service.name }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">Status</span>
          <ActiveBadge isActive={service.isActive} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TaskCard title="Details">
            <ServiceForm service={service} departments={departments} />
          </TaskCard>
          <TaskCard title="Status">
            <ServiceStatusForm service={service} />
          </TaskCard>
          <TaskCard title="Requirements" description="What patients should bring or do first.">
            <EmptyState>Appointment requirements are not set up yet.</EmptyState>
          </TaskCard>
          <TaskCard title="Cami AI">
            <ServicePublishPlaceholder />
          </TaskCard>
        </div>
      </div>
    </AdminShell>
  );
}
