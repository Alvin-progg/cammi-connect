import { render, screen } from "@testing-library/react";
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

/** The card's final value: CountUp's screen-reader text, or the plain value text. */
function kpiValue(label: string) {
  const value = screen.getByRole("group", { name: label }).querySelector("[data-kpi-value]");
  return value?.querySelector(".sr-only")?.textContent ?? value?.textContent;
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

  it("shows the reference KPIs over the outcome cohort with the pending snapshot", async () => {
    await renderPage();

    expect(kpiValue("Appointments this year")).toBe("4");
    expect(screen.getByText("Nov is the busiest month (4)")).toBeInTheDocument();
    expect(kpiValue("Completed, Nov")).toBe("75.0%");
    expect(screen.getByText("3 of 4 appointments")).toBeInTheDocument();
    expect(kpiValue("Cancelled · No-show, Nov")).toBe("0.0% · 25.0%");
    expect(screen.getByText("0 cancelled · 1 no-show")).toBeInTheDocument();
    expect(kpiValue("Peak slot")).toBe("Mon 9–11");
    expect(screen.getByText("4 appointments")).toBeInTheDocument();
    expect(screen.getByText(/2 pending confirmation now/)).toBeInTheDocument();
    expect(screen.getAllByText("Rates based on few appointments.").length).toBeGreaterThan(0);
  });

  it("renders the six reference charts with data tables, the timezone, and the association disclaimer", async () => {
    await renderPage();

    for (const title of [
      "Monthly appointment volume",
      "Appointments per doctor",
      "Peak consultation days and times",
      "Monthly appointment outcomes",
      "Cancellation and no-show rate by weekday",
      "Cancellation and no-show rate by doctor",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByRole("table", { name: "Monthly appointment volume data" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Monthly appointment outcomes data" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Peak days and times" })).toBeInTheDocument();
    expect(screen.getByText(/Times in Asia\/Manila/)).toBeInTheDocument();
    expect(screen.getByText("Patterns show association, not cause.")).toBeInTheDocument();
    // Takeaways are written from the data.
    expect(screen.getByText("Monday 9–11 AM peaks at 4; Monday 11 AM–1 PM is quietest (0).")).toBeInTheDocument();
  });

  it("shows empty states and no rates when the period has no appointments", async () => {
    vi.mocked(supabaseAnalyticsRepository.listAppointments).mockResolvedValue([]);

    await renderPage();

    expect(kpiValue("Completed")).toBe("—");
    expect(kpiValue("Peak slot")).toBe("—");
    expect(screen.getAllByText("No appointments were scheduled in this period.")).toHaveLength(3);
    expect(screen.getAllByText("No visits in this period have finished yet.")).toHaveLength(3);
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
