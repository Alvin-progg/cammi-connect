import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { todayInManila } from "@/lib/appointments/filters";
import { parseRequirementTargetParam } from "@/lib/requirements/params";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseServiceAdminRepository } from "@/server/services/repository";
import { listServices } from "@/server/services/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "New requirement" };

export default async function AdminNewRequirementPage({
  searchParams,
}: PageProps<"/admin/requirements/new">) {
  // Reads today's Manila date, so render at request time (cacheComponents).
  await connection();
  const params = await searchParams;
  const session = await getAdminSession("/admin/requirements/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const [services, specialties] = await Promise.all([
    listServices({ status: "active" }, supabaseServiceAdminRepository),
    supabaseDirectoryRepository.listSpecialties(),
  ]);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="requirements"
      crumbs={[{ label: "Requirements", href: "/admin/requirements" }, { label: "New requirement" }]}
    >
      <RequirementForm
        services={services}
        specialties={specialties}
        defaultTarget={parseRequirementTargetParam(params)}
        today={todayInManila()}
      />
    </AdminShell>
  );
}
