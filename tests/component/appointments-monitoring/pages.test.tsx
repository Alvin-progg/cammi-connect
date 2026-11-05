import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminAppointmentPage from "@/app/admin/appointments/[id]/page";
import AdminAppointmentsPage from "@/app/admin/appointments/page";
import { supabaseAppointmentMonitoringRepository } from "@/server/appointments-monitoring/repository";
import { getAdminSession } from "@/server/auth/dal";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/appointments-monitoring/repository", () => ({
  supabaseAppointmentMonitoringRepository: {
    listAppointments: vi.fn(),
    getAppointment: vi.fn(),
  },
}));
vi.mock("@/server/directory/repository", () => ({
  supabaseDirectoryRepository: { listDoctors: vi.fn(), listDepartments: vi.fn() },
}));

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000100";

describe("admin appointment monitoring pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A signed-in front desk, doctor, or patient account: the guard returns null.
    vi.mocked(getAdminSession).mockResolvedValue(null);
  });

  it("denies the list to non-admins without reading appointments", async () => {
    render(await AdminAppointmentsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(getAdminSession).toHaveBeenCalledWith("/admin/appointments");
    expect(supabaseAppointmentMonitoringRepository.listAppointments).not.toHaveBeenCalled();
  });

  it("denies the details to non-admins without reading the appointment", async () => {
    render(
      await AdminAppointmentPage({
        params: Promise.resolve({ id: APPOINTMENT_ID }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(supabaseAppointmentMonitoringRepository.getAppointment).not.toHaveBeenCalled();
  });
});
