import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { FormPageSkeleton } from "@/components/ui/skeleton";

export default function AdminServicesNewLoading() {
  return (
    <StaffShellLoading workspace="admin">
      <FormPageSkeleton />
    </StaffShellLoading>
  );
}
