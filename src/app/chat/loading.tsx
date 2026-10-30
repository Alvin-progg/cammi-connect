const PULSE = "bg-surface-muted motion-safe:animate-pulse";

export default function ChatLoading() {
  return (
    <main id="main" aria-busy="true" className="flex h-dvh bg-surface">
      <p role="status" className="sr-only">
        Loading your chat…
      </p>
      <div
        aria-hidden="true"
        className="flex w-16 shrink-0 flex-col gap-2 border-r border-line px-2 pt-3 md:w-72"
      >
        <div className={`size-12 rounded-xl ${PULSE}`} />
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className={`h-11 rounded-xl ${PULSE}`} />
        ))}
        <div className="mx-1 my-3 border-t border-line" />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`h-12 rounded-xl ${PULSE}`} />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <div className={`size-11 rounded-full ${PULSE}`} />
          <div className={`h-8 w-64 max-w-full rounded-md ${PULSE}`} />
          <div className={`h-4 w-80 max-w-full rounded-md ${PULSE}`} />
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <div className={`h-14 rounded-[1.75rem] ${PULSE}`} />
        </div>
      </div>
    </main>
  );
}
