import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InviteStaffForm } from "@/components/users/invite-form";
import {
  PasswordResetForm,
  UserRoleForm,
  UserStatusForm,
} from "@/components/users/user-forms";
import type { AdminUserDetail } from "@/lib/users/types";

vi.mock("@/server/users/actions", () => ({
  changeUserRoleAction: vi.fn(),
  inviteStaffAction: vi.fn(),
  sendPasswordResetAction: vi.fn(),
  setUserActiveAction: vi.fn(),
  updateUserProfileAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const USER: AdminUserDetail = {
  id: "00000000-0000-4000-8000-000000000002",
  fullName: "Synthetic Desk",
  email: "desk@example.test",
  phone: null,
  role: "front_desk",
  isActive: true,
  createdAt: "2026-10-01T02:00:00Z",
  lastSignInAt: null,
  hasDoctorRecord: false,
};

describe("InviteStaffForm", () => {
  it("offers only staff roles", () => {
    render(<InviteStaffForm />);

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Front desk", "Doctor", "Administrator"]);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeInTheDocument();
  });
});

describe("UserRoleForm", () => {
  it("asks for the new role and a reason", () => {
    render(<UserRoleForm user={USER} isSelf={false} />);

    expect(screen.getByLabelText("Role")).toHaveValue("front_desk");
    expect(screen.getByLabelText("Reason")).toBeRequired();
    expect(screen.getByRole("button", { name: "Change role" })).toBeInTheDocument();
  });

  it("points doctors with a directory record to the Doctors section", () => {
    render(<UserRoleForm user={{ ...USER, role: "doctor", hasDoctorRecord: true }} isSelf={false} />);

    expect(screen.queryByRole("button", { name: "Change role" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Doctors" })).toHaveAttribute("href", "/admin/doctors");
  });

  it("does not let an admin change their own role", () => {
    render(<UserRoleForm user={{ ...USER, role: "admin" }} isSelf />);

    expect(screen.queryByRole("button", { name: "Change role" })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot change your own role/)).toBeInTheDocument();
  });
});

describe("UserStatusForm", () => {
  it("offers deactivation for an active account", () => {
    render(<UserStatusForm user={USER} isSelf={false} />);
    expect(screen.getByRole("button", { name: "Deactivate account" })).toBeInTheDocument();
  });

  it("offers activation for an inactive account", () => {
    render(<UserStatusForm user={{ ...USER, isActive: false }} isSelf={false} />);
    expect(screen.getByRole("button", { name: "Activate account" })).toBeInTheDocument();
  });

  it("does not let an admin deactivate themselves", () => {
    render(<UserStatusForm user={{ ...USER, role: "admin" }} isSelf />);
    expect(screen.queryByRole("button", { name: "Deactivate account" })).not.toBeInTheDocument();
  });
});

describe("PasswordResetForm", () => {
  it("sends a reset email without ever asking for a password", () => {
    render(<PasswordResetForm user={USER} />);

    expect(screen.getByRole("button", { name: "Send password reset email" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
