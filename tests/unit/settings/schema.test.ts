import { describe, expect, it } from "vitest";

import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge/types";
import {
  DEFAULT_SETTINGS,
  diffSettings,
  parseSettingsTab,
  resolveSettings,
  settingsFromFormData,
  settingsGroupSchemas,
  type SystemSettings,
} from "@/lib/settings/schema";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const appointmentValues = {
  "appointment.default_slot_minutes": 30,
  "appointment.request_expiry_hours": null,
  "appointment.min_lead_hours": 2,
  "appointment.max_advance_days": 60,
  "appointment.cancellation_policy_text": "",
  "appointment.reschedule_policy_text": "",
};

describe("settings group schemas", () => {
  it("accepts the defaults of every group", () => {
    for (const [group, schema] of Object.entries(settingsGroupSchemas)) {
      const values = Object.fromEntries(
        Object.keys(schema.shape).map((key) => [
          key,
          DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS],
        ]),
      );
      expect(schema.safeParse(values).success, group).toBe(true);
    }
  });

  it("rejects an unknown key", () => {
    const result = settingsGroupSchemas.appointment.safeParse({
      ...appointmentValues,
      "llm.temperature": 0.9,
    });
    expect(result.success).toBe(false);
  });

  it("keeps slot lengths to 15, 30, 45, or 60 minutes", () => {
    for (const minutes of [15, 30, 45, 60]) {
      expect(
        settingsGroupSchemas.appointment.safeParse({
          ...appointmentValues,
          "appointment.default_slot_minutes": minutes,
        }).success,
      ).toBe(true);
    }
    for (const minutes of [5, 20, 240]) {
      expect(
        settingsGroupSchemas.appointment.safeParse({
          ...appointmentValues,
          "appointment.default_slot_minutes": minutes,
        }).success,
      ).toBe(false);
    }
  });

  it("bounds lead hours, advance days, and request expiry", () => {
    const parse = (patch: Record<string, unknown>) =>
      settingsGroupSchemas.appointment.safeParse({ ...appointmentValues, ...patch }).success;

    expect(parse({ "appointment.min_lead_hours": 0 })).toBe(true);
    expect(parse({ "appointment.min_lead_hours": -1 })).toBe(false);
    expect(parse({ "appointment.min_lead_hours": 169 })).toBe(false);
    expect(parse({ "appointment.max_advance_days": 0 })).toBe(false);
    expect(parse({ "appointment.max_advance_days": 366 })).toBe(false);
    expect(parse({ "appointment.request_expiry_hours": 24 })).toBe(true);
    expect(parse({ "appointment.request_expiry_hours": 0 })).toBe(false);
  });

  it("requires a welcome message of at most 500 characters and one category", () => {
    const base = {
      "chatbot.enabled": true,
      "chatbot.welcome_message": "Hello",
      "chatbot.enabled_categories": ["services"],
    };
    const parse = (patch: Record<string, unknown>) =>
      settingsGroupSchemas.chatbot.safeParse({ ...base, ...patch }).success;

    expect(parse({})).toBe(true);
    expect(parse({ "chatbot.welcome_message": "  " })).toBe(false);
    expect(parse({ "chatbot.welcome_message": "a".repeat(501) })).toBe(false);
    expect(parse({ "chatbot.enabled_categories": [] })).toBe(false);
    expect(parse({ "chatbot.enabled_categories": ["model_settings"] })).toBe(false);
  });

  it("requires a valid contact email or none", () => {
    const hours = DEFAULT_SETTINGS["hospital.operating_hours"];
    const base = {
      "hospital.name": "Hospital",
      "hospital.address": "",
      "hospital.contact_phone": "",
      "hospital.contact_email": "",
      "hospital.operating_hours": hours,
    };
    const parse = (patch: Record<string, unknown>) =>
      settingsGroupSchemas.hospital.safeParse({ ...base, ...patch }).success;

    expect(parse({})).toBe(true);
    expect(parse({ "hospital.contact_email": "desk@example.test" })).toBe(true);
    expect(parse({ "hospital.contact_email": "not-an-email" })).toBe(false);
  });

  it("requires operating hours to open before they close", () => {
    const hours = DEFAULT_SETTINGS["hospital.operating_hours"].map((day) =>
      day.day === "mon" ? { day: "mon", open: "17:00", close: "08:00" } : day,
    );
    const result = settingsGroupSchemas.hospital.safeParse({
      "hospital.name": "Hospital",
      "hospital.address": "",
      "hospital.contact_phone": "",
      "hospital.contact_email": "",
      "hospital.operating_hours": hours,
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveSettings", () => {
  it("uses the defaults when nothing is stored", () => {
    expect(resolveSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it("uses stored values that parse and ignores bad or unknown rows", () => {
    const settings = resolveSettings([
      { key: "appointment.min_lead_hours", value: 6 },
      { key: "appointment.max_advance_days", value: "lots" },
      { key: "llm.model", value: "big" },
    ]);
    expect(settings["appointment.min_lead_hours"]).toBe(6);
    expect(settings["appointment.max_advance_days"]).toBe(60);
    expect(settings).not.toHaveProperty("llm.model");
  });

  it("enables every knowledge category by default", () => {
    expect(DEFAULT_SETTINGS["chatbot.enabled_categories"]).toEqual([...KNOWLEDGE_CATEGORIES]);
    expect(DEFAULT_SETTINGS["chatbot.enabled"]).toBe(true);
  });
});

describe("diffSettings", () => {
  it("lists only the keys whose values changed", () => {
    const next: SystemSettings = {
      ...DEFAULT_SETTINGS,
      "appointment.min_lead_hours": 4,
      "chatbot.enabled_categories": ["services"],
    };
    expect(diffSettings(DEFAULT_SETTINGS, next)).toEqual([
      { key: "appointment.min_lead_hours", previous: 2, next: 4 },
      {
        key: "chatbot.enabled_categories",
        previous: [...KNOWLEDGE_CATEGORIES],
        next: ["services"],
      },
    ]);
  });

  it("is empty when nothing changed", () => {
    expect(diffSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual([]);
  });
});

describe("settingsFromFormData", () => {
  it("reads the appointment tab, with a blank expiry meaning off", () => {
    const values = settingsFromFormData(
      "appointment",
      form([
        ["appointment.default_slot_minutes", "45"],
        ["appointment.request_expiry_hours", ""],
        ["appointment.min_lead_hours", "4"],
        ["appointment.max_advance_days", "30"],
        ["appointment.cancellation_policy_text", " Cancel a day ahead. "],
        ["appointment.reschedule_policy_text", ""],
      ]),
    );
    expect(settingsGroupSchemas.appointment.parse(values)).toEqual({
      "appointment.default_slot_minutes": 45,
      "appointment.request_expiry_hours": null,
      "appointment.min_lead_hours": 4,
      "appointment.max_advance_days": 30,
      "appointment.cancellation_policy_text": "Cancel a day ahead.",
      "appointment.reschedule_policy_text": "",
    });
  });

  it("reads the hospital tab, with a closed day having no hours", () => {
    const entries: [string, string][] = [
      ["hospital.name", "Hospital"],
      ["hospital.address", ""],
      ["hospital.contact_phone", "0917 000 0000"],
      ["hospital.contact_email", ""],
    ];
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
      entries.push([`hours.${day}.open`, "08:00"], [`hours.${day}.close`, "17:00"]);
      if (day === "sun") entries.push([`hours.${day}.closed`, "on"]);
    }
    const values = settingsGroupSchemas.hospital.parse(
      settingsFromFormData("hospital", form(entries)),
    );
    expect(values["hospital.contact_phone"]).toBe("0917 000 0000");
    expect(values["hospital.operating_hours"].at(0)).toEqual({
      day: "mon",
      open: "08:00",
      close: "17:00",
    });
    expect(values["hospital.operating_hours"].at(-1)).toEqual({
      day: "sun",
      open: null,
      close: null,
    });
  });

  it("reads the chatbot tab, with an unchecked box meaning disabled", () => {
    const values = settingsGroupSchemas.chatbot.parse(
      settingsFromFormData(
        "chatbot",
        form([
          ["chatbot.welcome_message", "Hello!"],
          ["chatbot.enabled_categories", "services"],
          ["chatbot.enabled_categories", "departments"],
        ]),
      ),
    );
    expect(values).toEqual({
      "chatbot.enabled": false,
      "chatbot.welcome_message": "Hello!",
      "chatbot.enabled_categories": ["services", "departments"],
    });
  });
});

describe("parseSettingsTab", () => {
  it("defaults to the appointment tab for anything unknown", () => {
    expect(parseSettingsTab("chatbot")).toBe("chatbot");
    expect(parseSettingsTab("hospital")).toBe("hospital");
    expect(parseSettingsTab(["hospital", "chatbot"])).toBe("hospital");
    expect(parseSettingsTab("model")).toBe("appointment");
    expect(parseSettingsTab(undefined)).toBe("appointment");
  });
});
