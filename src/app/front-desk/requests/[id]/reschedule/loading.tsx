import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { DetailPageSkeleton } from "@/components/ui/skeleton";

export default function FrontDeskRequestsIdRescheduleLoading() {
  return (
    <StaffShellLoading workspace="front-desk">
      <DetailPageSkeleton />
    </StaffShellLoading>
  );
}
