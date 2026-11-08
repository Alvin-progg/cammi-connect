import "server-only";

import {
  AUDIT_LOG_PAGE_SIZE,
  type AuditLogEntry,
  type AuditLogFilters,
} from "@/lib/audit/log";
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

/** Read access to `audit_logs` for the viewer. There is no update or delete. */
export type AuditLogReader = {
  /** Newest first; `total` counts every entry matching the filters. */
  list(query: {
    filters: AuditLogFilters;
    offset: number;
    limit: number;
  }): Promise<{ items: AuditLogEntry[]; total: number }>;
  get(id: string): Promise<AuditLogEntry | null>;
};

/** PostgREST returns at most 1,000 rows per request by default. */
export const AUDIT_READ_BATCH = 1000;
/** Larger exports are refused; the admin narrows the filters instead. */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

export function listAuditLogs(
  filters: AuditLogFilters,
  reader: AuditLogReader,
): Promise<{ items: AuditLogEntry[]; total: number }> {
  return reader.list({
    filters,
    offset: (filters.page - 1) * AUDIT_LOG_PAGE_SIZE,
    limit: AUDIT_LOG_PAGE_SIZE,
  });
}

export function getAuditLog(id: string, reader: AuditLogReader): Promise<AuditLogEntry | null> {
  return reader.get(id);
}

/** Every entry matching the filters, read in batches, or a refusal over the row cap. */
export async function loadAuditLogExport(
  filters: AuditLogFilters,
  reader: AuditLogReader,
): Promise<{ ok: true; entries: AuditLogEntry[] } | { ok: false; total: number }> {
  const first = await reader.list({ filters, offset: 0, limit: AUDIT_READ_BATCH });
  if (first.total > AUDIT_EXPORT_MAX_ROWS) {
    return { ok: false, total: first.total };
  }

  const entries = [...first.items];
  while (entries.length < first.total) {
    const next = await reader.list({ filters, offset: entries.length, limit: AUDIT_READ_BATCH });
    // Never loop forever if the count and the rows disagree.
    if (next.items.length === 0) break;
    entries.push(...next.items);
  }
  return { ok: true, entries };
}
