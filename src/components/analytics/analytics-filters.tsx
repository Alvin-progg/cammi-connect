import { buttonVariants } from "@/components/ui/button";
import { formatManilaMediumDate } from "@/lib/appointments/format";
import { ANALYTICS_DATASETS, ANALYTICS_DATASET_LABELS } from "@/lib/analytics/csv";
import {
  ANALYTICS_PATH,
  ANALYTICS_RANGE_LABELS,
  ANALYTICS_RANGES,
  analyticsSearchParams,
  type AnalyticsFilters as Filters,
} from "@/lib/analytics/filters";

export const ANALYTICS_EXPORT_PATH = "/api/admin/analytics/export";

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";

type FilterOption = { id: string; name: string };

function exportHref(filters: Filters, dataset: (typeof ANALYTICS_DATASETS)[number]): string {
  const params = analyticsSearchParams(filters);
  params.set("dataset", dataset);
  return `${ANALYTICS_EXPORT_PATH}?${params.toString()}`;
}

/** GET form, so the filters live in the URL and every view is shareable. */
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
    <div className="flex flex-col gap-3">
      <form
        role="search"
        aria-label="Filter analytics"
        method="get"
        action={ANALYTICS_PATH}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-range" className={FIELD_LABEL_CLASS}>
            Range
          </label>
          <select id="analytics-range" name="range" defaultValue={filters.range} className={CONTROL_CLASS}>
            {ANALYTICS_RANGES.map((range) => (
              <option key={range} value={range}>
                {ANALYTICS_RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-from" className={FIELD_LABEL_CLASS}>
            From (custom)
          </label>
          <input id="analytics-from" name="from" type="date" defaultValue={filters.from} className={CONTROL_CLASS} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-to" className={FIELD_LABEL_CLASS}>
            To (custom)
          </label>
          <input id="analytics-to" name="to" type="date" defaultValue={filters.to} className={CONTROL_CLASS} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-doctor" className={FIELD_LABEL_CLASS}>
            Doctor
          </label>
          <select id="analytics-doctor" name="doctor" defaultValue={filters.doctorId ?? ""} className={CONTROL_CLASS}>
            <option value="">All doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-department" className={FIELD_LABEL_CLASS}>
            Department
          </label>
          <select
            id="analytics-department"
            name="department"
            defaultValue={filters.departmentId ?? ""}
            className={CONTROL_CLASS}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonVariants({ variant: "primary" })}>
          Apply
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">
          Measured data, {formatManilaMediumDate(filters.from)} – {formatManilaMediumDate(filters.to)}. Times in
          Asia/Manila. Pick Custom to use the From and To dates.
        </p>
        <nav aria-label="Download CSV" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-ink-muted">Download CSV:</span>
          {ANALYTICS_DATASETS.map((dataset) => (
            <a
              key={dataset}
              href={exportHref(filters, dataset)}
              className="rounded text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
            >
              {ANALYTICS_DATASET_LABELS[dataset]}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
