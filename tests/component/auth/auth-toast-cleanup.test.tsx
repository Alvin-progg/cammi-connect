import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthToastCleanup } from "@/components/auth/auth-toast-cleanup";

const mocks = vi.hoisted(() => ({
  pathname: "/login",
  dismiss: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("sonner", () => ({
  toast: { dismiss: mocks.dismiss },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/login";
});

describe("AuthToastCleanup", () => {
  it("dismisses the previous auth screen's error toast after navigation", async () => {
    const { rerender } = render(<AuthToastCleanup />);

    mocks.pathname = "/register";
    rerender(<AuthToastCleanup />);

    await waitFor(() =>
      expect(mocks.dismiss).toHaveBeenCalledWith("login-error"),
    );
  });

  it("dismisses the register error after leaving the register page", async () => {
    mocks.pathname = "/register";
    const { rerender } = render(<AuthToastCleanup />);

    mocks.pathname = "/login";
    rerender(<AuthToastCleanup />);

    await waitFor(() =>
      expect(mocks.dismiss).toHaveBeenCalledWith("register-error"),
    );
  });

  it("does not dismiss toasts when the pathname is unchanged", () => {
    const { rerender } = render(<AuthToastCleanup />);

    rerender(<AuthToastCleanup />);

    expect(mocks.dismiss).not.toHaveBeenCalled();
  });
});
