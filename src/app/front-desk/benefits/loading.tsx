import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { ListPageSkeleton } from "@/components/ui/skeleton";

export default function FrontDeskBenefitsLoading() {
  return (
    <StaffShellLoading workspace="front-desk">
      <ListPageSkeleton />
    </StaffShellLoading>
  );
}
