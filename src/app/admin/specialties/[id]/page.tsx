import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActiveBadge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { SpecialtyDoctors } from "@/components/specialties/specialty-doctors";
import { SpecialtyForm } from "@/components/specialties/specialty-form";
import { SpecialtyStatusForm } from "@/components/specialties/specialty-status";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseSpecialtyAdminRepository } from "@/server/specialties/repository";
import { getSpecialtyDetail } from "@/server/specialties/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Specialty" };

export default async function AdminSpecialtyPage({
  params,
}: PageProps<"/admin/specialties/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`/admin/specialties/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const specialtyId = z.uuid().safeParse(id);
  const detail = specialtyId.success
    ? await getSpecialtyDetail(specialtyId.data, supabaseSpecialtyAdminRepository)
    : null;
  if (!detail) {
    notFound();
  }

  const { specialty, doctors } = detail;

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="specialties"
      crumbs={[{ label: "Specialties", href: "/admin/specialties" }, { label: specialty.name }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">Status</span>
          <ActiveBadge isActive={specialty.isActive} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TaskCard title="Details">
            <SpecialtyForm specialty={specialty} />
          </TaskCard>
          <TaskCard title="Status">
            <SpecialtyStatusForm specialty={specialty} />
          </TaskCard>
          <TaskCard title="Doctors" description="Doctors who have this specialty.">
            <SpecialtyDoctors specialtyId={specialty.id} doctors={doctors} />
          </TaskCard>
        </div>
      </div>
    </AdminShell>
  );
}
