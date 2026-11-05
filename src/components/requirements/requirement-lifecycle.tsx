"use client";

import Link from "next/link";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AppointmentRequirement, RequirementStatus } from "@/lib/requirements/types";
import {
  archiveRequirementAction,
  publishRequirementAction,
  supersedeRequirementAction,
  type RequirementActionState,
} from "@/server/requirements/actions";

const IDLE_STATE: RequirementActionState = { status: "idle" };

function PublishForm({ requirementId }: { requirementId: string }) {
  const { state, formAction, pending } = useAdminForm(publishRequirementAction, IDLE_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requirementId" value={requirementId} />
      <p className="text-sm text-ink-secondary">
        Publishing makes the requirement official. After that it can&apos;t be edited, only
        superseded by a new version or archived.
      </p>
      <FormFooter state={state} pending={pending} label="Publish" pendingLabel="Publishing…" />
    </form>
  );
}

function SupersedeForm({ requirementId }: { requirementId: string }) {
  const { state, formAction, pending } = useAdminForm(supersedeRequirementAction, IDLE_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requirementId" value={requirementId} />
      <p className="text-sm text-ink-secondary">
        To change a published requirement, supersede it. This version ends the day before the new
        one starts, and a copy opens as a draft for you to edit and publish.
      </p>
      <Field id="requirement-starts-on" label="New version starts on">
        <input
          id="requirement-starts-on"
          name="startsOn"
          type="date"
          required
          className={`${FIELD_CLASS} max-w-xs`}
        />
      </Field>
      <FormFooter
        state={state}
        pending={pending}
        label="Supersede"
        pendingLabel="Creating…"
        variant="secondary"
      />
    </form>
  );
}

function ArchiveForm({ requirementId }: { requirementId: string }) {
  const { state, formAction, pending } = useAdminForm(archiveRequirementAction, IDLE_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requirementId" value={requirementId} />
      <p className="text-sm text-ink-secondary">
        Archiving withdraws the requirement for good. It stays on record.
      </p>
      <FormFooter
        state={state}
        pending={pending}
        label="Archive"
        pendingLabel="Archiving…"
        variant="outlineDanger"
      />
    </form>
  );
}

const LINK_CLASS =
  "rounded font-medium text-primary underline-offset-4 focus-ring hover:underline";

/**
 * The status actions a requirement allows: draft → published → archived, plus
 * supersede. A published requirement whose newer version is still pending
 * links to it; once that version is archived, it can be superseded again.
 */
export function RequirementLifecycle({
  requirement,
  successorStatus = null,
}: {
  requirement: AppointmentRequirement;
  /** Status of the version that superseded this one, if any. */
  successorStatus?: RequirementStatus | null;
}) {
  if (requirement.status === "archived") {
    return (
      <p className="text-sm text-ink-secondary">
        This requirement is archived. It stays on record and can&apos;t be changed.
      </p>
    );
  }

  const successorHref = requirement.supersededBy
    ? `/admin/requirements/${requirement.supersededBy}`
    : null;
  const isPublished = requirement.status === "published";
  const successorPending = successorHref !== null && successorStatus !== "archived";

  return (
    <div className="flex flex-col gap-6">
      {requirement.status === "draft" ? <PublishForm requirementId={requirement.id} /> : null}
      {isPublished && successorHref && successorPending ? (
        <p className="text-sm text-ink-secondary">
          A newer version replaces this one when it ends.{" "}
          <Link href={successorHref} className={LINK_CLASS}>
            Open the newer version
          </Link>
        </p>
      ) : null}
      {isPublished && successorHref && !successorPending ? (
        <p className="text-sm text-ink-secondary">
          The newer version was archived, so nothing replaces this one yet.{" "}
          <Link href={successorHref} className={LINK_CLASS}>
            Open the archived version
          </Link>
        </p>
      ) : null}
      {isPublished && !successorPending ? <SupersedeForm requirementId={requirement.id} /> : null}
      <ArchiveForm requirementId={requirement.id} />
    </div>
  );
}
