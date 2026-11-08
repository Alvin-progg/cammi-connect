import { CardSkeleton } from "@/components/ui/skeleton";

export default function DoctorScheduleLoading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <CardSkeleton lines={12} className="min-h-[32rem]" />
    </div>
  );
}
