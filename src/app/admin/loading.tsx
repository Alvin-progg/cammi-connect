const PULSE = "bg-surface-muted motion-safe:animate-pulse";

export default function AdminLoading() {
  return (
    <main id="main" aria-busy="true" className="flex flex-1 flex-col bg-canvas">
      <p role="status" className="sr-only">
        Loading administration…
      </p>
      <div aria-hidden="true" className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className={`h-6 w-40 rounded-md ${PULSE}`} />
          <div className={`h-10 w-24 rounded-lg ${PULSE}`} />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mx-auto flex w-full max-w-[90rem] flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className={`h-8 w-48 rounded-md ${PULSE}`} />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`h-28 rounded-xl ${PULSE}`} />
        ))}
      </div>
    </main>
  );
}
