import { AdminShell, type AdminSection } from "@/components/admin/admin-shell";
import { AdminPlaceholder } from "@/components/admin/placeholder";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAdminSession } from "@/server/auth/dal";

export const ADMIN_ACCESS_DENIED_MESSAGE =
  "This dashboard is only available to administrator accounts.";

/**
 * Admin-guarded page body for a section whose slice is not built yet. Each
 * route still checks the admin session itself through this component.
 */
export async function AdminPlaceholderPage({
  section,
  label,
  path,
}: {
  section: AdminSection;
  label: string;
  path: string;
}) {
  const session = await getAdminSession(path);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  return (
    <AdminShell adminName={session.admin.fullName} active={section} crumbs={[{ label }]}>
      <AdminPlaceholder section={label} />
    </AdminShell>
  );
}
