import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatMaintenance } from "@/components/chat/chat-maintenance";

describe("ChatMaintenance", () => {
  it("tells the patient Cami is offline and how to reach the front desk", () => {
    render(<ChatMaintenance contactPhone="(02) 8000 0000" />);

    expect(screen.getByRole("heading", { name: /Cami is offline/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "(02) 8000 0000" })).toHaveAttribute(
      "href",
      "tel:(02)80000000",
    );
  });

  it("asks the patient to contact the front desk when no phone is set", () => {
    render(<ChatMaintenance contactPhone="" />);

    expect(screen.getByText(/contact the hospital front desk/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
