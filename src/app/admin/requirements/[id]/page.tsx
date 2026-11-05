import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  InEffectBadge,
  RequirementStatusBadge,
} from "@/components/requirements/requirement-badges";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { RequirementLifecycle } from "@/components/requirements/requirement-lifecycle";
import { RequirementSummary } from "@/components/requirements/requirement-summary";
import { todayInManila } from "@/lib/appointments/filters";
import { isRequirementEffective } from "@/lib/requirements/effective";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseRequirementAdminRepository } from "@/server/requirements/repository";
import { getRequirementDetail } from "@/server/requirements/service";
import { supabaseServiceAdminRepository } from "@/server/services/repository";
import { listServices } from "@/server/services/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Requirement" };

export default async function AdminRequirementPage({
  params,
}: PageProps<"/admin/requirements/[id]">) {
  // Reads today's Manila date, so render at request time (cacheComponents).
  await connection();
  const { id } = await params;
  const session = await getAdminSession(`/admin/requirements/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const requirementId = z.uuid().safeParse(id);
  const requirement = requirementId.success
    ? await getRequirementDetail(requirementId.data, supabaseRequirementAdminRepository)
    : null;
  if (!requirement) {
    notFound();
  }

  const successor = requirement.supersededBy
    ? await getRequirementDetail(requirement.supersededBy, supabaseRequirementAdminRepository)
    : null;
  const isDraft = requirement.status === "draft";
  // Only a draft is edited, so only then are the target choices needed.
  const [services, specialties] = isDraft
    ? await Promise.all([
        listServices({ status: "all" }, supabaseServiceAdminRepository),
        supabaseDirectoryRepository.listSpecialties(),
      ])
    : [[], []];
  const today = todayInManila();

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="requirements"
      crumbs={[
        { label: "Requirements", href: "/admin/requirements" },
        { label: requirement.title },
      ]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">Status</span>
          <RequirementStatusBadge status={requirement.status} />
          {isRequirementEffective(requirement, today) ? <InEffectBadge /> : null}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TaskCard title="Details">
            {isDraft ? (
              <RequirementForm
                requirement={requirement}
                services={services}
                specialties={specialties}
                today={today}
              />
            ) : (
              <RequirementSummary requirement={requirement} />
            )}
          </TaskCard>
          <TaskCard title="Status">
            <RequirementLifecycle
              requirement={requirement}
              successorStatus={successor?.status ?? null}
            />
          </TaskCard>
        </div>
      </div>
    </AdminShell>
  );
}
