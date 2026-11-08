// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, settingsGroupSchemas } from "@/lib/settings/schema";
import { getSettings, saveSettingGroup, type SettingsStore } from "@/server/settings/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

function fakeStore(
  rows: { key: string; value: unknown }[] = [],
  saved: Awaited<ReturnType<SettingsStore["save"]>> = { ok: true },
): SettingsStore {
  return {
    listSettings: vi.fn().mockResolvedValue(rows),
    save: vi.fn().mockResolvedValue(saved),
  };
}

const chatbotDefaults = settingsGroupSchemas.chatbot.parse({
  "chatbot.enabled": DEFAULT_SETTINGS["chatbot.enabled"],
  "chatbot.welcome_message": DEFAULT_SETTINGS["chatbot.welcome_message"],
  "chatbot.enabled_categories": DEFAULT_SETTINGS["chatbot.enabled_categories"],
});

describe("getSettings", () => {
  it("resolves stored rows over the defaults", async () => {
    const store = fakeStore([{ key: "chatbot.enabled", value: false }]);
    const settings = await getSettings(store);
    expect(settings["chatbot.enabled"]).toBe(false);
    expect(settings["appointment.max_advance_days"]).toBe(60);
  });
});

describe("saveSettingGroup", () => {
  it("sends only the changed keys, as the session admin", async () => {
    const store = fakeStore([{ key: "chatbot.welcome_message", value: "Old hello" }]);

    const result = await saveSettingGroup(
      {
        actorId: ADMIN_ID,
        values: { ...chatbotDefaults, "chatbot.welcome_message": "New hello" },
      },
      store,
    );

    expect(result).toEqual({ ok: true, message: "Settings saved." });
    expect(store.save).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      values: { "chatbot.welcome_message": "New hello" },
    });
  });

  it("refuses without a database call when nothing changed", async () => {
    const store = fakeStore();
    const result = await saveSettingGroup({ actorId: ADMIN_ID, values: chatbotDefaults }, store);
    expect(result).toEqual({ ok: false, message: "Nothing changed." });
    expect(store.save).not.toHaveBeenCalled();
  });

  it("maps database refusals to safe messages", async () => {
    const values = { ...chatbotDefaults, "chatbot.enabled": false };

    await expect(
      saveSettingGroup({ actorId: ADMIN_ID, values }, fakeStore([], { ok: false, code: "not_admin" })),
    ).resolves.toEqual({ ok: false, message: "You are not authorized to change settings." });
    await expect(
      saveSettingGroup({ actorId: ADMIN_ID, values }, fakeStore([], { ok: false, code: "unknown_key" })),
    ).resolves.toEqual({ ok: false, message: "That setting can't be changed." });
    await expect(
      saveSettingGroup({ actorId: ADMIN_ID, values }, fakeStore([], { ok: false, code: undefined })),
    ).resolves.toEqual({ ok: false, message: "Something went wrong. Try again." });
  });
});
