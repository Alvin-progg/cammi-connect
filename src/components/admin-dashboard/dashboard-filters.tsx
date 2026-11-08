import { buttonVariants } from "@/components/ui/button";
import {
  DASHBOARD_PATH,
  DASHBOARD_RANGE_LABELS,
  DASHBOARD_RANGES,
  type DashboardFilters as Filters,
} from "@/lib/admin/dashboard";
import { ANALYTICS_PATH } from "@/lib/analytics/filters";
import { formatManilaMediumDate } from "@/lib/appointments/format";

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";

type FilterOption = { id: string; name: string };

/** GET form, so the filters live in the URL (ADM-12). Modelled on the analytics filters. */
export function DashboardFilters({
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
        aria-label="Filter dashboard"
        method="get"
        action={DASHBOARD_PATH}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-range" className={FIELD_LABEL_CLASS}>
            Range
          </label>
          <select id="dashboard-range" name="range" defaultValue={filters.range} className={CONTROL_CLASS}>
            {DASHBOARD_RANGES.map((range) => (
              <option key={range} value={range}>
                {DASHBOARD_RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-from" className={FIELD_LABEL_CLASS}>
            From (custom)
          </label>
          <input id="dashboard-from" name="from" type="date" defaultValue={filters.from} className={CONTROL_CLASS} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-to" className={FIELD_LABEL_CLASS}>
            To (custom)
          </label>
          <input id="dashboard-to" name="to" type="date" defaultValue={filters.to} className={CONTROL_CLASS} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-doctor" className={FIELD_LABEL_CLASS}>
            Doctor
          </label>
          <select id="dashboard-doctor" name="doctor" defaultValue={filters.doctorId ?? ""} className={CONTROL_CLASS}>
            <option value="">All doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-department" className={FIELD_LABEL_CLASS}>
            Department
          </label>
          <select
            id="dashboard-department"
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
          {formatManilaMediumDate(filters.from)} – {formatManilaMediumDate(filters.to)}. Times in Asia/Manila. Pick
          Custom to use the From and To dates.
        </p>
        <a
          href={ANALYTICS_PATH}
          className="rounded text-sm text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
        >
          Open full analytics
        </a>
      </div>
    </div>
  );
}
