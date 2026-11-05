import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ServiceForm } from "@/components/services/service-form";
import { ServicePublishPlaceholder } from "@/components/services/service-publish";
import { ServiceStatusForm } from "@/components/services/service-status";
import { ServicesTable } from "@/components/services/services-table";
import type { Department } from "@/lib/directory/types";
import type { HospitalService } from "@/lib/services/types";

vi.mock("@/server/services/actions", () => ({
  saveServiceAction: vi.fn(),
  setServiceActiveAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const RADIOLOGY: Department = {
  id: "00000000-0000-4000-8000-000000000301",
  name: "Radiology",
  code: "RAD",
  description: null,
  isActive: true,
};
const CLOSED_WING: Department = {
  ...RADIOLOGY,
  id: "00000000-0000-4000-8000-000000000309",
  name: "Closed Wing",
  code: "CLW",
  isActive: false,
};

const XRAY: HospitalService = {
  id: "00000000-0000-4000-8000-000000000801",
  name: "X-ray",
  description: "Chest and limb imaging",
  departmentId: RADIOLOGY.id,
  departmentName: "Radiology",
  requiresAppointment: true,
  bookingMode: "walk_in",
  isActive: true,
};

describe("ServicesTable", () => {
  it("lists services with department, access, and status", () => {
    render(
      <ServicesTable
        services={[
          XRAY,
          {
            ...XRAY,
            id: "00000000-0000-4000-8000-000000000809",
            name: "Retired",
            departmentId: null,
            departmentName: null,
            requiresAppointment: false,
            bookingMode: "none",
            isActive: false,
          },
        ]}
      />,
    );

    const rows = within(screen.getByRole("table", { name: "Services" })).getAllByRole("row");
    expect(within(rows[1]).getByRole("link", { name: "X-ray" })).toHaveAttribute(
      "href",
      `/admin/services/${XRAY.id}`,
    );
    expect(rows[1]).toHaveTextContent("Radiology");
    expect(rows[1]).toHaveTextContent("Walk-in");
    expect(rows[1]).toHaveTextContent("Required");
    expect(rows[1]).toHaveTextContent("Active");
    expect(rows[2]).toHaveTextContent("No department");
    expect(rows[2]).toHaveTextContent("Informational only");
    expect(rows[2]).toHaveTextContent("Not required");
    expect(rows[2]).toHaveTextContent("Inactive");
  });

  it("shows an empty state", () => {
    render(<ServicesTable services={[]} />);
    expect(screen.getByText("No services match.")).toBeInTheDocument();
  });
});

describe("ServiceForm", () => {
  it("edits every field of an existing service", () => {
    render(<ServiceForm service={XRAY} departments={[RADIOLOGY]} />);

    expect(screen.getByLabelText("Name")).toHaveValue("X-ray");
    expect(screen.getByLabelText("Description")).toHaveValue("Chest and limb imaging");
    expect(screen.getByLabelText("Department")).toHaveValue(RADIOLOGY.id);
    expect(screen.getByLabelText("How patients access it")).toHaveValue("walk_in");
    expect(screen.getByRole("checkbox", { name: "Requires an appointment" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save service" })).toBeInTheDocument();
  });

  it("offers only active departments, plus the service's own inactive one", () => {
    const { unmount } = render(<ServiceForm departments={[RADIOLOGY, CLOSED_WING]} />);
    expect(screen.queryByRole("option", { name: /Closed Wing/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create service" })).toBeInTheDocument();
    unmount();

    render(
      <ServiceForm
        service={{ ...XRAY, departmentId: CLOSED_WING.id, departmentName: CLOSED_WING.name }}
        departments={[RADIOLOGY, CLOSED_WING]}
      />,
    );
    expect(screen.getByRole("option", { name: "Closed Wing (inactive)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Department")).toHaveValue(CLOSED_WING.id);
  });
});

describe("ServiceStatusForm", () => {
  it("offers deactivation for an active service", () => {
    render(<ServiceStatusForm service={XRAY} />);
    expect(screen.getByRole("button", { name: "Deactivate service" })).toBeInTheDocument();
  });

  it("offers activation for an inactive service", () => {
    render(<ServiceStatusForm service={{ ...XRAY, isActive: false }} />);
    expect(screen.getByRole("button", { name: "Activate service" })).toBeInTheDocument();
  });
});

describe("ServicePublishPlaceholder", () => {
  it("shows a disabled publish button until the knowledge base exists", () => {
    render(<ServicePublishPlaceholder />);
    expect(screen.getByRole("button", { name: "Publish to Cami AI" })).toBeDisabled();
  });
});
