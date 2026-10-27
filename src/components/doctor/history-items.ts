import { formatManilaDateTime } from "@/lib/appointments/format";
import type { AppointmentHistoryEntry } from "@/lib/appointments/types";

import type { AppointmentHistoryItem } from "./appointment-actions";

/** Maps audit entries to the client DTO with pre-formatted Manila labels. */
export function toHistoryItems(
  entries: AppointmentHistoryEntry[] | undefined,
): AppointmentHistoryItem[] {
  return (entries ?? []).map((entry) => ({
    id: entry.id,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    reason: entry.reason,
    createdAtLabel: formatManilaDateTime(entry.createdAt),
  }));
}
