import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas">
      <div aria-hidden="true" className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <main id="main" aria-busy="true" className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-6 pb-12 pt-10">
        <p role="status" className="sr-only">
          Loading…
        </p>
        <div aria-hidden="true" className="flex items-center gap-5">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <CardSkeleton lines={2} />
      </main>
    </div>
  );
}
