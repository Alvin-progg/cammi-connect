import Link from "next/link";

import { EmptyState } from "@/components/ui/data";
import { CELL, HEADER_CELL, ROW, Table } from "@/components/ui/data";
import { buttonVariants } from "@/components/ui/button";
import { formatManilaDateTime } from "@/lib/appointments/format";
import {
  AUDIT_ACTION_PREFIXES,
  AUDIT_ACTION_PREFIX_LABELS,
  AUDIT_LOG_PATH,
  AUDIT_TARGET_TYPES,
  auditLogExportHref,
  auditLogListHref,
  auditTargetHref,
  auditTargetLabel,
  type AuditLogEntry,
  type AuditLogFilters as AuditLogFilterValues,
} from "@/lib/audit/log";
import { formatRequestId } from "@/lib/front-desk/requests";

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const LINK_CLASS =
  "rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline";

/** GET form, so filters live in the URL and the export link can carry them. */
export function AuditLogFilters({
  filters,
  actors,
}: {
  filters: AuditLogFilterValues;
  actors: { id: string; name: string }[];
}) {
  return (
    <form
      role="search"
      aria-label="Filter audit log"
      method="get"
      action={AUDIT_LOG_PATH}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-actor" className={FIELD_LABEL_CLASS}>
          Actor
        </label>
        <select id="audit-actor" name="actor" defaultValue={filters.actorId ?? ""} className={CONTROL_CLASS}>
          <option value="">All admins</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-action" className={FIELD_LABEL_CLASS}>
          Action
        </label>
        <select
          id="audit-action"
          name="action"
          defaultValue={filters.actionPrefix ?? ""}
          className={CONTROL_CLASS}
        >
          <option value="">All actions</option>
          {AUDIT_ACTION_PREFIXES.map((prefix) => (
            <option key={prefix} value={prefix}>
              {`${AUDIT_ACTION_PREFIX_LABELS[prefix]} (${prefix}.*)`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-target" className={FIELD_LABEL_CLASS}>
          Target
        </label>
        <select
          id="audit-target"
          name="target"
          defaultValue={filters.targetType ?? ""}
          className={CONTROL_CLASS}
        >
          <option value="">All targets</option>
          {AUDIT_TARGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {auditTargetLabel(type)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-from" className={FIELD_LABEL_CLASS}>
          From
        </label>
        <input id="audit-from" name="from" type="date" defaultValue={filters.from ?? ""} className={CONTROL_CLASS} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-to" className={FIELD_LABEL_CLASS}>
          To
        </label>
        <input id="audit-to" name="to" type="date" defaultValue={filters.to ?? ""} className={CONTROL_CLASS} />
      </div>
      <div className="flex gap-2">
        <Link href={AUDIT_LOG_PATH} className={buttonVariants({ variant: "ghost" })}>
          Clear
        </Link>
        <button type="submit" className={buttonVariants({ variant: "secondary" })}>
          Filter
        </button>
      </div>
    </form>
  );
}

function TargetCell({ entry }: { entry: AuditLogEntry }) {
  const label = auditTargetLabel(entry.targetType);
  const href = auditTargetHref(entry.targetType, entry.targetId);
  const id = entry.targetType === "system_settings" ? null : formatRequestId(entry.targetId);
  const content = (
    <>
      {label}
      {id ? <span className="ml-1.5 font-mono text-xs">{id}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className={LINK_CLASS}>
      {content}
    </Link>
  ) : (
    <span>{content}</span>
  );
}

/** Read-only: the only controls are links to an entry, the target, paging, and export. */
export function AuditLogTable({
  entries,
  total,
  filters,
  pageCount,
}: {
  entries: AuditLogEntry[];
  total: number;
  filters: AuditLogFilterValues;
  pageCount: number;
}) {
  if (entries.length === 0) {
    return <EmptyState>No audit entries match these filters.</EmptyState>;
  }

  const page = filters.page;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">{total === 1 ? "1 entry" : `${total} entries`}</p>
        {/* A plain link: the export is a GET download, audited by the route. */}
        <a href={auditLogExportHref(filters)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Export CSV
        </a>
      </div>
      <Table label="Audit log" minWidthClass="min-w-[56rem]">
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL}>Time</th>
            <th scope="col" className={HEADER_CELL}>Actor</th>
            <th scope="col" className={HEADER_CELL}>Action</th>
            <th scope="col" className={HEADER_CELL}>Target</th>
            <th scope="col" className={HEADER_CELL}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className={ROW}>
              <td className={`${CELL} whitespace-nowrap`}>{formatManilaDateTime(entry.createdAt)}</td>
              <td className={CELL}>{entry.actorName ?? "Unknown"}</td>
              <td className={CELL}>
                <Link href={`${AUDIT_LOG_PATH}/${entry.id}`} className={`${LINK_CLASS} font-mono text-xs`}>
                  {entry.action}
                </Link>
              </td>
              <td className={CELL}>
                <TargetCell entry={entry} />
              </td>
              <td className={`${CELL} max-w-xs break-words`}>{entry.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-secondary">{`Page ${page} of ${pageCount}`}</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={auditLogListHref(filters, page - 1)}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Previous page
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={auditLogListHref(filters, page + 1)}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Next page
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
