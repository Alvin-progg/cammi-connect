import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { RequirementsList } from "@/components/requirements/requirements-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { todayInManila } from "@/lib/appointments/filters";
import {
  parseRequirementKindFilter,
  parseRequirementStatusFilter,
} from "@/lib/requirements/params";
import { REQUIREMENT_STATUSES, REQUIREMENT_STATUS_LABELS } from "@/lib/requirements/types";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseRequirementAdminRepository } from "@/server/requirements/repository";
import { listRequirements } from "@/server/requirements/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Requirements" };

const SELECT_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const FILTER_LABEL_CLASS = "text-xs font-medium text-ink-muted";

export default async function AdminRequirementsPage({
  searchParams,
}: PageProps<"/admin/requirements">) {
  // Reads today's Manila date, so render at request time (cacheComponents).
  await connection();
  const params = await searchParams;
  const session = await getAdminSession("/admin/requirements");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const status = parseRequirementStatusFilter(params.status);
  const kind = parseRequirementKindFilter(params.kind);
  const requirements = await listRequirements(
    { status, kind },
    supabaseRequirementAdminRepository,
  );

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="requirements"
      crumbs={[{ label: "Requirements" }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form
            method="get"
            action="/admin/requirements"
            aria-label="Filter requirements"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-kind" className={FILTER_LABEL_CLASS}>
                Applies to
              </label>
              <select id="filter-kind" name="kind" defaultValue={kind} className={SELECT_CLASS}>
                <option value="all">Services and specialties</option>
                <option value="service">Services</option>
                <option value="specialty">Specialties</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className={FILTER_LABEL_CLASS}>
                Status
              </label>
              <select id="filter-status" name="status" defaultValue={status} className={SELECT_CLASS}>
                <option value="all">All statuses</option>
                {REQUIREMENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {REQUIREMENT_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
          <Link href="/admin/requirements/new" className={buttonVariants()}>
            New requirement
          </Link>
        </div>
        <RequirementsList requirements={requirements} today={todayInManila()} />
      </div>
    </AdminShell>
  );
}
