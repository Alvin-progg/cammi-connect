// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listPatientNotifications,
  countUnreadPatientNotifications,
  markPatientNotificationRead,
  markAllPatientNotificationsRead,
  type PatientNotificationsReader,
} from "@/server/notifications/patient-service";

function fakeReader(overrides: Partial<PatientNotificationsReader> = {}): PatientNotificationsReader {
  return {
    listForPatient: vi.fn(async () => []),
    countUnreadForPatient: vi.fn(async () => 0),
    markRead: vi.fn(async () => true),
    markAllRead: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("patient notifications service", () => {
  it("lists the patient's latest 50 notifications", async () => {
    const reader = fakeReader();
    await listPatientNotifications("patient-1", reader);
    expect(reader.listForPatient).toHaveBeenCalledWith({ patientId: "patient-1", limit: 50 });
  });

  it("counts unread notifications for the given patient only", async () => {
    const reader = fakeReader({ countUnreadForPatient: vi.fn(async () => 2) });
    await expect(countUnreadPatientNotifications("patient-1", reader)).resolves.toBe(2);
    expect(reader.countUnreadForPatient).toHaveBeenCalledWith("patient-1");
  });

  it("marks one notification read, scoped to the patient", async () => {
    const reader = fakeReader();
    await markPatientNotificationRead({ patientId: "patient-1", notificationId: "n-1" }, reader);
    expect(reader.markRead).toHaveBeenCalledWith({ patientId: "patient-1", notificationId: "n-1" });
  });

  it("marks all of the patient's notifications read", async () => {
    const reader = fakeReader();
    await markAllPatientNotificationsRead("patient-1", reader);
    expect(reader.markAllRead).toHaveBeenCalledWith("patient-1");
  });
});
