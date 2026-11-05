// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import {
  archiveRequirementAction,
  publishRequirementAction,
  saveRequirementAction,
  supersedeRequirementAction,
} from "@/server/requirements/actions";
import {
  archiveRequirement,
  publishRequirement,
  saveRequirement,
  supersedeRequirement,
} from "@/server/requirements/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/requirements/repository", () => ({ supabaseRequirementAdminRepository: {} }));
vi.mock("@/server/requirements/service", () => ({
  saveRequirement: vi.fn(),
  publishRequirement: vi.fn(),
  archiveRequirement: vi.fn(),
  supersedeRequirement: vi.fn(),
}));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const SERVICE_ID = "00000000-0000-4000-8000-000000000801";
const REQUIREMENT_ID = "00000000-0000-4000-8000-000000000901";
const NEXT_ID = "00000000-0000-4000-8000-000000000902";

const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
};

const FORM_FIELDS = {
  title: " Valid ID ",
  description: "",
  target: `service:${SERVICE_ID}`,
  isMandatory: "on",
  effectiveFrom: "2026-11-05",
  effectiveTo: "",
};

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
  vi.mocked(saveRequirement).mockResolvedValue({
    ok: true,
    requirementId: REQUIREMENT_ID,
    message: "Requirement saved.",
  });
  vi.mocked(publishRequirement).mockResolvedValue({ ok: true, message: "Requirement published." });
  vi.mocked(archiveRequirement).mockResolvedValue({ ok: true, message: "Requirement archived." });
  vi.mocked(supersedeRequirement).mockResolvedValue({
    ok: true,
    requirementId: NEXT_ID,
    message: "New draft created.",
  });
});

describe("requirement actions", () => {
  it("denies non-admin accounts without calling the service layer", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = { status: "error", message: "You are not authorized to manage requirements." };
    const idOnly = formData({ requirementId: REQUIREMENT_ID, startsOn: "2027-01-01" });

    await expect(saveRequirementAction(IDLE, formData(FORM_FIELDS))).resolves.toEqual(denied);
    await expect(publishRequirementAction(IDLE, idOnly)).resolves.toEqual(denied);
    await expect(archiveRequirementAction(IDLE, idOnly)).resolves.toEqual(denied);
    await expect(supersedeRequirementAction(IDLE, idOnly)).resolves.toEqual(denied);
    expect(saveRequirement).not.toHaveBeenCalled();
    expect(publishRequirement).not.toHaveBeenCalled();
    expect(archiveRequirement).not.toHaveBeenCalled();
    expect(supersedeRequirement).not.toHaveBeenCalled();
  });

  it("creates a requirement as the session admin and opens it", async () => {
    await saveRequirementAction(IDLE, formData({ ...FORM_FIELDS, actorId: "forged" }));

    expect(saveRequirement).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        requirementId: null,
        input: {
          title: "Valid ID",
          description: null,
          target: { kind: "service", id: SERVICE_ID },
          isMandatory: true,
          effectiveFrom: "2026-11-05",
          effectiveTo: null,
        },
      },
      expect.anything(),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(redirect).toHaveBeenCalledWith(`/admin/requirements/${REQUIREMENT_ID}`);
  });

  it("updates a draft in place, reading a missing checkbox as optional", async () => {
    const data = formData({ ...FORM_FIELDS, requirementId: REQUIREMENT_ID });
    data.delete("isMandatory");
    await expect(saveRequirementAction(IDLE, data)).resolves.toEqual({ status: "success", message: "Requirement saved." });
    expect(vi.mocked(saveRequirement).mock.calls[0][0]).toMatchObject({
      requirementId: REQUIREMENT_ID,
      input: { isMandatory: false },
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns validation errors without saving", async () => {
    await expect(
      saveRequirementAction(IDLE, formData({ ...FORM_FIELDS, target: "" })),
    ).resolves.toEqual({ status: "error", message: "Choose a service or specialty." });
    expect(saveRequirement).not.toHaveBeenCalled();
  });

  it("rejects a malformed requirement id", async () => {
    const invalid = { status: "error", message: "That requirement is not valid." };
    const bad = formData({ ...FORM_FIELDS, requirementId: "nope", startsOn: "2027-01-01" });
    await expect(saveRequirementAction(IDLE, bad)).resolves.toEqual(invalid);
    await expect(publishRequirementAction(IDLE, bad)).resolves.toEqual(invalid);
    await expect(archiveRequirementAction(IDLE, bad)).resolves.toEqual(invalid);
    await expect(supersedeRequirementAction(IDLE, bad)).resolves.toEqual(invalid);
  });

  it("publishes and archives as the session admin", async () => {
    const data = formData({ requirementId: REQUIREMENT_ID });
    await expect(publishRequirementAction(IDLE, data)).resolves.toEqual({
      status: "success",
      message: "Requirement published.",
    });
    await expect(archiveRequirementAction(IDLE, data)).resolves.toEqual({
      status: "success",
      message: "Requirement archived.",
    });
    const expected = { actorId: ADMIN_ID, requirementId: REQUIREMENT_ID };
    expect(publishRequirement).toHaveBeenCalledWith(expected, expect.anything());
    expect(archiveRequirement).toHaveBeenCalledWith(expected, expect.anything());
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("passes a lifecycle refusal through without revalidating", async () => {
    vi.mocked(publishRequirement).mockResolvedValue({
      ok: false,
      message: "Only a draft can be published.",
    });
    await expect(
      publishRequirementAction(IDLE, formData({ requirementId: REQUIREMENT_ID })),
    ).resolves.toEqual({ status: "error", message: "Only a draft can be published." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("supersedes and opens the new draft", async () => {
    await supersedeRequirementAction(
      IDLE,
      formData({ requirementId: REQUIREMENT_ID, startsOn: "2027-01-01" }),
    );
    expect(supersedeRequirement).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, requirementId: REQUIREMENT_ID, startsOn: "2027-01-01" },
      expect.anything(),
    );
    expect(redirect).toHaveBeenCalledWith(`/admin/requirements/${NEXT_ID}`);
  });

  it("requires a start date to supersede", async () => {
    await expect(
      supersedeRequirementAction(IDLE, formData({ requirementId: REQUIREMENT_ID, startsOn: "" })),
    ).resolves.toEqual({ status: "error", message: "Enter the date the new version starts." });
    expect(supersedeRequirement).not.toHaveBeenCalled();
  });
});
