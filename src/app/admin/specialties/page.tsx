import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { SpecialtiesTable } from "@/components/specialties/specialties-table";
import { buttonVariants } from "@/components/ui/button";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseSpecialtyAdminRepository } from "@/server/specialties/repository";
import { listSpecialtiesOverview } from "@/server/specialties/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Specialties" };

export default async function AdminSpecialtiesPage() {
  const session = await getAdminSession("/admin/specialties");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const specialties = await listSpecialtiesOverview(supabaseSpecialtyAdminRepository);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="specialties"
      crumbs={[{ label: "Specialties" }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Link href="/admin/specialties/new" className={buttonVariants()}>
            New specialty
          </Link>
        </div>
        <SpecialtiesTable specialties={specialties} />
      </div>
    </AdminShell>
  );
}
