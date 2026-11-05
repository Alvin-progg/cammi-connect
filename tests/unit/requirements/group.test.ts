import { describe, expect, it } from "vitest";

import { groupRequirementsByTarget } from "@/lib/requirements/group";
import type { AppointmentRequirement } from "@/lib/requirements/types";

function requirement(
  id: string,
  target: AppointmentRequirement["target"],
): AppointmentRequirement {
  return {
    id,
    title: `Requirement ${id}`,
    description: null,
    target,
    isMandatory: true,
    effectiveFrom: "2026-11-01",
    effectiveTo: null,
    status: "draft",
    supersededBy: null,
  };
}

describe("groupRequirementsByTarget", () => {
  it("groups by target, services first, then by name, keeping input order inside a group", () => {
    const xray = { kind: "service", id: "s-xray", name: "X-ray" } as const;
    const lab = { kind: "service", id: "s-lab", name: "Laboratory" } as const;
    const cardio = { kind: "specialty", id: "p-cardio", name: "Cardiology" } as const;

    const groups = groupRequirementsByTarget([
      requirement("1", cardio),
      requirement("2", xray),
      requirement("3", lab),
      requirement("4", xray),
    ]);

    expect(groups.map((group) => group.target.name)).toEqual(["Laboratory", "X-ray", "Cardiology"]);
    expect(groups[1].requirements.map((item) => item.id)).toEqual(["2", "4"]);
  });

  it("returns no groups for no requirements", () => {
    expect(groupRequirementsByTarget([])).toEqual([]);
  });
});
