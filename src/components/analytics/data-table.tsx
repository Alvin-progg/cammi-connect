import { CELL, HEADER_CELL } from "@/components/ui/data";

/** The accessible table alternative to a chart (design.md §4.6, A11Y-09). */
export function DataTable({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column} scope="col" className={index === 0 ? HEADER_CELL : `${HEADER_CELL} text-right`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className={`${CELL} text-left font-normal`}>
                    {cell}
                  </th>
                ) : (
                  <td key={index} className={`${CELL} text-right tabular-nums`}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
