import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppointmentsPanelSkeleton } from "@/components/chat/appointments-panel-skeleton";

describe("AppointmentsPanelSkeleton", () => {
  it("shows no real appointment text, only decorative placeholders", () => {
    const { container } = render(<AppointmentsPanelSkeleton />);

    expect(container.textContent).toBe("");
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("renders two upcoming card placeholders and one past table frame", () => {
    const { container } = render(<AppointmentsPanelSkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelectorAll(".overflow-hidden.rounded-xl")).toHaveLength(1);
  });
});
