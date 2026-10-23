// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { signIn, signOut, signUpPatient } from "@/server/auth/service";
import { loginAction, registerAction, signOutAction } from "@/server/auth/actions";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({
  signIn: vi.fn(),
  signUpPatient: vi.fn(),
  signOut: vi.fn(),
}));

function loginFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("email", "pat@example.com");
  formData.set("password", "secret123");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

function registerFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("fullName", "Pat Doe");
  formData.set("email", "pat@example.com");
  formData.set("password", "secret123");
  formData.set("confirmPassword", "secret123");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginAction", () => {
  it("redirects to /account with a sign-in notice after a successful sign-in", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true });
    await loginAction({}, loginFormData());
    expect(redirect).toHaveBeenCalledWith("/account?auth_notice=signed-in");
  });

  it("redirects to a sanitized next path with a sign-in notice", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true });
    await loginAction({}, loginFormData({ next: "/appointments" }));
    expect(redirect).toHaveBeenCalledWith("/appointments?auth_notice=signed-in");
  });

  it("preserves existing query parameters and hashes in the next path", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true });
    await loginAction({}, loginFormData({ next: "/appointments?tab=upcoming#top" }));
    expect(redirect).toHaveBeenCalledWith(
      "/appointments?tab=upcoming&auth_notice=signed-in#top",
    );
  });

  it("falls back to /account when next is an open-redirect candidate", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true });
    await loginAction({}, loginFormData({ next: "//evil.example" }));
    expect(redirect).toHaveBeenCalledWith("/account?auth_notice=signed-in");
  });

  it("returns field errors and skips sign-in for invalid input", async () => {
    const state = await loginAction({}, loginFormData({ email: "not-an-email" }));
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("maps a provider failure code to a user-safe form error", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, code: "invalid_credentials" });
    const state = await loginAction({}, loginFormData());
    expect(state.formError).toBe("Email or password is incorrect.");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("registerAction", () => {
  it("redirects when a session is created immediately", async () => {
    vi.mocked(signUpPatient).mockResolvedValue({ ok: true, sessionCreated: true });
    await registerAction({}, registerFormData({ next: "/account" }));
    expect(redirect).toHaveBeenCalledWith("/account");
  });

  it("returns a neutral confirmation when email confirmation is required", async () => {
    vi.mocked(signUpPatient).mockResolvedValue({ ok: true, sessionCreated: false });
    const state = await registerAction({}, registerFormData());
    expect(state.success).toBe(
      "If an account can be created for this email, check your inbox.",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("passes the sanitized next path to the sign-up service", async () => {
    vi.mocked(signUpPatient).mockResolvedValue({ ok: true, sessionCreated: false });
    await registerAction({}, registerFormData({ next: "//evil.example" }));
    expect(signUpPatient).toHaveBeenCalledWith(
      expect.objectContaining({ next: "/account" }),
    );
  });

  it("maps an existing-account error to the neutral message", async () => {
    vi.mocked(signUpPatient).mockResolvedValue({
      ok: false,
      code: "user_already_exists",
    });
    const state = await registerAction({}, registerFormData());
    expect(state.formError).toBe(
      "If an account can be created for this email, check your inbox.",
    );
  });

  it("returns field errors and skips sign-up for mismatched passwords", async () => {
    const state = await registerAction(
      {},
      registerFormData({ confirmPassword: "different" }),
    );
    expect(state.fieldErrors?.confirmPassword).toBeTruthy();
    expect(signUpPatient).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  it("signs out and redirects to /login", async () => {
    vi.mocked(signOut).mockResolvedValue(undefined);
    await signOutAction();
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
