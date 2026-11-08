import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { ListPageSkeleton } from "@/components/ui/skeleton";

export default function AdminSpecialtiesLoading() {
  return (
    <StaffShellLoading workspace="admin">
      <ListPageSkeleton />
    </StaffShellLoading>
  );
}
