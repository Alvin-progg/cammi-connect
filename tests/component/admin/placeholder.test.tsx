import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminPlaceholder } from "@/components/admin/placeholder";

describe("AdminPlaceholder", () => {
  it("tells the admin the section is not built yet", () => {
    render(<AdminPlaceholder section="Analytics" />);

    expect(screen.getByText("Not built yet")).toBeInTheDocument();
    expect(screen.getByText(/Analytics/)).toBeInTheDocument();
  });
});
