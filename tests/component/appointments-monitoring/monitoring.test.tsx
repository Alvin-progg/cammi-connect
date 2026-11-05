import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonitoringDetailsView } from "@/components/appointments-monitoring/monitoring-details";
import {
  MonitoringFilters,
  MonitoringTable,
} from "@/components/appointments-monitoring/monitoring-list";
import type {
  AppointmentMonitoringFilters,
  MonitoringDetails,
  MonitoringListItem,
} from "@/lib/appointments/monitoring";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";
const APPOINTMENT_ID = "abcdef12-0000-4000-8000-000000000100";
const PATIENT_ID = "00000000-0000-4000-8000-000000000030";

const ITEM: MonitoringListItem = {
  id: APPOINTMENT_ID,
  patientId: PATIENT_ID,
  patientName: "Synthetic Patient",
  doctorName: "Dr. Synthetic",
  departmentName: "Internal Medicine",
  specialtyName: "Cardiology",
  scheduledAt: "2026-11-10T01:00:00Z",
  durationMinutes: 30,
  status: "confirmed",
  bookingSource: "ai_chatbot",
  createdByName: "Synthetic Patient",
  confirmedByName: "Synthetic Desk",
};

const DETAILS: MonitoringDetails = {
  ...ITEM,
  patientEmail: "patient@example.test",
  patientPhone: "09170000000",
  createdAt: "2026-11-05T02:00:00Z",
  confirmedAt: "2026-11-05T03:00:00Z",
  reason: "Follow-up visit",
  rejectionReason: null,
  cancellationReason: null,
  history: [
    {
      id: "h1",
      action: "created",
      previousStatus: null,
      newStatus: "requested",
      actorName: "Synthetic Patient",
      actorRole: "patient",
      reason: null,
      scheduledAt: null,
      previousScheduledAt: null,
      createdAt: "2026-11-05T02:00:00Z",
    },
    {
      id: "h2",
      action: "confirmed",
      previousStatus: "requested",
      newStatus: "confirmed",
      actorName: "Synthetic Desk",
      actorRole: "front_desk",
      reason: null,
      scheduledAt: null,
      previousScheduledAt: null,
      createdAt: "2026-11-05T03:00:00Z",
    },
  ],
};

const FILTERS: AppointmentMonitoringFilters = {
  search: "Synthetic",
  doctorId: DOCTOR_ID,
  departmentId: null,
  statuses: ["confirmed"],
  source: null,
  from: "2026-11-01",
  to: null,
  page: 1,
};

describe("MonitoringTable", () => {
  it("lists appointments with patient name and id only, linking to details", () => {
    render(<MonitoringTable items={[ITEM]} total={1} page={1} pageCount={1} filters={FILTERS} />);

    const table = screen.getByRole("table", { name: "Appointments" });
    const [, row] = within(table).getAllByRole("row");
    expect(within(row).getByRole("link", { name: "ABCDEF12" })).toHaveAttribute(
      "href",
      `/admin/appointments/${APPOINTMENT_ID}`,
    );
    expect(within(row).getByText("Synthetic Desk")).toBeInTheDocument();
    expect(within(row).getByText("Confirmed")).toBeInTheDocument();
    expect(within(row).getByText("Cami (AI assistant)")).toBeInTheDocument();
    expect(within(row).getByText("Internal Medicine")).toBeInTheDocument();
    expect(within(row).getByText(PATIENT_ID.slice(0, 8).toUpperCase())).toBeInTheDocument();

    // Privacy: no contact details in the list.
    expect(screen.queryByText("patient@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText("09170000000")).not.toBeInTheDocument();
  });

  it("keeps the filters in the pagination links", () => {
    render(<MonitoringTable items={[ITEM]} total={60} page={2} pageCount={3} filters={{ ...FILTERS, page: 2 }} />);

    const next = screen.getByRole("link", { name: "Next page" });
    const params = new URL(next.getAttribute("href") ?? "", "http://localhost").searchParams;
    expect(params.get("page")).toBe("3");
    expect(params.get("doctor")).toBe(DOCTOR_ID);
    expect(params.getAll("status")).toEqual(["confirmed"]);
    expect(screen.getByRole("link", { name: "Previous page" })).toBeInTheDocument();
    expect(screen.getByText("60 appointments")).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<MonitoringTable items={[]} total={0} page={1} pageCount={1} filters={FILTERS} />);

    expect(screen.getByText("No appointments match these filters.")).toBeInTheDocument();
  });
});

describe("MonitoringFilters", () => {
  it("renders the current filter values in a GET form", () => {
    render(
      <MonitoringFilters
        filters={FILTERS}
        doctors={[{ id: DOCTOR_ID, name: "Dr. Synthetic" }]}
        departments={[{ id: DEPARTMENT_ID, name: "Internal Medicine" }]}
      />,
    );

    const form = screen.getByRole("search", { name: "Filter appointments" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/appointments");
    expect(screen.getByLabelText("Patient name")).toHaveValue("Synthetic");
    expect(screen.getByLabelText("Doctor")).toHaveValue(DOCTOR_ID);
    expect(screen.getByLabelText("Department")).toHaveValue("");
    expect(screen.getByLabelText("From")).toHaveValue("2026-11-01");
    expect(screen.getByRole("checkbox", { name: "Confirmed" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Completed" })).not.toBeChecked();
  });
});

describe("MonitoringDetailsView", () => {
  it("shows contact details, who confirmed, and the status timeline", () => {
    render(<MonitoringDetailsView appointment={DETAILS} />);

    expect(screen.getByText("patient@example.test")).toBeInTheDocument();
    expect(screen.getByText("09170000000")).toBeInTheDocument();
    expect(screen.getByText("Follow-up visit")).toBeInTheDocument();

    const confirmedBy = screen.getByText("Confirmed by").closest("div");
    expect(confirmedBy).toHaveTextContent("Synthetic Desk");

    const timeline = screen.getByRole("region", { name: "Status history" });
    expect(within(timeline).getByText("Synthetic Desk (Front desk)")).toBeInTheDocument();
    expect(within(timeline).getByText("Pending confirmation → Confirmed")).toBeInTheDocument();
  });

  it("offers no status-change actions", () => {
    render(<MonitoringDetailsView appointment={DETAILS} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
