/** Active/Inactive status pill for admin lists (accounts, departments). */
export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? "bg-success-soft text-success-soft-ink" : "bg-surface-muted text-ink-secondary"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
