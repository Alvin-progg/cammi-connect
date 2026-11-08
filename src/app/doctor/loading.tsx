const PULSE = "bg-surface-muted motion-safe:animate-pulse";

export default function DoctorLoading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
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
  );
}
