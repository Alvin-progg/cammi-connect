// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { getProfileForAuthUser } from "@/server/profiles/service";
import { signIn, signOut, signUpPatient } from "@/server/auth/service";
import { loginAction, registerAction, signOutAction } from "@/server/auth/actions";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({
  signIn: vi.fn(),
  signUpPatient: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/server/profiles/service", () => ({
  getProfileForAuthUser: vi.fn(),
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
  vi.mocked(signIn).mockResolvedValue({
    ok: true,
    userId: "auth-user-1",
  });
  vi.mocked(getProfileForAuthUser).mockResolvedValue({
    id: "patient-profile-1",
    role: "patient",
    fullName: "Pat Doe",
  });
});

describe("loginAction", () => {
  it("redirects a patient to /chat with a sign-in notice", async () => {
    await loginAction({}, loginFormData());
    expect(redirect).toHaveBeenCalledWith("/chat?auth_notice=signed-in");
  });

  it("redirects a doctor to the doctor dashboard", async () => {
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "doctor-profile-1",
      role: "doctor",
      fullName: "Dr. Maya Santos",
    });

    await loginAction({}, loginFormData());
    expect(redirect).toHaveBeenCalledWith("/doctor?auth_notice=signed-in");
  });

  it("redirects an admin to /account until an admin dashboard exists", async () => {
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "admin-profile-1",
      role: "admin",
      fullName: "Synthetic Admin",
    });

    await loginAction({}, loginFormData());
    expect(redirect).toHaveBeenCalledWith("/account?auth_notice=signed-in");
  });

  it("prefers an explicit next path over the role landing path", async () => {
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "doctor-profile-1",
      role: "doctor",
      fullName: "Dr. Maya Santos",
    });

    await loginAction({}, loginFormData({ next: "/appointments" }));
    expect(redirect).toHaveBeenCalledWith("/appointments?auth_notice=signed-in");
  });

  it("falls back to /account when the profile cannot be loaded", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getProfileForAuthUser).mockRejectedValue(
      new Error("database unavailable"),
    );

    await loginAction({}, loginFormData());
    expect(redirect).toHaveBeenCalledWith("/account?auth_notice=signed-in");
    consoleError.mockRestore();
  });

  it("falls back to /account when the account has no profile", async () => {
    vi.mocked(getProfileForAuthUser).mockResolvedValue(null);

    await loginAction({}, loginFormData());
    expect(redirect).toHaveBeenCalledWith("/account?auth_notice=signed-in");
  });

  it("redirects to a sanitized next path with a sign-in notice", async () => {
    await loginAction({}, loginFormData({ next: "/appointments" }));
    expect(redirect).toHaveBeenCalledWith("/appointments?auth_notice=signed-in");
  });

  it("preserves existing query parameters and hashes in the next path", async () => {
    await loginAction({}, loginFormData({ next: "/appointments?tab=upcoming#top" }));
    expect(redirect).toHaveBeenCalledWith(
      "/appointments?tab=upcoming&auth_notice=signed-in#top",
    );
  });

  it("falls back to the role landing path when next is an open-redirect candidate", async () => {
    await loginAction({}, loginFormData({ next: "//evil.example" }));
    expect(redirect).toHaveBeenCalledWith("/chat?auth_notice=signed-in");
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

  it("sends a new patient to /chat when no next path is given", async () => {
    vi.mocked(signUpPatient).mockResolvedValue({ ok: true, sessionCreated: true });
    await registerAction({}, registerFormData());
    expect(redirect).toHaveBeenCalledWith("/chat");
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
      expect.objectContaining({ next: "/chat" }),
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
