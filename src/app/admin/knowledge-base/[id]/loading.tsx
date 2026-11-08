import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { DetailPageSkeleton } from "@/components/ui/skeleton";

export default function AdminKnowledgeBaseIdLoading() {
  return (
    <StaffShellLoading workspace="admin">
      <DetailPageSkeleton />
    </StaffShellLoading>
  );
}
