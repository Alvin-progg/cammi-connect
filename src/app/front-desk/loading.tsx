const PULSE = "bg-surface-muted motion-safe:animate-pulse";

/**
 * Mirrors the FrontDeskShell frame (icon rail, 64px top bar, content padding)
 * so the page settles into place instead of jumping when it loads.
 */
export default function FrontDeskLoading() {
  return (
    <div className="flex min-h-full flex-1 bg-canvas">
      <aside
        aria-hidden="true"
        className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-line bg-surface"
      >
        <div className="flex h-16 shrink-0 items-center px-3.5">
          <div className={`size-9 rounded-xl ${PULSE}`} />
        </div>
        <div className="flex flex-col gap-1 border-t border-line px-2.5 py-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={`h-11 rounded-xl ${PULSE}`} />
          ))}
        </div>
      </aside>
      <main id="main" aria-busy="true" className="flex min-w-0 flex-1 flex-col">
        <p role="status" className="sr-only">
          Loading the front desk…
        </p>
        <div
          aria-hidden="true"
          className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:px-8"
        >
          <div className={`h-5 w-48 rounded-md ${PULSE}`} />
          <div className={`h-10 w-24 rounded-lg ${PULSE}`} />
        </div>
        <div
          aria-hidden="true"
          className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
        >
          <div className={`h-8 w-48 rounded-md ${PULSE}`} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={`h-28 rounded-xl ${PULSE}`} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className={`h-64 rounded-xl ${PULSE}`} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
