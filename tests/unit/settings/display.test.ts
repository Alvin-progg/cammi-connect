import { describe, expect, it } from "vitest";

import { formatSettingValue, SETTING_LABELS } from "@/lib/settings/display";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

describe("formatSettingValue", () => {
  it("labels every setting", () => {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      expect(SETTING_LABELS[key as keyof typeof SETTING_LABELS]).toBeTruthy();
    }
  });

  it("shows numbers with units and null expiry as off", () => {
    expect(formatSettingValue("appointment.default_slot_minutes", 45)).toBe("45 minutes");
    expect(formatSettingValue("appointment.min_lead_hours", 1)).toBe("1 hour");
    expect(formatSettingValue("appointment.max_advance_days", 60)).toBe("60 days");
    expect(formatSettingValue("appointment.request_expiry_hours", null)).toBe("Off");
  });

  it("shows switches, empty text, and long text readably", () => {
    expect(formatSettingValue("chatbot.enabled", true)).toBe("On");
    expect(formatSettingValue("chatbot.enabled", false)).toBe("Off");
    expect(formatSettingValue("hospital.address", "")).toBe("(empty)");
    expect(formatSettingValue("appointment.cancellation_policy_text", "a".repeat(200))).toBe(
      `${"a".repeat(119)}…`,
    );
  });

  it("shows category labels and operating hours", () => {
    expect(
      formatSettingValue("chatbot.enabled_categories", ["services", "departments"]),
    ).toBe("Services, Departments");
    expect(
      formatSettingValue("hospital.operating_hours", DEFAULT_SETTINGS["hospital.operating_hours"]),
    ).toBe(
      "Mon 08:00–17:00 · Tue 08:00–17:00 · Wed 08:00–17:00 · Thu 08:00–17:00 · Fri 08:00–17:00 · Sat 08:00–12:00 · Sun closed",
    );
  });
});
