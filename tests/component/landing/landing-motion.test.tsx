import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroParallax, RevealDelayed, RevealGroup, RevealItem, ScrollHeader, ScrollProgressLine } from "@/components/landing/landing-motion";

// motion caches the media query once per module, so tests stub the hook itself.
const useReducedMotionMock = vi.hoisted(() => vi.fn());
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: useReducedMotionMock,
}));

function mockReducedMotion(reduced: boolean) {
  useReducedMotionMock.mockReturnValue(reduced);
}

afterEach(() => {
  window.scrollY = 0;
});

describe("ScrollHeader", () => {
  beforeEach(() => mockReducedMotion(false));

  it("marks the header scrolled only after the page scrolls past the threshold", () => {
    render(<ScrollHeader className="header">Brand</ScrollHeader>);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-scrolled", "false");

    act(() => {
      window.scrollY = 40;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header).toHaveAttribute("data-scrolled", "true");

    act(() => {
      window.scrollY = 0;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header).toHaveAttribute("data-scrolled", "false");
  });
});

describe("HeroParallax", () => {
  it("renders its children with motion on and with reduced motion", () => {
    mockReducedMotion(false);
    const { unmount } = render(<HeroParallax>mockup</HeroParallax>);
    expect(screen.getByText("mockup")).toBeInTheDocument();
    unmount();

    mockReducedMotion(true);
    render(<HeroParallax>mockup</HeroParallax>);
    expect(screen.getByText("mockup")).toBeInTheDocument();
  });
});

describe("ScrollProgressLine", () => {
  it("shows a full line without scroll linking under reduced motion", () => {
    mockReducedMotion(true);
    render(
      <ScrollProgressLine>
        <span>steps</span>
      </ScrollProgressLine>,
    );
    expect(screen.getByText("steps")).toBeInTheDocument();
    expect(screen.getByTestId("progress-line-fill").style.transform).toBe("none");
  });

  it("starts empty when motion is allowed", () => {
    mockReducedMotion(false);
    render(
      <ScrollProgressLine>
        <span>steps</span>
      </ScrollProgressLine>,
    );
    expect(screen.getByTestId("progress-line-fill").style.transform).toContain("scaleX(0)");
  });
});

describe("RevealDelayed", () => {
  it("renders its children in the final state under reduced motion", () => {
    mockReducedMotion(true);
    render(<RevealDelayed delay={0.3}>bubble</RevealDelayed>);
    expect(screen.getByText("bubble")).toBeVisible();
    expect(screen.getByText("bubble").style.opacity).toBe("");
  });

  it("starts hidden until its RevealGroup is shown", () => {
    mockReducedMotion(false);
    // jsdom never scrolls the group into view, so it stays in its hidden state.
    render(
      <RevealGroup stagger={0.06}>
        <RevealItem>
          <RevealDelayed delay={0.3}>bubble</RevealDelayed>
        </RevealItem>
      </RevealGroup>,
    );
    expect(screen.getByText("bubble").style.opacity).toBe("0");
  });
});
