import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TableFrame } from "@/components/front-desk/table-frame";

describe("TableFrame", () => {
  it("names the table with a caption inside a keyboard-scrollable region", () => {
    render(
      <TableFrame label="Daily schedule" minWidthClass="min-w-[60rem]">
        <thead>
          <tr>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>9:30 AM</td>
          </tr>
        </tbody>
      </TableFrame>,
    );

    // design.md §5.7: a wide table scrolls in a focusable, labelled wrapper.
    const region = screen.getByRole("region", { name: "Daily schedule" });
    expect(region).toHaveAttribute("tabindex", "0");
    const table = within(region).getByRole("table", { name: "Daily schedule" });
    expect(table.querySelector("caption")).toHaveTextContent("Daily schedule");
    expect(within(table).getByText("9:30 AM")).toBeInTheDocument();
  });
});
