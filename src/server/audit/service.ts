import "server-only";

import { redactSensitive, type JsonValue } from "@/lib/audit/redact";

type AuditPayload = { [key: string]: JsonValue };

export type AdminAuditEvent = {
  /** The acting admin's profile ID, taken from the session, never from input. */
  actorProfileId: string;
  /** Dotted verb, e.g. `department.update`. */
  action: string;
  targetType: string;
  targetId: string;
  previousValues?: AuditPayload | null;
  newValues?: AuditPayload | null;
  reason?: string | null;
};

export type AuditLogRow = {
  actorProfileId: string;
  action: string;
  targetType: string;
  targetId: string;
  previousValues: JsonValue;
  newValues: JsonValue;
  reason: string | null;
};

/** Append-only write access to `audit_logs`. */
export type AuditLogWriter = {
  insert(row: AuditLogRow): Promise<void>;
};

/** Records an admin change, stripping credential-like keys from both payloads. */
export async function recordAdminAudit(
  event: AdminAuditEvent,
  writer: AuditLogWriter,
): Promise<void> {
  await writer.insert({
    actorProfileId: event.actorProfileId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    previousValues: redactSensitive(event.previousValues ?? null),
    newValues: redactSensitive(event.newValues ?? null),
    reason: event.reason ?? null,
  });
}
