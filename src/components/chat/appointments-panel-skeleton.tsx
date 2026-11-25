import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

const CARD = "flex gap-5 rounded-xl border border-line bg-surface px-5 py-4.5 shadow-soft";

/**
 * Placeholder shaped like `AppointmentsPanel` while My appointments loads.
 * Same container width and section order, so the content does not jump.
 */
export function AppointmentsPanelSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-0 flex-1 overflow-hidden">
      <header className="border-b border-line bg-wash">
        <div className="mx-auto flex max-w-[896px] flex-wrap items-end justify-between gap-4 px-6 pb-7 pt-10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </header>
      <div className="mx-auto flex max-w-[896px] flex-col gap-8 px-6 pb-12 pt-7">
        <section className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32" />
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, index) => (
              <li key={index} className={CARD}>
                <Skeleton className="h-16 w-16 shrink-0 self-start rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-1 h-4 w-72 max-w-full" />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <Skeleton className="h-6 w-24" />
          <TableSkeleton rows={3} columns={4} />
        </section>
      </div>
    </div>
  );
}
