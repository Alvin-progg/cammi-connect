import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/auth/access-denied";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { RequestQueue } from "@/components/front-desk/request-queue";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import {
  REQUEST_STATUS_FILTERS,
  REQUEST_STATUS_FILTER_LABELS,
  parseRequestQueueFilters,
} from "@/lib/front-desk/requests";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseFrontDeskRequestsRepository } from "@/server/front-desk/repository";
import { listRequestQueue } from "@/server/front-desk/service";
import { CONTROL_CLASS } from "@/components/ui/field";

export const instant = false;

export const metadata: Metadata = { title: "Appointment requests" };

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const SECONDARY_BUTTON_CLASS = buttonVariants({ variant: "outline", size: "sm" });

export default async function FrontDeskRequestsPage({
  searchParams,
}: PageProps<"/front-desk/requests">) {
  const params = await searchParams;
  const session = await getFrontDeskSession("/front-desk/requests");

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const filters = parseRequestQueueFilters(params);
  const [queue, doctors, specialties] = await Promise.all([
    listRequestQueue(filters, supabaseFrontDeskRequestsRepository),
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
    supabaseDirectoryRepository.listSpecialties(),
  ]);

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="requests"
      crumbs={[{ label: "Requests" }]}
      lead="Appointment requests submitted through Cami. Pending requests wait for front desk confirmation."
      actions={
        <LinkButton size="sm" href="/front-desk/book">
          <CalendarPlus aria-hidden="true" />
          New appointment
        </LinkButton>
      }
    >
      <div className="flex flex-col gap-6">
        <form
          method="get"
          action="/front-desk/requests"
          aria-label="Filter requests"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className={FIELD_LABEL_CLASS}>
              Status
            </label>
            <select
              id="filter-status"
              name="status"
              defaultValue={filters.status}
              className={CONTROL_CLASS}
            >
              {REQUEST_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {REQUEST_STATUS_FILTER_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-date" className={FIELD_LABEL_CLASS}>
              Appointment date
            </label>
            <input
              id="filter-date"
              type="date"
              name="date"
              defaultValue={filters.date ?? ""}
              className={CONTROL_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-doctor" className={FIELD_LABEL_CLASS}>
              Doctor
            </label>
            <select
              id="filter-doctor"
              name="doctor"
              defaultValue={filters.doctorId ?? ""}
              className={CONTROL_CLASS}
            >
              <option value="">All doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-specialty" className={FIELD_LABEL_CLASS}>
              Specialty
            </label>
            <select
              id="filter-specialty"
              name="specialty"
              defaultValue={filters.specialtyId ?? ""}
              className={CONTROL_CLASS}
            >
              <option value="">All specialties</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={SECONDARY_BUTTON_CLASS}>
            Filter
          </button>
          <Link
            href="/front-desk/requests"
            className="focus-ring inline-flex h-9 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
          >
            Clear filters
          </Link>
        </form>
        <RequestQueue items={queue.items} limitReached={queue.limitReached} />
      </div>
    </FrontDeskShell>
  );
}
