import "server-only";

import { z } from "zod";

import {
  MONITORING_PAGE_SIZE,
  monitoringDateBounds,
  type AppointmentMonitoringFilters,
  type MonitoringDetails,
  type MonitoringListItem,
} from "@/lib/appointments/monitoring";
import type { AppointmentStatus, BookingSource } from "@/lib/appointments/status";

/**
 * Read-only, system-wide appointment reads for administrators (ADM-09). There
 * is deliberately no writer: admins do not change appointment status (D3).
 * Callers must have passed `getAdminSession()`.
 */
export type AppointmentMonitoringReader = {
  listAppointments(query: {
    search: string | null;
    doctorId: string | null;
    departmentId: string | null;
    statuses: AppointmentStatus[];
    source: BookingSource | null;
    /** UTC instants bounding `scheduled_at`; end is exclusive. */
    start: string | null;
    end: string | null;
    limit: number;
    offset: number;
  }): Promise<{ items: MonitoringListItem[]; total: number }>;
  getAppointment(appointmentId: string): Promise<MonitoringDetails | null>;
};

export async function listMonitoredAppointments(
  filters: AppointmentMonitoringFilters,
  reader: AppointmentMonitoringReader,
) {
  const { start, end } = monitoringDateBounds(filters);
  const { items, total } = await reader.listAppointments({
    search: filters.search || null,
    doctorId: filters.doctorId,
    departmentId: filters.departmentId,
    statuses: filters.statuses,
    source: filters.source,
    start,
    end,
    limit: MONITORING_PAGE_SIZE,
    offset: (filters.page - 1) * MONITORING_PAGE_SIZE,
  });
  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / MONITORING_PAGE_SIZE)),
  };
}

export async function getMonitoredAppointment(
  appointmentId: string,
  reader: AppointmentMonitoringReader,
): Promise<MonitoringDetails | null> {
  const parsed = z.uuid().safeParse(appointmentId);
  return parsed.success ? reader.getAppointment(parsed.data) : null;
}
