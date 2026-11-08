import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/lib/appointments/status";

const LABELS: Array<[AppointmentStatus, string]> = [
  ["requested", "Pending confirmation"],
  ["confirmed", "Confirmed"],
  ["rejected", "Rejected"],
  ["checked_in", "Checked in"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["no_show", "No-show"],
];

describe("StatusBadge", () => {
  it.each(LABELS)("renders the %s status as visible text", (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
