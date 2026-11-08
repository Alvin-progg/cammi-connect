import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { DashboardPageSkeleton } from "@/components/ui/skeleton";

export default function AdminAnalyticsLoading() {
  return (
    <StaffShellLoading workspace="admin">
      <DashboardPageSkeleton />
    </StaffShellLoading>
  );
}
