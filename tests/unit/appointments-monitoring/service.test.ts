// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { AppointmentMonitoringFilters } from "@/lib/appointments/monitoring";
import {
  getMonitoredAppointment,
  listMonitoredAppointments,
  type AppointmentMonitoringReader,
} from "@/server/appointments-monitoring/service";

vi.mock("server-only", () => ({}));

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000100";
const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";

const FILTERS: AppointmentMonitoringFilters = {
  search: "",
  doctorId: null,
  departmentId: null,
  statuses: [],
  source: null,
  from: null,
  to: null,
  page: 1,
};

function fakeReader(total = 0) {
  return {
    listAppointments: vi
      .fn<AppointmentMonitoringReader["listAppointments"]>()
      .mockResolvedValue({ items: [], total }),
    getAppointment: vi.fn<AppointmentMonitoringReader["getAppointment"]>().mockResolvedValue(null),
  } satisfies AppointmentMonitoringReader;
}

describe("listMonitoredAppointments", () => {
  it("passes the filters through with Manila day bounds and page offset", async () => {
    const reader = fakeReader(60);

    const page = await listMonitoredAppointments(
      {
        search: "Synthetic",
        doctorId: DOCTOR_ID,
        departmentId: null,
        statuses: ["confirmed"],
        source: "front_desk",
        from: "2026-11-01",
        to: "2026-11-01",
        page: 3,
      },
      reader,
    );

    expect(reader.listAppointments).toHaveBeenCalledWith({
      search: "Synthetic",
      doctorId: DOCTOR_ID,
      departmentId: null,
      statuses: ["confirmed"],
      source: "front_desk",
      start: "2026-10-31T16:00:00.000Z",
      end: "2026-11-01T16:00:00.000Z",
      limit: 25,
      offset: 50,
    });
    expect(page).toEqual({ items: [], total: 60, page: 3, pageCount: 3 });
  });

  it("sends an empty search as null and reports at least one page", async () => {
    const reader = fakeReader(0);

    const page = await listMonitoredAppointments(FILTERS, reader);

    expect(reader.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ search: null, start: null, end: null, offset: 0 }),
    );
    expect(page.pageCount).toBe(1);
  });
});

describe("getMonitoredAppointment", () => {
  it("returns null for a malformed id without querying", async () => {
    const reader = fakeReader();

    await expect(getMonitoredAppointment("not-a-uuid", reader)).resolves.toBeNull();
    expect(reader.getAppointment).not.toHaveBeenCalled();
  });

  it("loads a valid id", async () => {
    const reader = fakeReader();

    await getMonitoredAppointment(APPOINTMENT_ID, reader);

    expect(reader.getAppointment).toHaveBeenCalledWith(APPOINTMENT_ID);
  });
});
