import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminAnalyticsPage from "@/app/admin/analytics/page";
import type { AnalyticsAppointment } from "@/lib/analytics/metrics";
import { supabaseAnalyticsRepository } from "@/server/analytics/repository";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/analytics" }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/analytics/repository", () => ({
  supabaseAnalyticsRepository: { listAppointments: vi.fn(), countPending: vi.fn() },
}));
vi.mock("@/server/directory/repository", () => ({
  supabaseDirectoryRepository: { listDoctors: vi.fn(), listDepartments: vi.fn() },
}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";

function row(status: AnalyticsAppointment["status"], index: number): AnalyticsAppointment {
  return {
    id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    doctorId: DOCTOR_ID,
    doctorName: "Dr. Synthetic Alpha",
    // Monday 2026-11-02, 09:00 Manila.
    scheduledAt: "2026-11-02T01:00:00.000Z",
    scheduledEndAt: "2026-11-02T01:30:00.000Z",
    status,
    confirmedAt: "2026-11-01T01:00:00.000Z",
    confirmedInAudit: true,
    cancelledAt: null,
  };
}

async function renderPage(searchParams: Record<string, string> = {}) {
  render(await AdminAnalyticsPage({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) }));
}

function kpiValue(label: string) {
  const card = screen.getByRole("group", { name: label });
  return card.querySelector(".sr-only")?.textContent ?? within(card).getByText("—").textContent;
}

describe("admin analytics page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date("2026-11-05T04:00:00.000Z"), toFake: ["Date"] });
    vi.mocked(getAdminSession).mockResolvedValue({
      user: { id: "auth-user", email: "admin@example.test" },
      admin: { id: "00000000-0000-4000-8000-000000000001", fullName: "Synthetic Admin" },
    });
    vi.mocked(supabaseDirectoryRepository.listDoctors).mockResolvedValue([
      {
        id: DOCTOR_ID,
        fullName: "Dr. Synthetic Alpha",
        departmentId: DEPARTMENT_ID,
        departmentName: "Synthetic Medicine",
        isActive: true,
        specialties: [],
      },
    ]);
    vi.mocked(supabaseDirectoryRepository.listDepartments).mockResolvedValue([
      { id: DEPARTMENT_ID, name: "Synthetic Medicine", code: "SYN", description: null, isActive: true },
    ]);
    vi.mocked(supabaseAnalyticsRepository.listAppointments).mockResolvedValue([
      row("completed", 1),
      row("completed", 2),
      row("completed", 3),
      row("no_show", 4),
    ]);
    vi.mocked(supabaseAnalyticsRepository.countPending).mockResolvedValue(2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("denies non-admins without reading analytics", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);

    await renderPage();

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(getAdminSession).toHaveBeenCalledWith("/admin/analytics");
    expect(supabaseAnalyticsRepository.listAppointments).not.toHaveBeenCalled();
  });

  it("shows the four measured KPIs with the pending snapshot", async () => {
    await renderPage();

    expect(kpiValue("Total appointments")).toBe("4");
    expect(kpiValue("Completion rate")).toBe("75.00%");
    expect(kpiValue("Cancellation rate")).toBe("0.00%");
    expect(kpiValue("No-show rate")).toBe("25.00%");
    expect(screen.getByText(/2 pending confirmation now/)).toBeInTheDocument();
    expect(screen.getAllByText("Rates based on few appointments.").length).toBeGreaterThan(0);
  });

  it("renders the six charts with data tables, the timezone, and the association disclaimer", async () => {
    await renderPage();

    for (const title of [
      "Monthly appointment volume",
      "Appointments per doctor",
      "Peak days and times",
      "Status by month",
      "Cancellations and no-shows by day and time",
      "Cancellations and no-shows by doctor",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByRole("table", { name: "Monthly appointment volume data" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Peak days and times" })).toBeInTheDocument();
    expect(screen.getByText(/Times in Asia\/Manila/)).toBeInTheDocument();
    expect(screen.getByText("Patterns show association, not cause.")).toBeInTheDocument();
  });

  it("shows empty states and no rates when the period has no appointments", async () => {
    vi.mocked(supabaseAnalyticsRepository.listAppointments).mockResolvedValue([]);

    await renderPage();

    expect(kpiValue("Completion rate")).toBe("—");
    expect(screen.getAllByText("No appointments were scheduled in this period.")).toHaveLength(4);
    expect(screen.getAllByText("No visits in this period have reached their scheduled time yet.")).toHaveLength(2);
    expect(screen.queryByRole("table", { name: "Peak days and times" })).not.toBeInTheDocument();
  });

  it("passes the URL filters to the metric layer and keeps them on the export links", async () => {
    await renderPage({ range: "last_3_months", department: DEPARTMENT_ID });

    expect(supabaseAnalyticsRepository.listAppointments).toHaveBeenCalledWith({
      start: "2026-08-31T16:00:00.000Z",
      end: "2026-11-30T16:00:00.000Z",
      doctorId: null,
      departmentId: DEPARTMENT_ID,
    });
    expect(screen.getByRole("link", { name: "Monthly volume" })).toHaveAttribute(
      "href",
      `/api/admin/analytics/export?range=last_3_months&department=${DEPARTMENT_ID}&dataset=monthly`,
    );
    expect(screen.getByLabelText("Range")).toHaveValue("last_3_months");
    expect(screen.getByLabelText("Department")).toHaveValue(DEPARTMENT_ID);
  });
});
