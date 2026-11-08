import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditLogDiff } from "@/components/audit-log/audit-log-diff";
import { AuditLogFilters, AuditLogTable } from "@/components/audit-log/audit-log-table";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { parseAuditLogFilters, type AuditLogEntry } from "@/lib/audit/log";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000501";

const DEPARTMENT_UPDATE: AuditLogEntry = {
  id: "00000000-0000-4000-8000-000000000901",
  createdAt: "2026-11-08T01:05:00.000Z",
  actorProfileId: ADMIN_ID,
  actorName: "Synthetic Admin",
  action: "department.update",
  targetType: "department",
  targetId: DEPARTMENT_ID,
  reason: "Typo fix",
  previousValues: { name: "Cardio", code: "CAR" },
  newValues: { name: "Cardiology", code: "CAR" },
};

const ANALYTICS_EXPORT: AuditLogEntry = {
  ...DEPARTMENT_UPDATE,
  id: "00000000-0000-4000-8000-000000000902",
  actorName: null,
  action: "analytics.export",
  targetType: "analytics",
  targetId: "kpis",
  reason: null,
};

describe("AuditLogFilters", () => {
  it("offers actor, action, target, and date filters with the current values", () => {
    render(
      <AuditLogFilters
        filters={parseAuditLogFilters({ actor: ADMIN_ID, action: "settings" })}
        actors={[{ id: ADMIN_ID, name: "Synthetic Admin" }]}
      />,
    );

    expect(screen.getByLabelText("Actor")).toHaveValue(ADMIN_ID);
    expect(screen.getByLabelText("Action")).toHaveValue("settings");
    expect(screen.getByLabelText("Target")).toHaveValue("");
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });
});

describe("AuditLogTable", () => {
  const filters = parseAuditLogFilters({ action: "department", page: "2" });

  it("lists entries with Manila time, actor, action, linked target, and reason", () => {
    render(
      <AuditLogTable
        entries={[DEPARTMENT_UPDATE, ANALYTICS_EXPORT]}
        total={30}
        filters={filters}
        pageCount={2}
      />,
    );

    const table = screen.getByRole("table", { name: "Audit log" });
    const [, first, second] = within(table).getAllByRole("row");
    expect(
      within(first).getByText(formatManilaDateTime(DEPARTMENT_UPDATE.createdAt)),
    ).toBeInTheDocument();
    expect(within(first).getByText("Synthetic Admin")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "department.update" })).toHaveAttribute(
      "href",
      "/admin/audit-log/00000000-0000-4000-8000-000000000901",
    );
    expect(within(first).getByRole("link", { name: /Department/ })).toHaveAttribute(
      "href",
      `/admin/departments/${DEPARTMENT_ID}`,
    );
    expect(within(first).getByText("Typo fix")).toBeInTheDocument();
    expect(within(second).getByText("Unknown")).toBeInTheDocument();
    expect(within(second).queryByRole("link", { name: /Analytics/ })).not.toBeInTheDocument();
  });

  it("is read-only: only links for details, paging, and export", () => {
    render(
      <AuditLogTable entries={[DEPARTMENT_UPDATE]} total={30} filters={filters} pageCount={2} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/admin/audit-log?action=department",
    );
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute(
      "href",
      "/api/admin/audit-log/export?action=department",
    );
  });

  it("says when nothing matches", () => {
    render(<AuditLogTable entries={[]} total={0} filters={filters} pageCount={1} />);

    expect(screen.getByText("No audit entries match these filters.")).toBeInTheDocument();
  });
});

describe("AuditLogDiff", () => {
  it("shows changed keys side by side and hides unchanged ones behind a disclosure", () => {
    render(
      <AuditLogDiff
        previousValues={DEPARTMENT_UPDATE.previousValues}
        newValues={DEPARTMENT_UPDATE.newValues}
      />,
    );

    const changed = screen.getByRole("table", { name: "Changed values" });
    const [, row] = within(changed).getAllByRole("row");
    expect(within(row).getByText("name")).toBeInTheDocument();
    expect(within(row).getByText('"Cardio"')).toBeInTheDocument();
    expect(within(row).getByText('"Cardiology"')).toBeInTheDocument();
    expect(screen.getByText("1 unchanged value")).toBeInTheDocument();
  });

  it("says when an event recorded no values", () => {
    render(<AuditLogDiff previousValues={null} newValues={null} />);

    expect(screen.getByText("This event recorded no values.")).toBeInTheDocument();
  });
});
