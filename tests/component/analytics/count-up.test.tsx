import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountUp } from "@/components/ui/count-up";

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reduce && query.includes("reduce"), media: query })),
  );
}

describe("CountUp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always exposes the final formatted value to assistive technology", () => {
    mockReducedMotion(false);

    const { container } = render(<CountUp value={64.5} decimals={2} suffix="%" />);

    expect(container.querySelector(".sr-only")).toHaveTextContent("64.50%");
  });

  it("shows the final value at once under reduced motion", () => {
    mockReducedMotion(true);

    const { container } = render(<CountUp value={1234} />);

    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("1,234");
  });
});
