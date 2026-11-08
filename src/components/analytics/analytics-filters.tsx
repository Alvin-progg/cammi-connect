import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ANALYTICS_DATASETS, ANALYTICS_DATASET_LABELS } from "@/lib/analytics/csv";
import {
  ANALYTICS_PATH,
  ANALYTICS_RANGE_LABELS,
  ANALYTICS_RANGES,
  analyticsSearchParams,
  type AnalyticsFilters as Filters,
} from "@/lib/analytics/filters";
import { CONTROL_CLASS } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export const ANALYTICS_EXPORT_PATH = "/api/admin/analytics/export";

type FilterOption = { id: string; name: string };

function exportHref(filters: Filters, dataset: (typeof ANALYTICS_DATASETS)[number]): string {
  const params = analyticsSearchParams(filters);
  params.set("dataset", dataset);
  return `${ANALYTICS_EXPORT_PATH}?${params.toString()}`;
}

/**
 * GET form, so the filters live in the URL and every view is shareable.
 * Compact row as in the reference: doctor, department, range, then the
 * custom dates. Labels are visually hidden; each select names its default.
 */
export function AnalyticsFilters({
  filters,
  doctors,
  departments,
}: {
  filters: Filters;
  doctors: FilterOption[];
  departments: FilterOption[];
}) {
  return (
    <form
      role="search"
      aria-label="Filter analytics"
      method="get"
      action={ANALYTICS_PATH}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor="analytics-doctor" className="sr-only">
        Doctor
      </label>
      <select
        id="analytics-doctor"
        name="doctor"
        defaultValue={filters.doctorId ?? ""}
        className={cn(CONTROL_CLASS, "w-auto pr-8")}
      >
        <option value="">All doctors</option>
        {doctors.map((doctor) => (
          <option key={doctor.id} value={doctor.id}>
            {doctor.name}
          </option>
        ))}
      </select>
      <label htmlFor="analytics-department" className="sr-only">
        Department
      </label>
      <select
        id="analytics-department"
        name="department"
        defaultValue={filters.departmentId ?? ""}
        className={cn(CONTROL_CLASS, "w-auto pr-8")}
      >
        <option value="">All departments</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      <label htmlFor="analytics-range" className="sr-only">
        Range
      </label>
      <select id="analytics-range" name="range" defaultValue={filters.range} className={cn(CONTROL_CLASS, "w-auto pr-8")}>
        {ANALYTICS_RANGES.map((range) => (
          <option key={range} value={range}>
            {ANALYTICS_RANGE_LABELS[range]}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-muted p-[3px] pl-2.5">
        <span aria-hidden="true" className="text-xs text-ink-muted">
          Custom
        </span>
        <label htmlFor="analytics-from" className="sr-only">
          From (custom)
        </label>
        <input
          id="analytics-from"
          name="from"
          type="date"
          defaultValue={filters.from}
          className={cn(CONTROL_CLASS, "w-auto shadow-none")}
        />
        <span aria-hidden="true" className="text-xs text-ink-muted">
          –
        </span>
        <label htmlFor="analytics-to" className="sr-only">
          To (custom)
        </label>
        <input id="analytics-to" name="to" type="date" defaultValue={filters.to} className={cn(CONTROL_CLASS, "w-auto shadow-none")} />
      </div>
      <button type="submit" className={buttonVariants({ variant: "primary", size: "sm" })}>
        Apply
      </button>
    </form>
  );
}

/** "Export CSV" in the top bar: one audited download per dataset, with the current filters. */
export function AnalyticsExportMenu({ filters }: { filters: Filters }) {
  return (
    <details className="relative">
      <summary className={buttonVariants({ variant: "outline", size: "sm", className: "cursor-pointer list-none" })}>
        <Download aria-hidden="true" />
        Export CSV
      </summary>
      <nav
        aria-label="Download CSV"
        className="absolute right-0 z-30 mt-2 flex w-56 flex-col rounded-xl border border-line bg-surface p-1.5 shadow-overlay"
      >
        {ANALYTICS_DATASETS.map((dataset) => (
          <a
            key={dataset}
            href={exportHref(filters, dataset)}
            className="focus-ring rounded-md px-3 py-2 text-sm text-ink hover:bg-surface-muted"
          >
            {ANALYTICS_DATASET_LABELS[dataset]}
          </a>
        ))}
      </nav>
    </details>
  );
}
