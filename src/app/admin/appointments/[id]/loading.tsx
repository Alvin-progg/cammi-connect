import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { DetailPageSkeleton } from "@/components/ui/skeleton";

export default function AdminAppointmentsIdLoading() {
  return (
    <StaffShellLoading workspace="admin">
      <DetailPageSkeleton />
    </StaffShellLoading>
  );
}
