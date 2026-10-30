import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DepartmentForm, DoctorForm } from "@/components/admin/directory-forms";
import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";

vi.mock("@/server/directory/actions", () => ({
  saveDepartmentAction: vi.fn(),
  saveSpecialtyAction: vi.fn(),
  saveDoctorAction: vi.fn(),
}));

const CARDIOLOGY: Department = {
  id: "00000000-0000-4000-8000-000000000501",
  name: "Cardiology",
  code: "CARD",
  description: null,
  isActive: true,
};
const CLOSED: Department = { ...CARDIOLOGY, id: "00000000-0000-4000-8000-000000000509", name: "Closed Ward", code: "CW", isActive: false };

const IM: Specialty = { id: "00000000-0000-4000-8000-000000000701", name: "Internal Medicine", description: null, isActive: true };
const CARDIO: Specialty = { id: "00000000-0000-4000-8000-000000000702", name: "Cardiology", description: null, isActive: true };
const RETIRED: Specialty = { id: "00000000-0000-4000-8000-000000000709", name: "Retired Specialty", description: null, isActive: false };

const DOCTOR: DoctorSummary = {
  id: "00000000-0000-4000-8000-000000000101",
  fullName: "Dr. Paolo Reyes",
  departmentId: CARDIOLOGY.id,
  departmentName: "Cardiology",
  isActive: true,
  specialties: [{ id: IM.id, name: IM.name }, { id: CARDIO.id, name: CARDIO.name }],
};

describe("DoctorForm", () => {
  it("creates a doctor with an optional linked account and several specialties", () => {
    render(
      <DoctorForm
        departments={[CARDIOLOGY, CLOSED]}
        specialties={[IM, CARDIO, RETIRED]}
        linkableAccounts={[{ profileId: "00000000-0000-4000-8000-000000000001", fullName: "Synthetic Account" }]}
      />,
    );

    const form = screen.getByRole("form", { name: "Add doctor" });
    expect(within(form).getByLabelText("Login account")).toBeInTheDocument();
    expect(
      within(within(form).getByLabelText("Department")).getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["No department", "Cardiology"]);
    const specialtyBoxes = within(form).getAllByRole("checkbox", { name: /Internal Medicine|Cardiology|Retired/ });
    expect(specialtyBoxes.map((box) => box.getAttribute("value"))).toEqual([IM.id, CARDIO.id]);
  });

  it("edits a doctor with their current specialties checked and no account picker", () => {
    render(
      <DoctorForm doctor={DOCTOR} departments={[CARDIOLOGY]} specialties={[IM, CARDIO]} linkableAccounts={[]} />,
    );

    const form = screen.getByRole("form", { name: "Edit Dr. Paolo Reyes" });
    expect(within(form).queryByLabelText("Login account")).toBeNull();
    expect(within(form).getByRole("checkbox", { name: "Internal Medicine" })).toBeChecked();
    expect(within(form).getByRole("checkbox", { name: "Cardiology" })).toBeChecked();
    expect(form.querySelector('input[name="doctorId"]')).toHaveValue(DOCTOR.id);
  });

  it("keeps a currently assigned inactive department and specialty selectable", () => {
    render(
      <DoctorForm
        doctor={{
          ...DOCTOR,
          departmentId: CLOSED.id,
          specialties: [{ id: RETIRED.id, name: RETIRED.name }],
        }}
        departments={[CARDIOLOGY, CLOSED]}
        specialties={[IM, RETIRED]}
        linkableAccounts={[]}
      />,
    );

    expect(screen.getByRole("option", { name: "Closed Ward (inactive)" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Retired Specialty (inactive)" })).toBeChecked();
  });
});

describe("DepartmentForm", () => {
  it("edits an existing department", () => {
    render(<DepartmentForm department={CARDIOLOGY} />);

    const form = screen.getByRole("form", { name: "Edit Cardiology" });
    expect(within(form).getByLabelText("Name")).toHaveValue("Cardiology");
    expect(within(form).getByLabelText("Code")).toHaveValue("CARD");
    expect(within(form).getByRole("checkbox", { name: "Active" })).toBeChecked();
    expect(form.querySelector('input[name="departmentId"]')).toHaveValue(CARDIOLOGY.id);
  });

  it("adds a new department", () => {
    render(<DepartmentForm />);

    expect(screen.getByRole("form", { name: "Add department" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add department" })).toBeInTheDocument();
  });
});
