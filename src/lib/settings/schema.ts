import { z } from "zod";

import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge/types";

/**
 * Admin system settings (ADM-15, spec §15). This allow-list is the only set of
 * keys an admin can change; model, prompt, temperature, and API keys are
 * deliberately absent. The save function in 0027 repeats the key list.
 */

export const SETTING_GROUPS = ["appointment", "hospital", "chatbot"] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number];

export const SETTING_GROUP_LABELS: Record<SettingGroup, string> = {
  appointment: "Appointment",
  hospital: "Hospital",
  chatbot: "Chatbot",
};

/** Shown read-only; every date and time in the app is Manila time. */
export const HOSPITAL_TIMEZONE = "Asia/Manila";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Slot lengths stay 15/30/45/60, the values the schedule editor accepts. */
export const SLOT_MINUTE_OPTIONS = [15, 30, 45, 60] as const;

const POLICY_TEXT_MAX = 5000;

const policyText = z
  .string()
  .trim()
  .max(POLICY_TEXT_MAX, `Keep the policy under ${POLICY_TEXT_MAX} characters.`);

const shortText = (label: string) =>
  z.string().trim().max(200, `Keep the ${label} under 200 characters.`);

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM.");

const operatingDaySchema = z
  .object({
    day: z.enum(WEEKDAYS),
    open: timeOfDay.nullable(),
    close: timeOfDay.nullable(),
  })
  .refine((day) => (day.open === null) === (day.close === null), {
    message: "Enter both opening and closing times, or mark the day closed.",
  })
  .refine((day) => day.open === null || day.close === null || day.open < day.close, {
    message: "Opening time must be before closing time.",
  });

export type OperatingDay = z.infer<typeof operatingDaySchema>;

const operatingHoursSchema = z
  .array(operatingDaySchema)
  .length(WEEKDAYS.length, "Enter hours for every day.")
  .refine((days) => days.every((day, index) => day.day === WEEKDAYS[index]), {
    message: "Enter hours for every day.",
  });

const settingSchemas = {
  "appointment.default_slot_minutes": z
    .number()
    .int()
    .refine((minutes) => (SLOT_MINUTE_OPTIONS as readonly number[]).includes(minutes), {
      message: "Choose a slot length of 15, 30, 45, or 60 minutes.",
    }),
  // D8: null keeps request expiry off until the hospital sets a policy.
  "appointment.request_expiry_hours": z
    .number()
    .int()
    .min(1, "Enter at least 1 hour, or leave it blank to turn expiry off.")
    .max(720, "Enter at most 720 hours (30 days).")
    .nullable(),
  "appointment.min_lead_hours": z
    .number()
    .int()
    .min(0, "Enter 0 or more hours.")
    .max(168, "Enter at most 168 hours (7 days)."),
  "appointment.max_advance_days": z
    .number()
    .int()
    .min(1, "Enter at least 1 day.")
    .max(365, "Enter at most 365 days."),
  // Enforced by cammi_connect_book_appointment (0031), whose default must match.
  "appointment.max_upcoming_per_patient": z
    .number()
    .int("Enter a whole number.")
    .min(1, "Allow at least 1 upcoming appointment.")
    .max(20, "Enter at most 20 appointments."),
  "appointment.cancellation_policy_text": policyText,
  "appointment.reschedule_policy_text": policyText,
  "hospital.name": shortText("hospital name").min(1, "Enter the hospital name."),
  "hospital.address": shortText("address"),
  "hospital.contact_phone": z.string().trim().max(50, "Keep the phone under 50 characters."),
  "hospital.contact_email": z.union([z.literal(""), z.email("Enter a valid email address.")]),
  "hospital.operating_hours": operatingHoursSchema,
  "chatbot.enabled": z.boolean(),
  "chatbot.welcome_message": z
    .string()
    .trim()
    .min(1, "Enter a welcome message.")
    .max(500, "Keep the welcome message under 500 characters."),
  "chatbot.enabled_categories": z
    .array(z.enum(KNOWLEDGE_CATEGORIES))
    .min(1, "Enable at least one category.")
    .refine((categories) => new Set(categories).size === categories.length, {
      message: "Each category can be enabled once.",
    }),
};

export type SettingKey = keyof typeof settingSchemas;

export type SystemSettings = { [Key in SettingKey]: z.infer<(typeof settingSchemas)[Key]> };

const weekdayHours = (day: Weekday): OperatingDay =>
  day === "sun"
    ? { day, open: null, close: null }
    : { day, open: "08:00", close: day === "sat" ? "12:00" : "17:00" };

export const DEFAULT_SETTINGS: SystemSettings = {
  "appointment.default_slot_minutes": 30,
  "appointment.request_expiry_hours": null,
  "appointment.min_lead_hours": 2,
  "appointment.max_advance_days": 60,
  "appointment.max_upcoming_per_patient": 3,
  "appointment.cancellation_policy_text": "",
  "appointment.reschedule_policy_text": "",
  "hospital.name": "United Doctors of St. Camillus De Lellis Hospital",
  "hospital.address": "",
  "hospital.contact_phone": "",
  "hospital.contact_email": "",
  "hospital.operating_hours": WEEKDAYS.map(weekdayHours),
  "chatbot.enabled": true,
  "chatbot.welcome_message": "Hi, I'm Cami! How can I help with your hospital visit today?",
  "chatbot.enabled_categories": [...KNOWLEDGE_CATEGORIES],
};

const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

function groupOf(key: SettingKey): SettingGroup {
  return key.slice(0, key.indexOf(".")) as SettingGroup;
}

function groupSchema<Group extends SettingGroup>(group: Group) {
  const shape = Object.fromEntries(
    SETTING_KEYS.filter((key) => groupOf(key) === group).map((key) => [key, settingSchemas[key]]),
  );
  // strict: a key outside the allow-list is rejected, never stored.
  return z.strictObject(shape) as z.ZodObject<{
    [Key in SettingKey as Key extends `${Group}.${string}` ? Key : never]: (typeof settingSchemas)[Key];
  }>;
}

/** One schema per settings tab; each saves on its own. */
export const settingsGroupSchemas = {
  appointment: groupSchema("appointment"),
  hospital: groupSchema("hospital"),
  chatbot: groupSchema("chatbot"),
};

export type SettingsGroupValues<Group extends SettingGroup> = z.infer<
  (typeof settingsGroupSchemas)[Group]
>;

/**
 * The effective settings: each stored value that still parses, otherwise its
 * default. A bad or unknown row never breaks the pages that read settings.
 */
export function resolveSettings(rows: { key: string; value: unknown }[]): SystemSettings {
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in settingSchemas)) continue;
    const parsed = settingSchemas[row.key as SettingKey].safeParse(row.value);
    if (parsed.success) settings[row.key] = parsed.data;
  }
  return settings as SystemSettings;
}

export type SettingChange = { key: SettingKey; previous: unknown; next: unknown };

/** The keys whose values differ, in allow-list order. Values are JSON, so compare as JSON. */
export function diffSettings(
  previous: Partial<SystemSettings>,
  next: Partial<SystemSettings>,
): SettingChange[] {
  return SETTING_KEYS.filter(
    (key) => key in next && JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
  ).map((key) => ({ key, previous: previous[key], next: next[key] }));
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** A number field; blank becomes null and non-numbers stay text so the schema reports them. */
function numberOrNull(formData: FormData, key: string): number | string | null {
  const raw = text(formData, key).trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : raw;
}

/** The raw values of one tab's form, to be validated by `settingsGroupSchemas[group]`. */
export function settingsFromFormData(group: SettingGroup, formData: FormData): Record<string, unknown> {
  switch (group) {
    case "appointment":
      return {
        "appointment.default_slot_minutes": numberOrNull(formData, "appointment.default_slot_minutes"),
        "appointment.request_expiry_hours": numberOrNull(formData, "appointment.request_expiry_hours"),
        "appointment.min_lead_hours": numberOrNull(formData, "appointment.min_lead_hours"),
        "appointment.max_advance_days": numberOrNull(formData, "appointment.max_advance_days"),
        "appointment.max_upcoming_per_patient": numberOrNull(
          formData,
          "appointment.max_upcoming_per_patient",
        ),
        "appointment.cancellation_policy_text": text(formData, "appointment.cancellation_policy_text"),
        "appointment.reschedule_policy_text": text(formData, "appointment.reschedule_policy_text"),
      };
    case "hospital":
      return {
        "hospital.name": text(formData, "hospital.name"),
        "hospital.address": text(formData, "hospital.address"),
        "hospital.contact_phone": text(formData, "hospital.contact_phone"),
        "hospital.contact_email": text(formData, "hospital.contact_email").trim(),
        "hospital.operating_hours": WEEKDAYS.map((day) => {
          const closed = formData.get(`hours.${day}.closed`) !== null;
          return {
            day,
            open: closed ? null : text(formData, `hours.${day}.open`) || null,
            close: closed ? null : text(formData, `hours.${day}.close`) || null,
          };
        }),
      };
    case "chatbot":
      return {
        "chatbot.enabled": formData.get("chatbot.enabled") !== null,
        "chatbot.welcome_message": text(formData, "chatbot.welcome_message"),
        "chatbot.enabled_categories": formData
          .getAll("chatbot.enabled_categories")
          .filter((value): value is string => typeof value === "string"),
      };
  }
}

/** The `?tab=` value of `/admin/settings`; anything unknown shows the first tab. */
export function parseSettingsTab(raw: string | string[] | undefined): SettingGroup {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SETTING_GROUPS.find((group) => group === value) ?? "appointment";
}
