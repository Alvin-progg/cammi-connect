import { CardSkeleton } from "@/components/ui/skeleton";

const PULSE = "bg-surface-muted motion-safe:animate-pulse";

/**
 * First-load fallback for the doctor layout: rail and header placeholders.
 * Later view switches keep the real rail and show only the route's loading.tsx.
 */
export function DoctorShellLoading() {
  return (
    <div className="flex min-h-full flex-1 bg-canvas">
      <aside
        aria-hidden="true"
        className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col items-center gap-3 border-r border-line bg-surface py-3.5"
      >
        <div className="size-9 rounded-xl bg-primary-soft" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={`size-11 rounded-xl ${PULSE}`} />
          ))}
        </div>
        <div className={`mt-auto size-8 rounded-full ${PULSE}`} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" aria-busy="true" className="flex-1">
          <p role="status" className="sr-only">
            Loading your dashboard…
          </p>
          <div aria-hidden="true" className="border-b border-line bg-surface">
            <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className={`h-6 w-40 rounded-md ${PULSE}`} />
              <div className={`size-10 rounded-full ${PULSE}`} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
            <CardSkeleton lines={12} className="min-h-[32rem]" />
          </div>
        </main>
      </div>
    </div>
  );
}
