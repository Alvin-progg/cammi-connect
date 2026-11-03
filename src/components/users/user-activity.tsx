import { EmptyState } from "@/components/admin/empty-state";
import { formatManilaDateTime } from "@/lib/appointments/format";
import type { UserActivityEntry } from "@/lib/users/types";

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Account created",
  "user.role_change": "Role changed",
  "user.activate": "Account activated",
  "user.deactivate": "Account deactivated",
  "user.update": "Profile updated",
  "user.password_reset_requested": "Password reset email sent",
};

/** The account's last audit events: changes made to it, and actions it took. */
export function UserActivity({
  userId,
  entries,
}: {
  userId: string;
  entries: UserActivityEntry[];
}) {
  if (entries.length === 0) {
    return <EmptyState>No recorded activity yet.</EmptyState>;
  }

  return (
    <ol className="flex flex-col divide-y divide-line">
      {entries.map((entry) => {
        const aboutThisAccount = entry.targetType === "user" && entry.targetId === userId;
        return (
          <li key={entry.id} className="flex flex-col gap-0.5 py-3 text-sm">
            <span className="font-medium text-ink">{ACTION_LABELS[entry.action] ?? entry.action}</span>
            <span className="text-ink-secondary">
              {formatManilaDateTime(entry.createdAt)}
              {aboutThisAccount ? "" : " · By this account"}
            </span>
            {entry.reason ? <span className="text-ink-secondary">{`Reason: ${entry.reason}`}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
