import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/auth/access-denied";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { RequestBoard, RequestQueue } from "@/components/front-desk/request-queue";
import { LinkTabs } from "@/components/ui/navigation";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import {
  REQUEST_STATUS_FILTERS,
  REQUEST_STATUS_FILTER_LABELS,
  parseRequestQueueFilters,
  parseRequestView,
} from "@/lib/front-desk/requests";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import {
  supabaseFrontDeskOverviewRepository,
  supabaseFrontDeskRequestsRepository,
} from "@/server/front-desk/repository";
import { getOverviewCounts, listRequestQueue } from "@/server/front-desk/service";
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

  const now = new Date();
  const view = parseRequestView(params);
  const parsedFilters = parseRequestQueueFilters(params);
  // The board shows every status in its own column, so it ignores the status filter.
  const filters = view === "board" ? { ...parsedFilters, status: "all" as const } : parsedFilters;
  const [queue, doctors, specialties, counts] = await Promise.all([
    listRequestQueue(filters, supabaseFrontDeskRequestsRepository),
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
    supabaseDirectoryRepository.listSpecialties(),
    getOverviewCounts(supabaseFrontDeskOverviewRepository, now),
  ]);

  // Tab links keep the other filters.
  function viewHref(target: "board" | "list"): string {
    const query = new URLSearchParams();
    if (target === "list") query.set("view", "list");
    if (target === "list" && parsedFilters.status !== "pending") query.set("status", parsedFilters.status);
    if (filters.date) query.set("date", filters.date);
    if (filters.doctorId) query.set("doctor", filters.doctorId);
    if (filters.specialtyId) query.set("specialty", filters.specialtyId);
    const text = query.toString();
    return text ? `/front-desk/requests?${text}` : "/front-desk/requests";
  }

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="requests"
      crumbs={[{ label: "Requests" }]}
      title="Appointment requests"
      lead="Confirm, reschedule or reject requests from Cami. Patients see the change right away."
      requestCount={counts.pending}
      actions={
        <LinkButton size="sm" href="/front-desk/book">
          <CalendarPlus aria-hidden="true" />
          New appointment
        </LinkButton>
      }
    >
      <div className="flex flex-col gap-6">
        <LinkTabs
          label="Request view"
          items={[
            { href: viewHref("board"), label: "Board", current: view === "board" },
            { href: viewHref("list"), label: "List", current: view === "list" },
          ]}
        />
        <form
          method="get"
          action="/front-desk/requests"
          aria-label="Filter requests"
          className="flex flex-wrap items-end gap-3"
        >
          {view === "list" ? <input type="hidden" name="view" value="list" /> : null}
          {view === "list" ? (
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
          ) : null}
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
            href={view === "list" ? "/front-desk/requests?view=list" : "/front-desk/requests"}
            className="focus-ring inline-flex h-9 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
          >
            Clear filters
          </Link>
        </form>
        {view === "board" ? (
          <RequestBoard items={queue.items} limitReached={queue.limitReached} now={now} />
        ) : (
          <RequestQueue items={queue.items} limitReached={queue.limitReached} now={now} />
        )}
      </div>
    </FrontDeskShell>
  );
}
