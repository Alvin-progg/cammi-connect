import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminDashboardPage from "@/app/admin/page";
import type { AnalyticsAppointment } from "@/lib/analytics/metrics";
import { supabaseAnalyticsRepository } from "@/server/analytics/repository";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/analytics/repository", () => ({
  supabaseAnalyticsRepository: {
    listAppointments: vi.fn(),
    countPending: vi.fn(),
    countCancelledBetween: vi.fn(),
    pendingSummary: vi.fn(),
    listRecentAppointmentActivity: vi.fn(),
    listRecentAdminActivity: vi.fn(),
  },
}));
vi.mock("@/server/directory/repository", () => ({
  supabaseDirectoryRepository: { listDoctors: vi.fn(), listDepartments: vi.fn() },
}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000101";

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
  render(await AdminDashboardPage({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) }));
}

function card(label: string) {
  return screen.getByRole("group", { name: label });
}

describe("admin dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Thursday 2026-11-05, noon Manila.
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
    // Current period: 3 completed + 1 no-show; previous period: 2 completed.
    vi.mocked(supabaseAnalyticsRepository.listAppointments).mockImplementation(async ({ start }) =>
      start === "2026-10-31T16:00:00.000Z"
        ? [row("completed", 1), row("completed", 2), row("completed", 3), row("no_show", 4)]
        : [row("completed", 5), row("completed", 6)],
    );
    vi.mocked(supabaseAnalyticsRepository.countCancelledBetween).mockResolvedValue(1);
    vi.mocked(supabaseAnalyticsRepository.pendingSummary).mockResolvedValue({
      count: 2,
      oldestCreatedAt: "2026-11-03T04:00:00.000Z",
      byDepartment: [{ departmentName: "Synthetic Medicine", count: 2 }],
    });
    vi.mocked(supabaseAnalyticsRepository.listRecentAppointmentActivity).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000301",
        appointmentId: APPOINTMENT_ID,
        action: "confirmed",
        previousStatus: "requested",
        newStatus: "confirmed",
        actorName: "Synthetic Front Desk",
        createdAt: "2026-11-05T02:00:00.000Z",
      },
    ]);
    vi.mocked(supabaseAnalyticsRepository.listRecentAdminActivity).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000401",
        action: "department.update",
        targetType: "department",
        actorName: "Synthetic Admin",
        createdAt: "2026-11-05T01:00:00.000Z",
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("denies non-admins without reading anything", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);

    await renderPage();

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(getAdminSession).toHaveBeenCalledWith("/admin");
    expect(supabaseAnalyticsRepository.listAppointments).not.toHaveBeenCalled();
  });

  it("shows the six cards with their date basis and the trend against the previous period", async () => {
    await renderPage();

    expect(within(card("Total appointments")).getByText("4")).toBeInTheDocument();
    expect(within(card("Total appointments")).getByText("Scheduled in range")).toBeInTheDocument();
    expect(within(card("Total appointments")).getByText(/▲ 100.00% vs previous period/)).toBeInTheDocument();
    expect(within(card("Pending requests")).getByText("2")).toBeInTheDocument();
    expect(within(card("Pending requests")).getByText("Right now")).toBeInTheDocument();
    expect(within(card("Completed")).getByText("3")).toBeInTheDocument();
    expect(within(card("No-show")).getByText("1")).toBeInTheDocument();
    expect(within(card("Confirmed")).getByText("0")).toBeInTheDocument();
    expect(within(card("Cancelled")).getByText("1")).toBeInTheDocument();
    expect(within(card("Cancelled")).getByText("Cancelled in range")).toBeInTheDocument();
  });

  it("has no interpretation Summary card (it lives on the analytics page only)", async () => {
    // Data that would raise an alert on the analytics page.
    vi.mocked(supabaseAnalyticsRepository.listAppointments).mockResolvedValue([
      ...Array.from({ length: 20 }, (_, index) => row("completed", index)),
      ...Array.from({ length: 5 }, (_, index) => row("no_show", 20 + index)),
    ]);

    await renderPage();

    expect(screen.queryByRole("region", { name: "Summary" })).not.toBeInTheDocument();
  });

  it("links each card to the appointment list with matching filters", async () => {
    await renderPage({ range: "today", doctor: DOCTOR_ID });

    expect(within(card("Pending requests")).getByRole("link")).toHaveAttribute(
      "href",
      `/admin/appointments?doctor=${DOCTOR_ID}&status=requested`,
    );
    expect(within(card("Completed")).getByRole("link")).toHaveAttribute(
      "href",
      `/admin/appointments?doctor=${DOCTOR_ID}&status=completed&from=2026-11-05&to=2026-11-05`,
    );
    expect(within(card("Total appointments")).getByRole("link")).toHaveAttribute(
      "href",
      `/admin/appointments?doctor=${DOCTOR_ID}&from=2026-11-05&to=2026-11-05`,
    );
  });

  it("greets the admin by first name with the Manila date", async () => {
    // 12:00 in Manila on Thursday 2026-11-05.
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Good afternoon, Synthetic" })).toBeInTheDocument();
    expect(screen.getByText(/Thursday, November 5/)).toHaveTextContent("Asia/Manila");
  });

  it("offers the period as a segmented control that keeps the doctor and department filters", async () => {
    await renderPage({ doctor: DOCTOR_ID });

    const period = screen.getByRole("navigation", { name: "Dashboard period" });
    expect(within(period).getByRole("link", { name: "This month" })).toHaveAttribute("aria-current", "page");
    expect(within(period).getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      `/admin?range=today&doctor=${DOCTOR_ID}`,
    );
    expect(within(period).getByRole("link", { name: "This week" })).toHaveAttribute(
      "href",
      `/admin?range=this_week&doctor=${DOCTOR_ID}`,
    );
  });

  it("shows needs attention from the front desk queue, with a review link", async () => {
    await renderPage();

    const attention = screen.getByRole("region", { name: "Needs attention" });
    expect(within(attention).getByText("2 requests waiting for confirmation")).toBeInTheDocument();
    expect(within(attention).getByText(/Oldest waiting since/)).toBeInTheDocument();
    expect(within(attention).getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/admin/appointments?status=requested",
    );
    expect(within(attention).getByText("Synthetic Medicine")).toBeInTheDocument();
  });

  it("shows top doctors and both activity feeds as tables", async () => {
    await renderPage();

    const doctors = screen.getByRole("table", { name: "Doctor performance" });
    expect(within(doctors).getByText("Dr. Synthetic Alpha")).toBeInTheDocument();
    expect(within(doctors).getByText("25.00%")).toBeInTheDocument();

    const appointmentActivity = screen.getByRole("region", { name: "Recent appointment activity" });
    expect(within(appointmentActivity).getByRole("columnheader", { name: "Actor" })).toBeInTheDocument();
    expect(within(appointmentActivity).getByRole("link")).toHaveAttribute("href", `/admin/appointments/${APPOINTMENT_ID}`);
    expect(within(appointmentActivity).getByText(/Synthetic Front Desk/)).toBeInTheDocument();

    const systemActivity = screen.getByRole("region", { name: "System activity" });
    expect(within(systemActivity).getByRole("columnheader", { name: "Action" })).toBeInTheDocument();
    expect(within(systemActivity).getByText("department.update")).toBeInTheDocument();
  });

  it("shows empty states when there is nothing to show", async () => {
    vi.mocked(supabaseAnalyticsRepository.listAppointments).mockResolvedValue([]);
    vi.mocked(supabaseAnalyticsRepository.listRecentAppointmentActivity).mockResolvedValue([]);
    vi.mocked(supabaseAnalyticsRepository.listRecentAdminActivity).mockResolvedValue([]);
    vi.mocked(supabaseAnalyticsRepository.pendingSummary).mockResolvedValue({
      count: 0,
      oldestCreatedAt: null,
      byDepartment: [],
    });

    await renderPage();

    expect(within(card("Total appointments")).getByText("No previous data to compare")).toBeInTheDocument();
    expect(screen.getAllByText("No appointments were scheduled in this period.").length).toBeGreaterThan(0);
    expect(screen.getByText("No pending requests.")).toBeInTheDocument();
    expect(screen.getByText("No appointment activity yet.")).toBeInTheDocument();
    expect(screen.getByText("No admin activity yet.")).toBeInTheDocument();
  });
});
