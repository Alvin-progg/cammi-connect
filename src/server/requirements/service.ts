import "server-only";

import {
  requirementRefusalFromCode,
  type RequirementRefusal,
} from "@/lib/requirements/refusals";
import type { RequirementFormInput } from "@/lib/requirements/schemas";
import type {
  AppointmentRequirement,
  RequirementKindFilter,
  RequirementStatusFilter,
} from "@/lib/requirements/types";

type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };
type CreatedOutcome = { ok: true; requirementId: string } | { ok: false; code: string | undefined };

export type RequirementListFilters = {
  status: RequirementStatusFilter;
  kind: RequirementKindFilter;
  serviceId?: string;
};

type LifecycleInput = { actorId: string; requirementId: string };

/**
 * Data access for admin requirement management. Callers authorize first, and
 * `actorId` must come from the admin session.
 */
export type RequirementAdminStore = {
  listRequirements(filters: RequirementListFilters): Promise<AppointmentRequirement[]>;
  getRequirement(requirementId: string): Promise<AppointmentRequirement | null>;
  save(
    input: { actorId: string; requirementId: string | null } & RequirementFormInput,
  ): Promise<CreatedOutcome>;
  publish(input: LifecycleInput): Promise<DatabaseOutcome>;
  archive(input: LifecycleInput): Promise<DatabaseOutcome>;
  supersede(input: LifecycleInput & { startsOn: string }): Promise<CreatedOutcome>;
};

const REFUSAL_MESSAGES: Record<RequirementRefusal, string> = {
  not_admin: "Only an active administrator can manage requirements.",
  not_found: "That requirement no longer exists.",
  not_draft: "Only a draft can be edited. Supersede a published requirement instead.",
  not_published: "Only a published requirement can be superseded.",
  already_archived: "That requirement is already archived.",
  already_superseded:
    "That requirement already has a newer version. Archive that version to supersede again.",
  inactive_target: "Choose an active service or specialty.",
  invalid_date:
    "The new version must start after the current one starts, and no later than it ends.",
};

const GENERIC_FAILURE = "Something went wrong. Try again.";

function refusalMessage(
  code: string | undefined,
  overrides: Partial<Record<RequirementRefusal, string>> = {},
): string {
  const refusal = requirementRefusalFromCode(code);
  return refusal ? (overrides[refusal] ?? REFUSAL_MESSAGES[refusal]) : GENERIC_FAILURE;
}

type Result = { ok: true; message: string } | { ok: false; message: string };
type CreatedResult = { ok: true; requirementId: string; message: string } | { ok: false; message: string };

export function listRequirements(
  filters: RequirementListFilters,
  store: RequirementAdminStore,
): Promise<AppointmentRequirement[]> {
  return store.listRequirements(filters);
}

export function getRequirementDetail(
  requirementId: string,
  store: RequirementAdminStore,
): Promise<AppointmentRequirement | null> {
  return store.getRequirement(requirementId);
}

/** Creates a draft, or edits one. Published and archived requirements are refused. */
export async function saveRequirement(
  {
    actorId,
    requirementId,
    input,
  }: { actorId: string; requirementId: string | null; input: RequirementFormInput },
  store: RequirementAdminStore,
): Promise<CreatedResult> {
  const saved = await store.save({ actorId, requirementId, ...input });
  if (!saved.ok) {
    return { ok: false, message: refusalMessage(saved.code) };
  }
  return { ok: true, requirementId: saved.requirementId, message: "Requirement saved." };
}

export async function publishRequirement(
  input: LifecycleInput,
  store: RequirementAdminStore,
): Promise<Result> {
  const outcome = await store.publish(input);
  if (!outcome.ok) {
    return {
      ok: false,
      message: refusalMessage(outcome.code, { not_draft: "Only a draft can be published." }),
    };
  }
  return { ok: true, message: "Requirement published." };
}

export async function archiveRequirement(
  input: LifecycleInput,
  store: RequirementAdminStore,
): Promise<Result> {
  const outcome = await store.archive(input);
  if (!outcome.ok) {
    return { ok: false, message: refusalMessage(outcome.code) };
  }
  return { ok: true, message: "Requirement archived." };
}

/**
 * Ends a published requirement the day before `startsOn` and clones it into a
 * new draft starting that day. The current version stays published until then.
 */
export async function supersedeRequirement(
  input: LifecycleInput & { startsOn: string },
  store: RequirementAdminStore,
): Promise<CreatedResult> {
  const outcome = await store.supersede(input);
  if (!outcome.ok) {
    return { ok: false, message: refusalMessage(outcome.code) };
  }
  return {
    ok: true,
    requirementId: outcome.requirementId,
    message: "New draft created. The current requirement ends the day before it starts.",
  };
}
