import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "@/components/ui/brand-mark";

describe("BrandMark", () => {
  it("renders the small color logo mark as a decorative image", () => {
    render(<BrandMark className="size-7" />);

    const mark = screen.getByRole("presentation", { hidden: true });
    expect(mark.getAttribute("src")).toContain("/logo/svg/cami-f-mark-color-small.svg");
    expect(mark.getAttribute("alt")).toBe("");
    expect(mark.getAttribute("class")).toContain("size-7");
  });
});
