const PULSE = "bg-surface-muted motion-safe:animate-pulse";

export default function ChatLoading() {
  return (
    <main id="main" aria-busy="true" className="flex h-dvh flex-col bg-surface-muted sm:p-4 lg:p-6">
      <p role="status" className="sr-only">
        Loading your chat…
      </p>
      <div
        aria-hidden="true"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col bg-surface sm:rounded-2xl sm:border sm:border-line sm:shadow-card"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex gap-2">
            <div className={`size-9 rounded-full ${PULSE}`} />
            <div className={`h-9 w-28 rounded-full ${PULSE}`} />
          </div>
          <div className={`size-9 rounded-lg ${PULSE}`} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <div className={`size-11 rounded-full ${PULSE}`} />
          <div className={`h-8 w-64 rounded-md ${PULSE}`} />
          <div className={`h-4 w-80 max-w-full rounded-md ${PULSE}`} />
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <div className={`h-14 rounded-[1.75rem] ${PULSE}`} />
        </div>
      </div>
    </main>
  );
}
