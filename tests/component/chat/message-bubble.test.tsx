import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantStatus, MessageBubble } from "@/components/chat/message-bubble";

function stubMotionPreference({ reduce }: { reduce: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduce : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const REPLY = "Visiting hours are from nine in the morning until eight in the evening.";

function renderList(ui: React.ReactNode) {
  return render(<ol>{ui}</ol>);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AssistantStatus", () => {
  it("shows a thinking label with a live seconds counter while pending", () => {
    vi.setSystemTime(0);
    renderList(<AssistantStatus startedAt={Date.now()} />);

    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(screen.getByText("0.0s")).toBeInTheDocument();
    expect(screen.getByText("CamiConnect is replying…")).toHaveClass("sr-only");

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.getByText("2.4s")).toBeInTheDocument();
  });
});

describe("MessageBubble reveal", () => {
  it("types out a new reply word by word and shows how long it took", () => {
    stubMotionPreference({ reduce: false });
    renderList(
      <MessageBubble
        role="assistant"
        content={REPLY}
        payload={{ kind: "not_verified" }}
        reveal={{ elapsedMs: 3200 }}
      />,
    );

    expect(screen.getByText("Replied in 3.2s")).toBeInTheDocument();
    // Screen readers get the whole reply at once.
    expect(screen.getByText(REPLY)).toHaveClass("sr-only");
    const visible = screen.getByTestId("reveal-text");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(visible.textContent).not.toBe(REPLY);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId("reveal-text")).not.toBeInTheDocument();
    expect(screen.getByText(REPLY)).not.toHaveClass("sr-only");
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("shows the whole reply at once when reduced motion is preferred", () => {
    stubMotionPreference({ reduce: true });
    renderList(
      <MessageBubble
        role="assistant"
        content={REPLY}
        payload={{ kind: "not_verified" }}
        reveal={{ elapsedMs: 900 }}
      />,
    );

    expect(screen.getByText("Replied in 0.9s")).toBeInTheDocument();
    expect(screen.queryByTestId("reveal-text")).not.toBeInTheDocument();
    expect(screen.getByText(REPLY)).toBeInTheDocument();
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("renders history replies immediately with no status row", () => {
    stubMotionPreference({ reduce: false });
    renderList(<MessageBubble role="assistant" content={REPLY} />);

    expect(screen.queryByText(/Replied in/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("reveal-text")).not.toBeInTheDocument();
    expect(screen.getByText(REPLY)).toBeInTheDocument();
  });
});
