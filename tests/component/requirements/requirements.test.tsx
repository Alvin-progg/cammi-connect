import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RequirementForm } from "@/components/requirements/requirement-form";
import { RequirementLifecycle } from "@/components/requirements/requirement-lifecycle";
import { RequirementSummary } from "@/components/requirements/requirement-summary";
import { RequirementsList } from "@/components/requirements/requirements-list";
import type { Specialty } from "@/lib/directory/types";
import type { AppointmentRequirement } from "@/lib/requirements/types";
import type { HospitalService } from "@/lib/services/types";

vi.mock("@/server/requirements/actions", () => ({
  saveRequirementAction: vi.fn(),
  publishRequirementAction: vi.fn(),
  archiveRequirementAction: vi.fn(),
  supersedeRequirementAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const TODAY = "2026-11-05";

const XRAY: HospitalService = {
  id: "00000000-0000-4000-8000-000000000801",
  name: "X-ray",
  description: null,
  departmentId: null,
  departmentName: null,
  requiresAppointment: false,
  bookingMode: "walk_in",
  isActive: true,
};
const RETIRED_SERVICE: HospitalService = {
  ...XRAY,
  id: "00000000-0000-4000-8000-000000000809",
  name: "Retired scan",
  isActive: false,
};
const CARDIOLOGY: Specialty = {
  id: "00000000-0000-4000-8000-000000000201",
  name: "Cardiology",
  description: null,
  isActive: true,
};

const VALID_ID: AppointmentRequirement = {
  id: "00000000-0000-4000-8000-000000000901",
  title: "Valid ID",
  description: "Any government-issued ID",
  target: { kind: "service", id: XRAY.id, name: "X-ray" },
  isMandatory: true,
  effectiveFrom: "2026-11-01",
  effectiveTo: null,
  status: "published",
  supersededBy: null,
};
const REFERRAL: AppointmentRequirement = {
  ...VALID_ID,
  id: "00000000-0000-4000-8000-000000000902",
  title: "Referral letter",
  description: null,
  target: { kind: "specialty", id: CARDIOLOGY.id, name: "Cardiology" },
  isMandatory: false,
  status: "draft",
};

describe("RequirementsList", () => {
  it("groups requirements under their service or specialty", () => {
    render(<RequirementsList requirements={[REFERRAL, VALID_ID]} today={TODAY} />);

    const service = screen.getByRole("region", { name: "X-ray" });
    expect(within(service).getByRole("link", { name: "Valid ID" })).toHaveAttribute(
      "href",
      `/admin/requirements/${VALID_ID.id}`,
    );
    expect(service).toHaveTextContent("Published");
    expect(service).toHaveTextContent("In effect");
    expect(service).toHaveTextContent("Mandatory");

    const specialty = screen.getByRole("region", { name: "Cardiology" });
    expect(specialty).toHaveTextContent("Specialty");
    expect(specialty).toHaveTextContent("Draft");
    expect(specialty).toHaveTextContent("Optional");
    expect(specialty).not.toHaveTextContent("In effect");
  });

  it("can list without grouping", () => {
    render(<RequirementsList requirements={[VALID_ID]} today={TODAY} grouped={false} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Valid ID" })).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<RequirementsList requirements={[]} today={TODAY} />);
    expect(screen.getByText("No requirements match.")).toBeInTheDocument();
  });
});

describe("RequirementForm", () => {
  it("offers active services and specialties and prefills a new requirement", () => {
    render(
      <RequirementForm
        services={[XRAY, RETIRED_SERVICE]}
        specialties={[CARDIOLOGY]}
        defaultTarget={`specialty:${CARDIOLOGY.id}`}
        today={TODAY}
      />,
    );

    expect(screen.getByLabelText("Applies to")).toHaveValue(`specialty:${CARDIOLOGY.id}`);
    expect(screen.getByRole("option", { name: "X-ray" })).toHaveValue(`service:${XRAY.id}`);
    expect(screen.queryByRole("option", { name: /Retired scan/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Effective from")).toHaveValue(TODAY);
    expect(screen.getByRole("checkbox", { name: "Mandatory" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Create draft" })).toBeInTheDocument();
  });

  it("edits a draft, keeping its own inactive target", () => {
    render(
      <RequirementForm
        requirement={{
          ...REFERRAL,
          target: { kind: "service", id: RETIRED_SERVICE.id, name: RETIRED_SERVICE.name },
          effectiveTo: "2026-12-31",
        }}
        services={[XRAY, RETIRED_SERVICE]}
        specialties={[CARDIOLOGY]}
        today={TODAY}
      />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Referral letter");
    expect(screen.getByLabelText("Applies to")).toHaveValue(`service:${RETIRED_SERVICE.id}`);
    expect(screen.getByRole("option", { name: "Retired scan (inactive)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Effective until (optional)")).toHaveValue("2026-12-31");
    expect(screen.getByRole("checkbox", { name: "Mandatory" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
  });
});

describe("RequirementSummary", () => {
  it("shows a published requirement read-only", () => {
    render(<RequirementSummary requirement={VALID_ID} />);
    expect(screen.getByText("Any government-issued ID")).toBeInTheDocument();
    expect(screen.getByText("X-ray")).toBeInTheDocument();
    expect(screen.getByText("No end date")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("RequirementLifecycle", () => {
  it("offers publish and archive for a draft", () => {
    render(<RequirementLifecycle requirement={REFERRAL} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supersede" })).not.toBeInTheDocument();
  });

  it("offers supersede and archive for a published requirement", () => {
    render(<RequirementLifecycle requirement={VALID_ID} />);
    expect(screen.getByLabelText("New version starts on")).toBeRequired();
    expect(screen.getByRole("button", { name: "Supersede" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("links to the newer version instead of superseding twice", () => {
    const next = "00000000-0000-4000-8000-000000000903";
    render(
      <RequirementLifecycle
        requirement={{ ...VALID_ID, supersededBy: next }}
        successorStatus="draft"
      />,
    );
    expect(screen.getByText(/replaces this one when it ends/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the newer version" })).toHaveAttribute(
      "href",
      `/admin/requirements/${next}`,
    );
    expect(screen.queryByRole("button", { name: "Supersede" })).not.toBeInTheDocument();
  });

  it("offers supersede again once the newer version was archived", () => {
    const next = "00000000-0000-4000-8000-000000000903";
    render(
      <RequirementLifecycle
        requirement={{ ...VALID_ID, supersededBy: next }}
        successorStatus="archived"
      />,
    );
    expect(screen.queryByText(/replaces this one when it ends/)).not.toBeInTheDocument();
    expect(screen.getByText(/newer version was archived/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the archived version" })).toHaveAttribute(
      "href",
      `/admin/requirements/${next}`,
    );
    expect(screen.getByRole("button", { name: "Supersede" })).toBeInTheDocument();
  });

  it("offers nothing for an archived requirement", () => {
    render(<RequirementLifecycle requirement={{ ...VALID_ID, status: "archived" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/stays on record/)).toBeInTheDocument();
  });
});
