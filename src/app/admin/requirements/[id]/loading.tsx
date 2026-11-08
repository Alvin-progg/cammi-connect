import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { DetailPageSkeleton } from "@/components/ui/skeleton";

export default function AdminRequirementsIdLoading() {
  return (
    <StaffShellLoading workspace="admin">
      <DetailPageSkeleton />
    </StaffShellLoading>
  );
}
