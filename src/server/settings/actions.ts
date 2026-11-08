"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { knowledgeFormSchema } from "@/lib/knowledge/schemas";
import {
  SETTING_GROUPS,
  settingsFromFormData,
  settingsGroupSchemas,
} from "@/lib/settings/schema";
import { getAdminSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";
import { supabaseKnowledgeAdminRepository } from "@/server/knowledge/admin-repository";
import { saveKnowledgeDocument } from "@/server/knowledge/admin-service";

import { supabaseSettingsRepository } from "./repository";
import { getSettings, saveSettingGroup } from "./service";

export type SettingsActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const SETTINGS_PATH = "/admin/settings";

const NOT_AUTHORIZED: SettingsActionState = {
  status: "error",
  message: "You are not authorized to change settings.",
};

const INVALID_SETTINGS: SettingsActionState = {
  status: "error",
  message: "Those settings are not valid.",
};

/** Policy texts that can become a draft knowledge document, with the draft's title. */
const POLICY_DOCUMENT_TITLES = {
  "appointment.cancellation_policy_text": "Cancellation policy",
  "appointment.reschedule_policy_text": "Reschedule policy",
} as const;

const policyKeySchema = z.enum(
  Object.keys(POLICY_DOCUMENT_TITLES) as [keyof typeof POLICY_DOCUMENT_TITLES],
);

/** The acting admin's profile ID, always from the session and never from the form. */
async function requireAdminActor(): Promise<string | null> {
  const session = await getAdminSession(SETTINGS_PATH);
  return session?.admin.id ?? null;
}

/** Saves one settings tab. The tab comes from a hidden `group` field. */
export async function saveSettingsAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const group = z.enum(SETTING_GROUPS).safeParse(formData.get("group"));
  if (!group.success) {
    return INVALID_SETTINGS;
  }
  const parsed = settingsGroupSchemas[group.data].safeParse(
    settingsFromFormData(group.data, formData),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the form values.",
    };
  }

  const result = await saveSettingGroup(
    { actorId, values: parsed.data },
    supabaseSettingsRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath(SETTINGS_PATH);
  // The welcome message and chatbot switch show on the patient chat page.
  revalidatePath("/chat");
  return { status: "success", message: result.message };
}

/**
 * Creates a draft knowledge document from a saved policy text, so Cami can
 * answer from it once an admin reviews and publishes it. The saved value is
 * used, never the form's, so the draft matches what the hospital approved.
 */
export async function sendPolicyToKnowledgeBaseAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const key = policyKeySchema.safeParse(formData.get("key"));
  if (!key.success) {
    return INVALID_SETTINGS;
  }
  const settings = await getSettings(supabaseSettingsRepository);
  const document = knowledgeFormSchema.safeParse({
    title: POLICY_DOCUMENT_TITLES[key.data],
    category: "appointment_procedures",
    content: settings[key.data],
  });
  if (!document.success) {
    return {
      status: "error",
      message: "Save the policy text before sending it to the knowledge base.",
    };
  }

  const result = await saveKnowledgeDocument(
    { actorId, documentId: null, input: document.data, sourceFileName: null },
    supabaseKnowledgeAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin/knowledge-base");
  redirect(`/admin/knowledge-base/${result.documentId}`);
}
