// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { getAdminSession } from "@/server/auth/dal";
import { saveKnowledgeDocument } from "@/server/knowledge/admin-service";
import {
  saveSettingsAction,
  sendPolicyToKnowledgeBaseAction,
} from "@/server/settings/actions";
import { getSettings, saveSettingGroup } from "@/server/settings/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/settings/repository", () => ({ supabaseSettingsRepository: {} }));
vi.mock("@/server/settings/service", () => ({
  getSettings: vi.fn(),
  saveSettingGroup: vi.fn(),
}));
vi.mock("@/server/knowledge/admin-repository", () => ({ supabaseKnowledgeAdminRepository: {} }));
vi.mock("@/server/knowledge/admin-service", () => ({ saveKnowledgeDocument: vi.fn() }));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000901";

const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
};

function formData(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const chatbotForm: [string, string][] = [
  ["group", "chatbot"],
  ["chatbot.enabled", "on"],
  ["chatbot.welcome_message", " Welcome! "],
  ["chatbot.enabled_categories", "services"],
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
  vi.mocked(getSettings).mockResolvedValue(DEFAULT_SETTINGS);
  vi.mocked(saveSettingGroup).mockResolvedValue({ ok: true, message: "Settings saved." });
  vi.mocked(saveKnowledgeDocument).mockResolvedValue({
    ok: true,
    documentId: DOCUMENT_ID,
    message: "Document saved.",
  });
});

describe("saveSettingsAction", () => {
  it("denies non-admin accounts without calling the service layer", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    await expect(saveSettingsAction(IDLE, formData(chatbotForm))).resolves.toEqual({
      status: "error",
      message: "You are not authorized to change settings.",
    });
    expect(saveSettingGroup).not.toHaveBeenCalled();
  });

  it("rejects an unknown settings group", async () => {
    await expect(
      saveSettingsAction(IDLE, formData([["group", "model"], ["llm.temperature", "1"]])),
    ).resolves.toEqual({ status: "error", message: "Those settings are not valid." });
    expect(saveSettingGroup).not.toHaveBeenCalled();
  });

  it("shows the first validation message", async () => {
    const result = await saveSettingsAction(
      IDLE,
      formData([["group", "chatbot"], ["chatbot.welcome_message", "Hi"]]),
    );
    expect(result).toEqual({ status: "error", message: "Enable at least one category." });
    expect(saveSettingGroup).not.toHaveBeenCalled();
  });

  it("saves the tab as the session admin and revalidates settings and chat", async () => {
    const result = await saveSettingsAction(
      IDLE,
      formData([...chatbotForm, ["actorId", "forged"]]),
    );

    expect(result).toEqual({ status: "success", message: "Settings saved." });
    expect(saveSettingGroup).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        values: {
          "chatbot.enabled": true,
          "chatbot.welcome_message": "Welcome!",
          "chatbot.enabled_categories": ["services"],
        },
      },
      {},
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/chat");
  });

  it("returns the service refusal without revalidating", async () => {
    vi.mocked(saveSettingGroup).mockResolvedValue({ ok: false, message: "Nothing changed." });
    await expect(saveSettingsAction(IDLE, formData(chatbotForm))).resolves.toEqual({
      status: "error",
      message: "Nothing changed.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("sendPolicyToKnowledgeBaseAction", () => {
  it("denies non-admin accounts", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    await expect(
      sendPolicyToKnowledgeBaseAction(
        IDLE,
        formData([["key", "appointment.cancellation_policy_text"]]),
      ),
    ).resolves.toEqual({ status: "error", message: "You are not authorized to change settings." });
    expect(saveKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("accepts only the two policy keys", async () => {
    await expect(
      sendPolicyToKnowledgeBaseAction(IDLE, formData([["key", "chatbot.welcome_message"]])),
    ).resolves.toEqual({ status: "error", message: "Those settings are not valid." });
    expect(saveKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("refuses a policy that has no saved text", async () => {
    await expect(
      sendPolicyToKnowledgeBaseAction(
        IDLE,
        formData([["key", "appointment.reschedule_policy_text"]]),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "Save the policy text before sending it to the knowledge base.",
    });
    expect(saveKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("creates a draft from the saved text, never the form, and opens it", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      "appointment.cancellation_policy_text": "Cancel at least a day ahead.",
    });

    await sendPolicyToKnowledgeBaseAction(
      IDLE,
      formData([
        ["key", "appointment.cancellation_policy_text"],
        ["content", "forged text"],
      ]),
    );

    expect(saveKnowledgeDocument).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        documentId: null,
        input: {
          title: "Cancellation policy",
          category: "appointment_procedures",
          content: "Cancel at least a day ahead.",
        },
        sourceFileName: null,
      },
      {},
    );
    expect(redirect).toHaveBeenCalledWith(`/admin/knowledge-base/${DOCUMENT_ID}`);
  });

  it("returns the knowledge refusal", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      "appointment.reschedule_policy_text": "Reschedule by phone.",
    });
    vi.mocked(saveKnowledgeDocument).mockResolvedValue({ ok: false, message: "Nope." });
    await expect(
      sendPolicyToKnowledgeBaseAction(
        IDLE,
        formData([["key", "appointment.reschedule_policy_text"]]),
      ),
    ).resolves.toEqual({ status: "error", message: "Nope." });
    expect(redirect).not.toHaveBeenCalled();
  });
});
