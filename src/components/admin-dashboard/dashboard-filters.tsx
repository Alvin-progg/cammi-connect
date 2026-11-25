import Form from "next/form";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  DASHBOARD_PATH,
  DASHBOARD_RANGE_LABELS,
  DASHBOARD_RANGES,
  dashboardHref,
  type DashboardFilters as Filters,
} from "@/lib/admin/dashboard";
import { ANALYTICS_PATH } from "@/lib/analytics/filters";
import { formatManilaMediumDate } from "@/lib/appointments/format";
import { CONTROL_CLASS } from "@/components/ui/field";

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";

type FilterOption = { id: string; name: string };

/**
 * Period switch as links, so every range stays a plain URL. The current period
 * is `aria-current`. Colour-only transitions, so it never moves while switching.
 */
function PeriodSwitch({ filters }: { filters: Filters }) {
  return (
    <nav
      aria-label="Dashboard period"
      className="inline-flex flex-wrap gap-0.5 self-start rounded-lg bg-surface-muted p-[3px]"
    >
      {DASHBOARD_RANGES.map((range) => {
        const active = filters.range === range;
        return (
          <Link
            key={range}
            href={dashboardHref({ ...filters, range })}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm transition-[background-color,color,box-shadow] duration-150 ease-out focus-ring motion-reduce:transition-none ${
              active ? "bg-surface font-medium text-ink shadow-soft" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {DASHBOARD_RANGE_LABELS[range]}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * One GET form, so the filters live in the URL (ADM-12). Custom dates appear only
 * for the Custom period, and Reset appears only when something differs from the default.
 */
export function DashboardFilters({
  filters,
  doctors,
  departments,
}: {
  filters: Filters;
  doctors: FilterOption[];
  departments: FilterOption[];
}) {
  const isCustom = filters.range === "custom";
  const isDefault = filters.range === "this_month" && !filters.doctorId && !filters.departmentId;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-soft">
      <Form
        role="search"
        aria-label="Filter dashboard"
        action={DASHBOARD_PATH}
        className="flex flex-wrap items-end gap-3"
      >
        <PeriodSwitch filters={filters} />
        {/* Keeps the period when only the doctor or department changes. */}
        <input type="hidden" name="range" value={filters.range} />

        <div className="flex flex-wrap items-end gap-3 xl:ml-auto">
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
          {isCustom ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="dashboard-from" className={FIELD_LABEL_CLASS}>
                  From
                </label>
                <input id="dashboard-from" name="from" type="date" defaultValue={filters.from} className={CONTROL_CLASS} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="dashboard-to" className={FIELD_LABEL_CLASS}>
                  To
                </label>
                <input id="dashboard-to" name="to" type="date" defaultValue={filters.to} className={CONTROL_CLASS} />
              </div>
            </>
          ) : null}
          <div className="flex items-center gap-2">
            <button type="submit" className={buttonVariants({ variant: "primary", size: "sm" })}>
              Apply
            </button>
            {isDefault ? null : (
              <Link
                href={DASHBOARD_PATH}
                className="inline-flex min-h-9 items-center rounded-md px-3 text-sm text-ink-secondary transition-colors duration-150 ease-out hover:text-ink focus-ring motion-reduce:transition-none"
              >
                Reset
              </Link>
            )}
          </div>
        </div>
      </Form>

      <p className="px-1 text-xs text-ink-muted">
        {formatManilaMediumDate(filters.from)} – {formatManilaMediumDate(filters.to)}. Times in Asia/Manila.
        {isCustom ? null : " Choose Custom to set your own dates."}{" "}
        <a
          href={ANALYTICS_PATH}
          className="rounded text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
        >
          Open full analytics
        </a>
      </p>
    </div>
  );
}
