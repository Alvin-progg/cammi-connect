import { DashboardPageSkeleton } from "@/components/ui/skeleton";

export default function DoctorStatsLoading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <DashboardPageSkeleton />
    </div>
  );
}
