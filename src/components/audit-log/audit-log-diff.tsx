import { EmptyState } from "@/components/admin/empty-state";
import { CELL, HEADER_CELL, TableFrame } from "@/components/front-desk/table-frame";
import { diffAuditValues, type AuditValueRow } from "@/lib/audit/log";
import type { JsonValue } from "@/lib/audit/redact";

/** A value as JSON; a key missing on one side shows as a dash. */
function formatValue(value: JsonValue | undefined): string {
  return value === undefined ? "—" : JSON.stringify(value);
}

function ValuesTable({ label, rows }: { label: string; rows: AuditValueRow[] }) {
  return (
    <TableFrame label={label} minWidthClass="min-w-[40rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Field</th>
          <th scope="col" className={HEADER_CELL}>Previous</th>
          <th scope="col" className={HEADER_CELL}>New</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className={`${CELL} text-left font-mono text-xs font-medium`}>
              {row.key}
            </th>
            <td className={`${CELL} break-all font-mono text-xs text-ink-secondary`}>
              {formatValue(row.previous)}
            </td>
            <td className={`${CELL} break-all font-mono text-xs`}>{formatValue(row.next)}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Previous vs new values of one audit entry, changed fields first. */
export function AuditLogDiff({
  previousValues,
  newValues,
}: {
  previousValues: JsonValue;
  newValues: JsonValue;
}) {
  const rows = diffAuditValues(previousValues, newValues);
  if (rows.length === 0) {
    return <EmptyState>This event recorded no values.</EmptyState>;
  }

  const changed = rows.filter((row) => row.changed);
  const unchanged = rows.filter((row) => !row.changed);
  return (
    <div className="flex flex-col gap-4">
      {changed.length > 0 ? (
        <ValuesTable label="Changed values" rows={changed} />
      ) : (
        <EmptyState>No values changed.</EmptyState>
      )}
      {unchanged.length > 0 ? (
        <details className="rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink focus-ring">
            {unchanged.length === 1 ? "1 unchanged value" : `${unchanged.length} unchanged values`}
          </summary>
          <div className="mt-3">
            <ValuesTable label="Unchanged values" rows={unchanged} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
