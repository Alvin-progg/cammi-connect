import { cn } from "@/lib/cn";

/**
 * Loading placeholders shaped like the page that is coming (design.md §5.10).
 * Blocks are decorative (`aria-hidden`); the surrounding frame announces the
 * loading state once. The pulse stops under reduced motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-surface-muted motion-safe:animate-pulse", className)} />;
}

const CARD = "rounded-xl border border-line bg-surface p-6 shadow-soft";

/** Four KPI cards in a row. */
export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn(CARD, "flex flex-col gap-3 p-5")}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** A filter row of 36px controls. */
export function ToolbarSkeleton({ controls = 3 }: { controls?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-end gap-3">
      {Array.from({ length: controls }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-40" />
        </div>
      ))}
      <Skeleton className="h-9 w-20" />
    </div>
  );
}

/** A kit table frame with a header row and `rows` body rows. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
      <div className="flex h-10 items-center gap-6 border-b border-line px-4">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-6 border-b border-line px-4 py-4 last:border-b-0">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={cn("h-4 flex-1", column === 0 && "max-w-40")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A titled card with `lines` text rows. */
export function CardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn(CARD, "flex flex-col gap-3", className)}>
      <Skeleton className="mb-1 h-5 w-40" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-4", index % 2 === 0 ? "w-full" : "w-2/3")} />
      ))}
    </div>
  );
}

/** List pages: filters, then a table. */
export function ListPageSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <>
      <ToolbarSkeleton />
      <TableSkeleton columns={columns} />
    </>
  );
}

/** Detail pages: two cards side by side, then a wide card; a side card at `xl`. */
export function DetailPageSkeleton() {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton lines={3} />
      </div>
      <CardSkeleton lines={3} />
    </div>
  );
}

/** Create/edit pages: one form card with label + control rows. */
export function FormPageSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div aria-hidden="true" className={cn(CARD, "flex max-w-3xl flex-col gap-5")}>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-28 self-end" />
    </div>
  );
}

/** Dashboards: KPI row, then a main and a side card. */
export function DashboardPageSkeleton() {
  return (
    <>
      <KpiRowSkeleton />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={6} />
      </div>
    </>
  );
}
