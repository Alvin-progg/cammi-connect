import { z } from "zod";

import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { MANILA_TIME_ZONE, isValidManilaDate, manilaDayRange } from "@/lib/appointments/filters";
import { toCsv } from "@/lib/analytics/csv";

import type { JsonValue } from "./redact";

/** The read-only admin audit log viewer (ADM-16 Part A). */
export const AUDIT_LOG_PATH = "/admin/audit-log";
export const AUDIT_LOG_EXPORT_PATH = "/api/admin/audit-log/export";
export const AUDIT_LOG_PAGE_SIZE = 25;

/** Action prefixes in use (`<prefix>.<verb>`); the filter matches `<prefix>.%`. */
export const AUDIT_ACTION_PREFIXES = [
  "user",
  "department",
  "specialty",
  "doctor",
  "schedule",
  "schedule_exception",
  "service",
  "requirement",
  "knowledge",
  "settings",
  "analytics",
  "audit",
] as const;

export type AuditActionPrefix = (typeof AUDIT_ACTION_PREFIXES)[number];

export const AUDIT_ACTION_PREFIX_LABELS: Record<AuditActionPrefix, string> = {
  user: "Users and roles",
  department: "Departments",
  specialty: "Specialties",
  doctor: "Doctors",
  schedule: "Schedules",
  schedule_exception: "Schedule exceptions",
  service: "Services",
  requirement: "Requirements",
  knowledge: "Knowledge base",
  settings: "Settings",
  analytics: "Analytics exports",
  audit: "Audit log exports",
};

export const AUDIT_TARGET_TYPES = [
  "user",
  "department",
  "specialty",
  "doctor",
  "schedule",
  "schedule_exception",
  "service",
  "requirement",
  "knowledge_document",
  "system_settings",
  "analytics",
  "audit_logs",
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const AUDIT_TARGET_TYPE_LABELS: Record<AuditTargetType, string> = {
  user: "User",
  department: "Department",
  specialty: "Specialty",
  doctor: "Doctor",
  schedule: "Schedule",
  schedule_exception: "Schedule exception",
  service: "Service",
  requirement: "Requirement",
  knowledge_document: "Knowledge document",
  system_settings: "Settings",
  analytics: "Analytics",
  audit_logs: "Audit log",
};

/** A readable target type; an unknown type (from a future slice) shows as stored. */
export function auditTargetLabel(targetType: string): string {
  return (AUDIT_TARGET_TYPE_LABELS as Record<string, string>)[targetType] ?? targetType;
}

export type AuditLogFilters = {
  actorId: string | null;
  actionPrefix: AuditActionPrefix | null;
  targetType: AuditTargetType | null;
  /** Manila calendar dates ("YYYY-MM-DD") of the event, both inclusive. */
  from: string | null;
  to: string | null;
  page: number;
};

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  actorProfileId: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  previousValues: JsonValue;
  newValues: JsonValue;
};

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseManilaDate(value: SearchParam): string | null {
  const date = firstValue(value);
  return date && isValidManilaDate(date) ? date : null;
}

/** Audit log filters from search params; anything unknown falls back to "all". */
export function parseAuditLogFilters(params: {
  actor?: SearchParam;
  action?: SearchParam;
  target?: SearchParam;
  from?: SearchParam;
  to?: SearchParam;
  page?: SearchParam;
}): AuditLogFilters {
  const actionPrefix = z.enum(AUDIT_ACTION_PREFIXES).safeParse(firstValue(params.action));
  const targetType = z.enum(AUDIT_TARGET_TYPES).safeParse(firstValue(params.target));
  const page = z.coerce.number().int().min(1).safeParse(firstValue(params.page));

  let from = parseManilaDate(params.from);
  let to = parseManilaDate(params.to);
  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  return {
    actorId: parseRecordIdParam(params.actor),
    actionPrefix: actionPrefix.success ? actionPrefix.data : null,
    targetType: targetType.success ? targetType.data : null,
    from,
    to,
    page: page.success ? page.data : 1,
  };
}

/** UTC bounds of the date filter: start of `from`, end of `to` (exclusive). */
export function auditLogDateBounds(
  filters: Pick<AuditLogFilters, "from" | "to">,
): { start: string | null; end: string | null } {
  return {
    start: filters.from ? manilaDayRange(filters.from).start.toISOString() : null,
    end: filters.to ? manilaDayRange(filters.to).end.toISOString() : null,
  };
}

function filterParams(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.actorId) params.set("actor", filters.actorId);
  if (filters.actionPrefix) params.set("action", filters.actionPrefix);
  if (filters.targetType) params.set("target", filters.targetType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

export function auditLogListHref(filters: AuditLogFilters, page = filters.page): string {
  const params = filterParams(filters);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${AUDIT_LOG_PATH}?${query}` : AUDIT_LOG_PATH;
}

/** The CSV export of every entry matching the filters (not just one page). */
export function auditLogExportHref(filters: AuditLogFilters): string {
  const query = filterParams(filters).toString();
  return query ? `${AUDIT_LOG_EXPORT_PATH}?${query}` : AUDIT_LOG_EXPORT_PATH;
}

const TARGET_PAGES: Partial<Record<string, string>> = {
  user: "/admin/users",
  department: "/admin/departments",
  specialty: "/admin/specialties",
  doctor: "/admin/doctors",
  service: "/admin/services",
  requirement: "/admin/requirements",
  knowledge_document: "/admin/knowledge-base",
};

/** The admin page of an audited record, or null when it has none. */
export function auditTargetHref(targetType: string, targetId: string): string | null {
  if (targetType === "system_settings") return "/admin/settings";
  const base = TARGET_PAGES[targetType];
  return base && z.uuid().safeParse(targetId).success ? `${base}/${targetId}` : null;
}

export type AuditValueRow = {
  key: string;
  previous: JsonValue | undefined;
  next: JsonValue | undefined;
  changed: boolean;
};

function asRecord(value: JsonValue | null): Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Previous and new values side by side, one row per key in either, sorted by key. */
export function diffAuditValues(previous: JsonValue | null, next: JsonValue | null): AuditValueRow[] {
  const before = asRecord(previous);
  const after = asRecord(next);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.map((key) => ({
    key,
    previous: before[key],
    next: after[key],
    changed: JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  }));
}

/** "2026-11-08 09:05": sortable, unambiguous, Manila time. */
const CSV_TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function jsonCell(value: JsonValue): string | null {
  return value === null ? null : JSON.stringify(value);
}

/** The CSV export. Cells go through `toCsv`, which neutralises spreadsheet formulas. */
export function auditLogCsv(entries: AuditLogEntry[]): string {
  return toCsv(
    [
      "Time (Asia/Manila)",
      "Actor",
      "Actor ID",
      "Action",
      "Target type",
      "Target ID",
      "Reason",
      "Previous values",
      "New values",
    ],
    entries.map((entry) => [
      CSV_TIME_FORMATTER.format(new Date(entry.createdAt)),
      entry.actorName,
      entry.actorProfileId,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.reason,
      jsonCell(entry.previousValues),
      jsonCell(entry.newValues),
    ]),
  );
}
