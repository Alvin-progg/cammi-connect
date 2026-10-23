import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthNotice } from "@/components/auth/auth-notice";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
  useSearchParams: () => mocks.params,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn(), dismiss: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = new URLSearchParams();
});

describe("AuthNotice", () => {
  it("shows a signed-in toast and removes the notice param", async () => {
    mocks.params = new URLSearchParams("auth_notice=signed-in");
    render(<AuthNotice />);
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Signed in", {
        id: "auth-notice",
        description: "You are now signed in.",
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/account", { scroll: false });
  });

  it("preserves other query parameters when removing the notice", async () => {
    mocks.params = new URLSearchParams("auth_notice=signed-in&tab=upcoming");
    render(<AuthNotice />);
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/account?tab=upcoming", {
        scroll: false,
      }),
    );
  });

  it("ignores an unknown notice", () => {
    mocks.params = new URLSearchParams("auth_notice=unknown");
    render(<AuthNotice />);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
