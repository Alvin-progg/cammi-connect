import Link from "next/link";

import { ActiveBadge } from "@/components/ui/badge";
import { CELL, EmptyState, HEADER_CELL, ROW, Table } from "@/components/ui/data";
import { formatPesos } from "@/lib/billing/money";
import type { HmoProvider } from "@/lib/hmo-providers/types";

export function HmoProvidersTable({ providers }: { providers: HmoProvider[] }) {
  if (providers.length === 0) {
    return <EmptyState>No HMO providers yet.</EmptyState>;
  }

  return (
    <Table label="HMO providers" minWidthClass="min-w-[32rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Name</th>
          <th scope="col" className={HEADER_CELL}>Co-pay</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
        </tr>
      </thead>
      <tbody>
        {providers.map((provider) => (
          <tr key={provider.id} className={ROW}>
            <td className={CELL}>
              <Link
                href={`/admin/hmo-providers/${provider.id}`}
                className="rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
              >
                {provider.name}
              </Link>
            </td>
            <td className={CELL}>
              {provider.copayCentavos === 0 ? (
                <span className="text-ink-muted">None</span>
              ) : (
                formatPesos(provider.copayCentavos)
              )}
            </td>
            <td className={CELL}>
              <ActiveBadge isActive={provider.isActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
