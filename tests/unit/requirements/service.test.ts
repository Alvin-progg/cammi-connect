// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentRequirement } from "@/lib/requirements/types";
import {
  archiveRequirement,
  getRequirementDetail,
  listRequirements,
  publishRequirement,
  saveRequirement,
  supersedeRequirement,
  type RequirementAdminStore,
} from "@/server/requirements/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const SERVICE_ID = "00000000-0000-4000-8000-000000000801";
const REQUIREMENT_ID = "00000000-0000-4000-8000-000000000901";
const NEXT_ID = "00000000-0000-4000-8000-000000000902";

const VALID_ID: AppointmentRequirement = {
  id: REQUIREMENT_ID,
  title: "Valid ID",
  description: null,
  target: { kind: "service", id: SERVICE_ID, name: "X-ray" },
  isMandatory: true,
  effectiveFrom: "2026-11-01",
  effectiveTo: null,
  status: "published",
  supersededBy: null,
};

const FORM_INPUT = {
  title: "Valid ID",
  description: null,
  target: { kind: "service", id: SERVICE_ID },
  isMandatory: true,
  effectiveFrom: "2026-11-01",
  effectiveTo: null,
} as const;

function fakeStore() {
  return {
    listRequirements: vi.fn().mockResolvedValue([VALID_ID]),
    getRequirement: vi.fn().mockResolvedValue(VALID_ID),
    save: vi.fn().mockResolvedValue({ ok: true, requirementId: REQUIREMENT_ID }),
    publish: vi.fn().mockResolvedValue({ ok: true }),
    archive: vi.fn().mockResolvedValue({ ok: true }),
    supersede: vi.fn().mockResolvedValue({ ok: true, requirementId: NEXT_ID }),
  } satisfies RequirementAdminStore;
}

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
});

describe("reads", () => {
  it("passes list filters to the store", async () => {
    const filters = { status: "published", kind: "service", serviceId: SERVICE_ID } as const;
    await expect(listRequirements(filters, store)).resolves.toEqual([VALID_ID]);
    expect(store.listRequirements).toHaveBeenCalledWith(filters);
  });

  it("loads one requirement", async () => {
    await expect(getRequirementDetail(REQUIREMENT_ID, store)).resolves.toEqual(VALID_ID);
    expect(store.getRequirement).toHaveBeenCalledWith(REQUIREMENT_ID);
  });
});

describe("saveRequirement", () => {
  it("saves as the given actor", async () => {
    await expect(
      saveRequirement({ actorId: ADMIN_ID, requirementId: null, input: FORM_INPUT }, store),
    ).resolves.toEqual({ ok: true, requirementId: REQUIREMENT_ID, message: "Requirement saved." });
    expect(store.save).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      requirementId: null,
      ...FORM_INPUT,
    });
  });

  it.each([
    ["not_draft", "Only a draft can be edited. Supersede a published requirement instead."],
    ["inactive_target", "Choose an active service or specialty."],
    ["not_found", "That requirement no longer exists."],
    ["not_admin", "Only an active administrator can manage requirements."],
    [undefined, "Something went wrong. Try again."],
    ["unexpected", "Something went wrong. Try again."],
  ])("maps the refusal %s to a message", async (code, message) => {
    store.save.mockResolvedValue({ ok: false, code });
    await expect(
      saveRequirement({ actorId: ADMIN_ID, requirementId: REQUIREMENT_ID, input: FORM_INPUT }, store),
    ).resolves.toEqual({ ok: false, message });
  });
});

describe("lifecycle", () => {
  const input = { actorId: ADMIN_ID, requirementId: REQUIREMENT_ID };

  it("publishes and archives", async () => {
    await expect(publishRequirement(input, store)).resolves.toEqual({
      ok: true,
      message: "Requirement published.",
    });
    await expect(archiveRequirement(input, store)).resolves.toEqual({
      ok: true,
      message: "Requirement archived.",
    });
    expect(store.publish).toHaveBeenCalledWith(input);
    expect(store.archive).toHaveBeenCalledWith(input);
  });

  it("refuses to publish a non-draft or archive twice", async () => {
    store.publish.mockResolvedValue({ ok: false, code: "not_draft" });
    store.archive.mockResolvedValue({ ok: false, code: "already_archived" });
    await expect(publishRequirement(input, store)).resolves.toEqual({
      ok: false,
      message: "Only a draft can be published.",
    });
    await expect(archiveRequirement(input, store)).resolves.toEqual({
      ok: false,
      message: "That requirement is already archived.",
    });
  });

  it("supersedes into a new draft", async () => {
    await expect(
      supersedeRequirement({ ...input, startsOn: "2027-01-01" }, store),
    ).resolves.toEqual({
      ok: true,
      requirementId: NEXT_ID,
      message: "New draft created. The current requirement ends the day before it starts.",
    });
    expect(store.supersede).toHaveBeenCalledWith({ ...input, startsOn: "2027-01-01" });
  });

  it.each([
    ["not_published", "Only a published requirement can be superseded."],
    [
      "already_superseded",
      "That requirement already has a newer version. Archive that version to supersede again.",
    ],
    [
      "invalid_date",
      "The new version must start after the current one starts, and no later than it ends.",
    ],
  ])("maps the supersede refusal %s", async (code, message) => {
    store.supersede.mockResolvedValue({ ok: false, code });
    await expect(
      supersedeRequirement({ ...input, startsOn: "2027-01-01" }, store),
    ).resolves.toEqual({ ok: false, message });
  });
});
