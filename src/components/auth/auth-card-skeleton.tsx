import { Skeleton } from "@/components/ui/skeleton";

/**
 * The auth frame while a sign-in, register, or set-password page loads:
 * the same top bar and card size, with placeholder fields.
 */
export function AuthCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface-muted">
      <div aria-hidden="true" className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-6 pt-6">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>
      <main id="main" aria-busy="true" className="flex flex-1 items-center justify-center px-4 pb-6 pt-8">
        <p role="status" className="sr-only">
          Loading…
        </p>
        <div
          aria-hidden="true"
          className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-lift sm:p-8"
        >
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          {Array.from({ length: fields }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}
