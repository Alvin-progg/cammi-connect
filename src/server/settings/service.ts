import "server-only";

import {
  diffSettings,
  resolveSettings,
  type SystemSettings,
} from "@/lib/settings/schema";

/** Data access for system settings. Callers authorize first; `actorId` comes from the admin session. */
export type SettingsStore = {
  listSettings(): Promise<{ key: string; value: unknown }[]>;
  save(input: {
    actorId: string;
    values: Partial<SystemSettings>;
  }): Promise<{ ok: true } | { ok: false; code: string | undefined }>;
};

const REFUSAL_MESSAGES: Record<string, string> = {
  not_admin: "You are not authorized to change settings.",
  unknown_key: "That setting can't be changed.",
  unchanged: "Nothing changed.",
};

const GENERIC_FAILURE = "Something went wrong. Try again.";

/**
 * The effective settings, read on every call. The table holds a handful of
 * rows, so there is no cache to invalidate; saves revalidate the pages.
 */
export async function getSettings(store: SettingsStore): Promise<SystemSettings> {
  return resolveSettings(await store.listSettings());
}

/** Saves one tab's validated values, sending only the keys that changed. */
export async function saveSettingGroup(
  { actorId, values }: { actorId: string; values: Partial<SystemSettings> },
  store: SettingsStore,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const changes = diffSettings(await getSettings(store), values);
  if (changes.length === 0) {
    return { ok: false, message: REFUSAL_MESSAGES.unchanged };
  }

  const outcome = await store.save({
    actorId,
    values: Object.fromEntries(changes.map((change) => [change.key, change.next])),
  });
  if (!outcome.ok) {
    return {
      ok: false,
      message: (outcome.code && REFUSAL_MESSAGES[outcome.code]) || GENERIC_FAILURE,
    };
  }
  return { ok: true, message: "Settings saved." };
}
