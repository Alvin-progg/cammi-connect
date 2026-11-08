import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { DetailPageSkeleton } from "@/components/ui/skeleton";

export default function FrontDeskBookLoading() {
  return (
    <StaffShellLoading workspace="front-desk">
      <DetailPageSkeleton />
    </StaffShellLoading>
  );
}
