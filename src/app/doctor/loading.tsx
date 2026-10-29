const PULSE = "bg-surface-muted motion-safe:animate-pulse";

export default function DoctorLoading() {
  return (
    <div className="flex min-h-full flex-1 bg-canvas">
      <aside
        aria-hidden="true"
        className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col items-center gap-3 border-r border-line bg-surface py-3.5"
      >
        <div className="size-9 rounded-xl bg-primary-soft" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
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
          <div
            aria-hidden="true"
            className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8"
          >
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className={`h-10 w-56 rounded-xl ${PULSE}`} />
                <div className={`h-10 w-32 rounded-xl ${PULSE}`} />
              </div>
              <div className="grid h-[28rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
                <div />
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="flex flex-col gap-3 border-l border-line p-2">
                    <div className={`mx-auto h-10 w-10 rounded-full ${PULSE}`} />
                    {index % 2 === 0 ? (
                      <div className={`h-20 rounded-lg ${PULSE}`} />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
