// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import {
  saveHmoProviderAction,
  setHmoProviderActiveAction,
} from "@/server/hmo-providers/actions";
import { saveHmoProvider, setHmoProviderActive } from "@/server/hmo-providers/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/hmo-providers/repository", () => ({ supabaseHmoProviderAdminRepository: {} }));
vi.mock("@/server/hmo-providers/service", () => ({
  saveHmoProvider: vi.fn(),
  setHmoProviderActive: vi.fn(),
}));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const HMO_ID = "00000000-0000-4000-8000-000000000a01";

const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
};

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
  vi.mocked(saveHmoProvider).mockResolvedValue({
    ok: true,
    hmoProviderId: HMO_ID,
    message: "HMO provider saved.",
  });
  vi.mocked(setHmoProviderActive).mockResolvedValue({
    ok: true,
    message: "HMO provider deactivated.",
  });
});

describe("HMO provider actions", () => {
  it("denies non-admin accounts without calling the service layer", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = { status: "error", message: "You are not authorized to manage HMO providers." };

    await expect(saveHmoProviderAction(IDLE, formData({ name: "Maxicare" }))).resolves.toEqual(denied);
    await expect(
      setHmoProviderActiveAction(IDLE, formData({ hmoProviderId: HMO_ID, isActive: "false" })),
    ).resolves.toEqual(denied);
    expect(saveHmoProvider).not.toHaveBeenCalled();
    expect(setHmoProviderActive).not.toHaveBeenCalled();
  });

  it("creates a provider as the session admin, clears the reference cache, and opens it", async () => {
    await saveHmoProviderAction(
      IDLE,
      formData({ name: " Maxicare ", copay: "100", notes: "", actorId: "forged" }),
    );

    expect(saveHmoProvider).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        hmoProviderId: null,
        input: { name: "Maxicare", copayCentavos: 10000, notes: null },
      },
      expect.anything(),
    );
    expect(updateTag).toHaveBeenCalledWith("reference");
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(redirect).toHaveBeenCalledWith(`/admin/hmo-providers/${HMO_ID}`);
  });

  it("updates in place and returns validation errors without saving", async () => {
    await expect(
      saveHmoProviderAction(IDLE, formData({ hmoProviderId: HMO_ID, name: "Maxicare" })),
    ).resolves.toEqual({ status: "success", message: "HMO provider saved." });
    expect(redirect).not.toHaveBeenCalled();

    vi.mocked(saveHmoProvider).mockClear();
    await expect(
      saveHmoProviderAction(IDLE, formData({ name: "Maxicare", copay: "-5" })),
    ).resolves.toEqual({ status: "error", message: "Enter the co-pay in pesos, like 100 or 100.50." });
    expect(saveHmoProvider).not.toHaveBeenCalled();
  });

  it("rejects malformed ids", async () => {
    const invalid = { status: "error", message: "That HMO provider is not valid." };
    await expect(
      saveHmoProviderAction(IDLE, formData({ hmoProviderId: "nope", name: "Maxicare" })),
    ).resolves.toEqual(invalid);
    await expect(
      setHmoProviderActiveAction(IDLE, formData({ hmoProviderId: "nope", isActive: "true" })),
    ).resolves.toEqual(invalid);
  });

  it("changes the status as the session admin", async () => {
    await expect(
      setHmoProviderActiveAction(IDLE, formData({ hmoProviderId: HMO_ID, isActive: "false" })),
    ).resolves.toEqual({ status: "success", message: "HMO provider deactivated." });
    expect(setHmoProviderActive).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, hmoProviderId: HMO_ID, isActive: false },
      expect.anything(),
    );
    expect(updateTag).toHaveBeenCalledWith("reference");
  });
});
