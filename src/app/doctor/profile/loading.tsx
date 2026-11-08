import { DetailPageSkeleton } from "@/components/ui/skeleton";

export default function DoctorProfileLoading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <DetailPageSkeleton />
    </div>
  );
}
