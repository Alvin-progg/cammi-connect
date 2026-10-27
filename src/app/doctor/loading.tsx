export default function DoctorLoading() {
  return (
    <div className="flex min-h-full flex-1 bg-canvas">
      <aside
        aria-hidden="true"
        className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="size-9 rounded-lg bg-surface-muted motion-safe:animate-pulse" />
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-28 rounded bg-surface-muted motion-safe:animate-pulse" />
            <div className="h-3 w-20 rounded bg-surface-muted motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col gap-2 px-3 py-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-10 rounded-lg bg-surface-muted motion-safe:animate-pulse"
            />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" aria-busy="true" className="flex-1">
          <p role="status" className="sr-only">
            Loading your dashboard…
          </p>
          <div aria-hidden="true" className="border-b border-line bg-surface">
            <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8">
              <div className="flex min-h-16 items-center justify-between gap-3 py-2">
                <div className="h-4 w-32 rounded bg-surface-muted motion-safe:animate-pulse" />
                <div className="h-9 w-28 rounded-lg bg-surface-muted motion-safe:animate-pulse" />
              </div>
              <div className="h-8 w-64 rounded bg-surface-muted motion-safe:animate-pulse" />
              <div className="mt-4 flex gap-2 pb-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="h-8 w-20 rounded bg-surface-muted motion-safe:animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-line bg-surface-muted p-3"
                >
                  <div className="h-5 w-24 rounded bg-surface motion-safe:animate-pulse" />
                  <div className="h-32 rounded-xl border border-line bg-surface motion-safe:animate-pulse" />
                  <div className="h-32 rounded-xl border border-line bg-surface motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
