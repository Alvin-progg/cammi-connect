import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import type { AppointmentStatus } from "@/lib/appointments/status";

const LABELS: Array<[AppointmentStatus, string]> = [
  ["requested", "Requested"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["no_show", "No-show"],
];

describe("AppointmentStatusBadge", () => {
  it.each(LABELS)("renders the %s status as visible text", (status, label) => {
    render(<AppointmentStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
