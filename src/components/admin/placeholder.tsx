/** Content for an admin section whose slice has not been built yet. */
export function AdminPlaceholder({ section }: { section: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-6">
      <p className="text-sm font-medium text-ink">Not built yet</p>
      <p className="mt-1 text-sm text-ink-muted">
        {`${section} will be available in a later release of the administrator module.`}
      </p>
    </div>
  );
}
