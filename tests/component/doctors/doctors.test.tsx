import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DoctorAccount } from "@/components/doctors/doctor-account";
import { DoctorAppointments } from "@/components/doctors/doctor-appointments";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { DoctorStatusForm } from "@/components/doctors/doctor-status";
import { DoctorTabs } from "@/components/doctors/doctor-tabs";
import { DoctorsTable } from "@/components/doctors/doctors-table";
import type { Department, Specialty } from "@/lib/directory/types";
import type { AdminDoctorDetail } from "@/lib/doctors/types";
import { linkDoctorAccountAction, setDoctorActiveAction } from "@/server/doctors/actions";

vi.mock("@/server/doctors/actions", () => ({
  saveDoctorAction: vi.fn(),
  linkDoctorAccountAction: vi.fn(),
  setDoctorActiveAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const CARDIOLOGY: Department = {
  id: "00000000-0000-4000-8000-000000000501",
  name: "Cardiology",
  code: "CARD",
  description: null,
  isActive: true,
};
const CLOSED_WARD: Department = {
  ...CARDIOLOGY,
  id: "00000000-0000-4000-8000-000000000509",
  name: "Closed Ward",
  code: "CW",
  isActive: false,
};
const INTERNAL_MEDICINE: Specialty = {
  id: "00000000-0000-4000-8000-000000000701",
  name: "Internal Medicine",
  description: null,
  isActive: true,
};
const CARDIO: Specialty = { ...INTERNAL_MEDICINE, id: "00000000-0000-4000-8000-000000000702", name: "Cardiology" };
const RETIRED: Specialty = {
  ...INTERNAL_MEDICINE,
  id: "00000000-0000-4000-8000-000000000709",
  name: "Retired Specialty",
  isActive: false,
};

const DOCTOR: AdminDoctorDetail = {
  id: "00000000-0000-4000-8000-000000000101",
  fullName: "Dr. Maya Santos",
  departmentId: CARDIOLOGY.id,
  departmentName: "Cardiology",
  isActive: true,
  specialties: [
    { id: INTERNAL_MEDICINE.id, name: "Internal Medicine" },
    { id: CARDIO.id, name: "Cardiology" },
  ],
  hasLogin: false,
  contactEmail: "maya.santos@example.test",
  contactPhone: null,
  bio: "Synthetic bio.",
};
const ACCOUNT = { profileId: "00000000-0000-4000-8000-000000000011", fullName: "Dr. Invited Account" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DoctorsTable", () => {
  it("lists doctors with department, specialty chips, status, and login", () => {
    render(
      <DoctorsTable
        doctors={[
          DOCTOR,
          {
            ...DOCTOR,
            id: "00000000-0000-4000-8000-000000000102",
            fullName: "Dr. Paolo Reyes",
            isActive: false,
            hasLogin: true,
          },
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: "Doctors" });
    const [, maya, paolo] = within(table).getAllByRole("row");
    expect(within(maya).getByRole("link", { name: "Dr. Maya Santos" })).toHaveAttribute(
      "href",
      `/admin/doctors/${DOCTOR.id}`,
    );
    expect(within(maya).getByRole("list", { name: "Specialties" })).toHaveTextContent(
      "Internal MedicineCardiology",
    );
    expect(maya).toHaveTextContent("Active");
    expect(maya).toHaveTextContent("No login");
    expect(paolo).toHaveTextContent("Inactive");
    expect(paolo).toHaveTextContent("Linked");
  });

  it("shows an empty state", () => {
    render(<DoctorsTable doctors={[]} />);
    expect(screen.getByText("No doctors match these filters.")).toBeInTheDocument();
  });
});

describe("DoctorForm", () => {
  it("creates a doctor with active departments, specialties, contact, bio, and an optional account", () => {
    render(
      <DoctorForm
        departments={[CARDIOLOGY, CLOSED_WARD]}
        specialties={[INTERNAL_MEDICINE, CARDIO, RETIRED]}
        linkableAccounts={[ACCOUNT]}
      />,
    );

    const department = screen.getByLabelText("Department");
    expect(within(department).getByRole("option", { name: "Cardiology" })).toBeInTheDocument();
    expect(within(department).queryByRole("option", { name: "Closed Ward" })).toBeNull();
    const specialties = screen.getByRole("group", { name: "Specialties" });
    expect(within(specialties).getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByLabelText("Contact email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Contact phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
    const account = screen.getByLabelText("Linked account");
    expect(within(account).getByRole("option", { name: "No login (directory only)" })).toHaveValue("");
    expect(within(account).getByRole("option", { name: "Dr. Invited Account" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /active/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Create doctor" })).toBeInTheDocument();
  });

  it("edits a doctor with current values, keeping an inactive department and specialty selectable", () => {
    render(
      <DoctorForm
        doctor={{
          ...DOCTOR,
          departmentId: CLOSED_WARD.id,
          departmentName: "Closed Ward",
          specialties: [{ id: RETIRED.id, name: "Retired Specialty" }],
        }}
        departments={[CARDIOLOGY, CLOSED_WARD]}
        specialties={[INTERNAL_MEDICINE, CARDIO, RETIRED]}
      />,
    );

    expect(screen.getByLabelText("Full name")).toHaveValue("Dr. Maya Santos");
    expect(screen.getByLabelText("Department")).toHaveValue(CLOSED_WARD.id);
    expect(screen.getByRole("checkbox", { name: "Retired Specialty (inactive)" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cardiology" })).not.toBeChecked();
    expect(screen.getByLabelText("Contact email")).toHaveValue("maya.santos@example.test");
    expect(screen.getByLabelText("Bio")).toHaveValue("Synthetic bio.");
    expect(screen.queryByLabelText("Linked account")).toBeNull();
    expect(screen.getByRole("button", { name: "Save doctor" })).toBeInTheDocument();
  });
});

describe("DoctorStatusForm", () => {
  it("offers deactivation and lists the appointments that block it", async () => {
    const user = userEvent.setup();
    vi.mocked(setDoctorActiveAction).mockResolvedValue({
      status: "error",
      message: "This doctor has upcoming appointments.",
      conflicts: [
        {
          appointmentId: "00000000-0000-4000-8000-000000000201",
          scheduledAt: "2026-11-10T01:00:00Z",
          status: "confirmed",
        },
      ],
    });
    render(<DoctorStatusForm doctor={DOCTOR} />);

    await user.click(screen.getByRole("button", { name: "Deactivate doctor" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("upcoming appointments");
    });
    expect(screen.getByRole("list", { name: "Blocking appointments" })).toHaveTextContent("Confirmed");
  });

  it("offers activation for an inactive doctor", () => {
    render(<DoctorStatusForm doctor={{ ...DOCTOR, isActive: false }} />);
    expect(screen.getByRole("button", { name: "Activate doctor" })).toBeInTheDocument();
  });
});

describe("DoctorAccount", () => {
  it("says when the doctor already signs in", () => {
    render(<DoctorAccount doctor={{ ...DOCTOR, hasLogin: true }} linkableAccounts={[ACCOUNT]} />);
    expect(screen.getByText(/has a sign-in account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link account" })).toBeNull();
  });

  it("links an unlinked doctor account", async () => {
    const user = userEvent.setup();
    vi.mocked(linkDoctorAccountAction).mockResolvedValue({ status: "success", message: "Account linked." });
    render(<DoctorAccount doctor={DOCTOR} linkableAccounts={[ACCOUNT]} />);

    await user.selectOptions(screen.getByLabelText("Doctor account"), ACCOUNT.profileId);
    await user.click(screen.getByRole("button", { name: "Link account" }));

    await waitFor(() => {
      expect(linkDoctorAccountAction).toHaveBeenCalled();
    });
    const submitted = vi.mocked(linkDoctorAccountAction).mock.calls[0][1];
    expect(submitted.get("doctorId")).toBe(DOCTOR.id);
    expect(submitted.get("accountProfileId")).toBe(ACCOUNT.profileId);
  });

  it("explains how to get a linkable account when there is none", () => {
    render(<DoctorAccount doctor={DOCTOR} linkableAccounts={[]} />);
    expect(screen.getByText(/Invite a doctor account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link account" })).toBeNull();
  });
});

describe("DoctorTabs", () => {
  it("links the three tabs and marks the open one", () => {
    render(<DoctorTabs doctorId={DOCTOR.id} active="appointments" />);
    const nav = screen.getByRole("navigation", { name: "Doctor sections" });
    expect(within(nav).getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      `/admin/doctors/${DOCTOR.id}`,
    );
    expect(within(nav).getByRole("link", { name: "Schedule" })).toHaveAttribute(
      "href",
      `/admin/doctors/${DOCTOR.id}?tab=schedule`,
    );
    expect(within(nav).getByRole("link", { name: "Appointments" })).toHaveAttribute("aria-current", "page");
  });
});

describe("DoctorAppointments", () => {
  it("lists appointment history without patient data", () => {
    render(
      <DoctorAppointments
        appointments={[
          {
            appointmentId: "00000000-0000-4000-8000-000000000201",
            scheduledAt: "2026-10-01T01:00:00Z",
            status: "completed",
            specialtyName: "Cardiology",
          },
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "Appointment history" });
    expect(table).toHaveTextContent("Completed");
    expect(table).toHaveTextContent("Cardiology");
  });

  it("shows an empty state", () => {
    render(<DoctorAppointments appointments={[]} />);
    expect(screen.getByText("No appointments yet.")).toBeInTheDocument();
  });
});
