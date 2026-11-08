import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { DashboardPageSkeleton } from "@/components/ui/skeleton";

export default function FrontDeskLoading() {
  return (
    <StaffShellLoading workspace="front-desk">
      <DashboardPageSkeleton />
    </StaffShellLoading>
  );
}
