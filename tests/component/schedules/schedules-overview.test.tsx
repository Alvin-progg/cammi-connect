import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SchedulesOverview } from "@/components/schedules/schedules-overview";
import type { DoctorSummary } from "@/lib/directory/types";
import type { WeeklySchedule } from "@/lib/schedules/types";

const SANTOS: DoctorSummary = {
  id: "00000000-0000-4000-8000-000000000101",
  fullName: "Dr. Maya Santos",
  departmentId: "00000000-0000-4000-8000-000000000501",
  departmentName: "Internal Medicine",
  isActive: true,
  specialties: [],
};

const MERCADO: DoctorSummary = {
  ...SANTOS,
  id: "00000000-0000-4000-8000-000000000102",
  fullName: "Dr. Liza Mercado",
  isActive: false,
};

const MONDAY_MORNING: WeeklySchedule = {
  id: "00000000-0000-4000-8000-000000000901",
  doctorId: SANTOS.id,
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "12:00",
  slotDurationMinutes: 30,
  effectiveFrom: "2026-01-01",
  effectiveUntil: null,
  isActive: true,
};

describe("SchedulesOverview", () => {
  it("lists each doctor's current weekly hours with a link to their schedule", () => {
    render(
      <SchedulesOverview
        doctors={[SANTOS, MERCADO]}
        schedules={[MONDAY_MORNING]}
        today="2026-11-04"
      />,
    );

    const rows = within(screen.getByRole("table", { name: "Doctor schedules" })).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole("link", { name: "Dr. Maya Santos" })).toHaveAttribute(
      "href",
      `/admin/schedules?doctor=${SANTOS.id}`,
    );
    expect(within(rows[1]).getByText("Mon 08:00–12:00")).toBeInTheDocument();
    expect(within(rows[2]).getByText("No regular consultation hours set.")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Inactive")).toBeInTheDocument();
  });

  it("shows an empty state when no doctor matches", () => {
    render(<SchedulesOverview doctors={[]} schedules={[]} today="2026-11-04" />);
    expect(screen.getByText("No doctors match this filter.")).toBeInTheDocument();
  });
});
