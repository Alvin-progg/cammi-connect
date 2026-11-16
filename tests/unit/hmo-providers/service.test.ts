// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HmoProvider } from "@/lib/hmo-providers/types";
import {
  getHmoProvider,
  listHmoProviders,
  saveHmoProvider,
  setHmoProviderActive,
  type HmoProviderAdminStore,
} from "@/server/hmo-providers/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MAXICARE_ID = "00000000-0000-4000-8000-000000000a01";

const MAXICARE: HmoProvider = {
  id: MAXICARE_ID,
  name: "Maxicare",
  copayCentavos: 0,
  notes: "Synthetic sample.",
  isActive: true,
};

function fakeStore() {
  return {
    listHmoProviders: vi.fn().mockResolvedValue([MAXICARE]),
    getHmoProvider: vi.fn().mockResolvedValue(MAXICARE),
    save: vi.fn().mockResolvedValue({ ok: true, hmoProviderId: MAXICARE_ID }),
    setActive: vi.fn().mockResolvedValue({ ok: true }),
  } satisfies HmoProviderAdminStore;
}

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
});

describe("HMO provider reads", () => {
  it("lists providers and returns one, or null when it is missing", async () => {
    await expect(listHmoProviders(store)).resolves.toEqual([MAXICARE]);
    await expect(getHmoProvider(MAXICARE_ID, store)).resolves.toEqual(MAXICARE);
    store.getHmoProvider.mockResolvedValue(null);
    await expect(getHmoProvider(MAXICARE_ID, store)).resolves.toBeNull();
  });
});

describe("saveHmoProvider", () => {
  const INPUT = { name: "Maxicare", copayCentavos: 10000, notes: null };

  it("saves as the given admin and returns the id", async () => {
    await expect(
      saveHmoProvider({ actorId: ADMIN_ID, hmoProviderId: null, input: INPUT }, store),
    ).resolves.toEqual({ ok: true, hmoProviderId: MAXICARE_ID, message: "HMO provider saved." });
    expect(store.save).toHaveBeenCalledWith({ actorId: ADMIN_ID, hmoProviderId: null, ...INPUT });
  });

  it("maps database refusals to messages, and anything else to a generic failure", async () => {
    store.save.mockResolvedValue({ ok: false, code: "duplicate" });
    await expect(
      saveHmoProvider({ actorId: ADMIN_ID, hmoProviderId: null, input: INPUT }, store),
    ).resolves.toEqual({ ok: false, message: "An HMO provider with that name already exists." });

    store.save.mockResolvedValue({ ok: false, code: "invalid_price" });
    await expect(
      saveHmoProvider({ actorId: ADMIN_ID, hmoProviderId: MAXICARE_ID, input: INPUT }, store),
    ).resolves.toEqual({ ok: false, message: "Amounts can't be negative." });

    store.save.mockResolvedValue({ ok: false, code: undefined });
    await expect(
      saveHmoProvider({ actorId: ADMIN_ID, hmoProviderId: MAXICARE_ID, input: INPUT }, store),
    ).resolves.toEqual({ ok: false, message: "Something went wrong. Try again." });
  });
});

describe("setHmoProviderActive", () => {
  it("reports the new status, or the refusal", async () => {
    await expect(
      setHmoProviderActive({ actorId: ADMIN_ID, hmoProviderId: MAXICARE_ID, isActive: false }, store),
    ).resolves.toEqual({ ok: true, message: "HMO provider deactivated." });
    store.setActive.mockResolvedValue({ ok: false, code: "unchanged" });
    await expect(
      setHmoProviderActive({ actorId: ADMIN_ID, hmoProviderId: MAXICARE_ID, isActive: true }, store),
    ).resolves.toEqual({ ok: false, message: "Nothing to change." });
  });
});
