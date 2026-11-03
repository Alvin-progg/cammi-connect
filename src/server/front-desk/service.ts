import "server-only";

import { z } from "zod";

import { manilaDayRange } from "@/lib/appointments/filters";
import type { AppointmentStatus } from "@/lib/appointments/status";
import {
  REQUEST_QUEUE_LIMIT,
  type RequestDetails,
  type RequestQueueFilters,
  type RequestQueueItem,
} from "@/lib/front-desk/requests";

export const QUEUE_LIMIT = REQUEST_QUEUE_LIMIT;

export type RequestQueueQuery = {
  status: AppointmentStatus | null;
  /** ISO bounds of the requested appointment time, or null for any day. */
  start: string | null;
  end: string | null;
  doctorId: string | null;
  specialtyId: string | null;
  limit: number;
};

/**
 * Reads appointment requests submitted through Cami (`booking_source =
 * ai_chatbot`). Callers must have checked the front desk session first.
 */
export type FrontDeskRequestsReader = {
  listRequests(query: RequestQueueQuery): Promise<RequestQueueItem[]>;
  getRequest(appointmentId: string): Promise<RequestDetails | null>;
};

export async function listRequestQueue(
  filters: RequestQueueFilters,
  reader: FrontDeskRequestsReader,
): Promise<{ items: RequestQueueItem[]; limitReached: boolean }> {
  const range = filters.date ? manilaDayRange(filters.date) : null;
  const status: AppointmentStatus | null =
    filters.status === "all"
      ? null
      : filters.status === "pending"
        ? "requested"
        : filters.status;

  const items = await reader.listRequests({
    status,
    start: range ? range.start.toISOString() : null,
    end: range ? range.end.toISOString() : null,
    doctorId: filters.doctorId,
    specialtyId: filters.specialtyId,
    limit: QUEUE_LIMIT,
  });

  return { items, limitReached: items.length >= QUEUE_LIMIT };
}

export async function getRequestDetails(
  appointmentId: string,
  reader: FrontDeskRequestsReader,
): Promise<RequestDetails | null> {
  if (!z.uuid().safeParse(appointmentId).success) {
    return null;
  }
  return reader.getRequest(appointmentId);
}
