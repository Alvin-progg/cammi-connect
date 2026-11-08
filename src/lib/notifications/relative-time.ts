import { formatManilaShortDate } from "@/lib/appointments/format";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "45 min ago", "18 h ago", "Yesterday", then the Manila short date. */
export function formatRelativeTime(isoTimestamp: string, now: Date): string {
  const elapsedMs = now.getTime() - new Date(isoTimestamp).getTime();
  if (elapsedMs < HOUR_MS) {
    return `${Math.max(1, Math.floor(elapsedMs / MINUTE_MS))} min ago`;
  }
  if (elapsedMs < 24 * HOUR_MS) {
    return `${Math.floor(elapsedMs / HOUR_MS)} h ago`;
  }
  if (elapsedMs < 48 * HOUR_MS) {
    return "Yesterday";
  }
  return formatManilaShortDate(isoTimestamp);
}
