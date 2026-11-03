import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SpecialtyDoctors } from "@/components/specialties/specialty-doctors";
import { SpecialtyForm } from "@/components/specialties/specialty-form";
import { SpecialtyStatusForm } from "@/components/specialties/specialty-status";
import { SpecialtiesTable } from "@/components/specialties/specialties-table";
import type { Specialty } from "@/lib/directory/types";

vi.mock("@/server/specialties/actions", () => ({
  saveSpecialtyAction: vi.fn(),
  setSpecialtyActiveAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const CARDIOLOGY: Specialty = {
  id: "00000000-0000-4000-8000-000000000701",
  name: "Cardiology",
  description: "Heart conditions",
  isActive: true,
};

describe("SpecialtiesTable", () => {
  it("lists specialties with status and doctor count", () => {
    render(
      <SpecialtiesTable
        specialties={[
          { ...CARDIOLOGY, doctorCount: 3 },
          { ...CARDIOLOGY, id: "00000000-0000-4000-8000-000000000709", name: "Retired", isActive: false, doctorCount: 0 },
        ]}
      />,
    );

    const rows = within(screen.getByRole("table", { name: "Specialties" })).getAllByRole("row");
    expect(within(rows[1]).getByRole("link", { name: "Cardiology" })).toHaveAttribute(
      "href",
      `/admin/specialties/${CARDIOLOGY.id}`,
    );
    expect(rows[1]).toHaveTextContent("Active");
    expect(rows[1]).toHaveTextContent("3");
    expect(rows[2]).toHaveTextContent("Inactive");
  });

  it("shows an empty state", () => {
    render(<SpecialtiesTable specialties={[]} />);
    expect(screen.getByText("No specialties yet.")).toBeInTheDocument();
  });
});

describe("SpecialtyForm", () => {
  it("edits name and description without an active checkbox", () => {
    render(<SpecialtyForm specialty={CARDIOLOGY} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Cardiology");
    expect(screen.getByLabelText("Description")).toHaveValue("Heart conditions");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save specialty" })).toBeInTheDocument();
  });

  it("creates a new specialty", () => {
    render(<SpecialtyForm />);
    expect(screen.getByRole("button", { name: "Create specialty" })).toBeInTheDocument();
  });
});

describe("SpecialtyStatusForm", () => {
  it("offers deactivation and explains that doctors keep the specialty", () => {
    render(<SpecialtyStatusForm specialty={CARDIOLOGY} />);

    expect(screen.getByRole("button", { name: "Deactivate specialty" })).toBeInTheDocument();
    expect(screen.getByText(/hidden from patients/)).toBeInTheDocument();
  });

  it("offers activation for an inactive specialty", () => {
    render(<SpecialtyStatusForm specialty={{ ...CARDIOLOGY, isActive: false }} />);
    expect(screen.getByRole("button", { name: "Activate specialty" })).toBeInTheDocument();
  });
});

describe("SpecialtyDoctors", () => {
  it("lists the doctors with the specialty", () => {
    render(
      <SpecialtyDoctors
        specialtyId={CARDIOLOGY.id}
        doctors={[
          {
            id: "00000000-0000-4000-8000-000000000101",
            fullName: "Dr. Maya Santos",
            departmentId: null,
            departmentName: null,
            isActive: true,
            specialties: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("Dr. Maya Santos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage doctors" })).toHaveAttribute(
      "href",
      `/admin/doctors?specialty=${CARDIOLOGY.id}`,
    );
  });

  it("renders an empty state when no doctor has it", () => {
    render(<SpecialtyDoctors specialtyId={CARDIOLOGY.id} doctors={[]} />);
    expect(screen.getByText("No doctors have this specialty yet.")).toBeInTheDocument();
  });
});
