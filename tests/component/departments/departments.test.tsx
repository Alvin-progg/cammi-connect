import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DepartmentForm } from "@/components/departments/department-form";
import { DepartmentStatusForm } from "@/components/departments/department-status";
import { DepartmentsTable } from "@/components/departments/departments-table";
import type { Department } from "@/lib/directory/types";
import { setDepartmentActiveAction } from "@/server/departments/actions";

vi.mock("@/server/departments/actions", () => ({
  saveDepartmentAction: vi.fn(),
  setDepartmentActiveAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const CARDIOLOGY: Department = {
  id: "00000000-0000-4000-8000-000000000501",
  name: "Cardiology",
  code: "CARD",
  description: "Heart care",
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DepartmentsTable", () => {
  it("lists departments with status, doctor count, and recent appointments", () => {
    render(
      <DepartmentsTable
        departments={[
          { ...CARDIOLOGY, doctorCount: 2, recentAppointmentCount: 14 },
          {
            ...CARDIOLOGY,
            id: "00000000-0000-4000-8000-000000000509",
            name: "Closed Ward",
            code: "CW",
            isActive: false,
            doctorCount: 0,
            recentAppointmentCount: 0,
          },
        ]}
      />,
    );

    const rows = within(screen.getByRole("table", { name: "Departments" })).getAllByRole("row");
    expect(within(rows[1]).getByRole("link", { name: "Cardiology" })).toHaveAttribute(
      "href",
      `/admin/departments/${CARDIOLOGY.id}`,
    );
    expect(rows[1]).toHaveTextContent("CARD");
    expect(rows[1]).toHaveTextContent("Active");
    expect(rows[1]).toHaveTextContent("2");
    expect(rows[1]).toHaveTextContent("14");
    expect(rows[2]).toHaveTextContent("Inactive");
  });

  it("shows an empty state", () => {
    render(<DepartmentsTable departments={[]} />);
    expect(screen.getByText("No departments yet.")).toBeInTheDocument();
  });
});

describe("DepartmentForm", () => {
  it("edits name, code, and description, without an active checkbox", () => {
    render(<DepartmentForm department={CARDIOLOGY} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Cardiology");
    expect(screen.getByLabelText("Code")).toHaveValue("CARD");
    expect(screen.getByLabelText("Description")).toHaveValue("Heart care");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save department" })).toBeInTheDocument();
  });

  it("creates a new department", () => {
    render(<DepartmentForm />);
    expect(screen.getByRole("button", { name: "Create department" })).toBeInTheDocument();
  });
});

describe("DepartmentStatusForm", () => {
  it("offers deactivation and lists the appointments that block it", async () => {
    const user = userEvent.setup();
    vi.mocked(setDepartmentActiveAction).mockResolvedValue({
      status: "error",
      message: "This department has upcoming appointments.",
      conflicts: [
        {
          appointmentId: "00000000-0000-4000-8000-000000000201",
          scheduledAt: "2026-11-10T01:00:00Z",
          status: "confirmed",
          doctorName: "Dr. Maya Santos",
        },
      ],
    });
    render(<DepartmentStatusForm department={CARDIOLOGY} />);

    await user.click(screen.getByRole("button", { name: "Deactivate department" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("upcoming appointments");
    });
    const conflicts = screen.getByRole("list", { name: "Blocking appointments" });
    expect(conflicts).toHaveTextContent("Dr. Maya Santos");
    expect(conflicts).toHaveTextContent("Confirmed");
  });

  it("offers activation for an inactive department", () => {
    render(<DepartmentStatusForm department={{ ...CARDIOLOGY, isActive: false }} />);
    expect(screen.getByRole("button", { name: "Activate department" })).toBeInTheDocument();
  });
});
