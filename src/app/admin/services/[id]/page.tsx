import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { ActiveBadge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { RequirementsList } from "@/components/requirements/requirements-list";
import { ServiceForm } from "@/components/services/service-form";
import { ServicePublishPlaceholder } from "@/components/services/service-publish";
import { ServiceStatusForm } from "@/components/services/service-status";
import { buttonVariants } from "@/components/ui/button";
import { todayInManila } from "@/lib/appointments/filters";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseRequirementAdminRepository } from "@/server/requirements/repository";
import { listRequirements } from "@/server/requirements/service";
import { supabaseServiceAdminRepository } from "@/server/services/repository";
import { getServiceDetail } from "@/server/services/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Service" };

export default async function AdminServicePage({ params }: PageProps<"/admin/services/[id]">) {
  // Reads today's Manila date, so render at request time (cacheComponents).
  await connection();
  const { id } = await params;
  const session = await getAdminSession(`/admin/services/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const serviceId = z.uuid().safeParse(id);
  if (!serviceId.success) {
    notFound();
  }
  const [service, departments, requirements] = await Promise.all([
    getServiceDetail(serviceId.data, supabaseServiceAdminRepository),
    supabaseDirectoryRepository.listDepartments(),
    listRequirements(
      { status: "all", kind: "service", serviceId: serviceId.data },
      supabaseRequirementAdminRepository,
    ),
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
            <RequirementsList requirements={requirements} today={todayInManila()} grouped={false} />
            <Link
              href={`/admin/requirements/new?service=${service.id}`}
              className={`${buttonVariants({ variant: "secondary" })} self-start`}
            >
              Add requirement
            </Link>
          </TaskCard>
          <TaskCard title="Cami AI">
            <ServicePublishPlaceholder />
          </TaskCard>
        </div>
      </div>
    </AdminShell>
  );
}
