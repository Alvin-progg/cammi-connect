import { KNOWLEDGE_CATEGORY_LABELS, type KnowledgeCategory } from "@/lib/knowledge/types";

import type { OperatingDay, SettingKey } from "./schema";

export const SETTING_LABELS: Record<SettingKey, string> = {
  "appointment.default_slot_minutes": "Default slot length",
  "appointment.request_expiry_hours": "Request expiry",
  "appointment.min_lead_hours": "Minimum booking lead time",
  "appointment.max_advance_days": "Maximum advance booking",
  "appointment.cancellation_policy_text": "Cancellation policy",
  "appointment.reschedule_policy_text": "Reschedule policy",
  "hospital.name": "Hospital name",
  "hospital.address": "Address",
  "hospital.contact_phone": "Contact phone",
  "hospital.contact_email": "Contact email",
  "hospital.operating_hours": "Operating hours",
  "chatbot.enabled": "Cami chatbot",
  "chatbot.welcome_message": "Welcome message",
  "chatbot.enabled_categories": "Knowledge categories Cami answers from",
};

const UNITS: Partial<Record<SettingKey, string>> = {
  "appointment.default_slot_minutes": "minute",
  "appointment.request_expiry_hours": "hour",
  "appointment.min_lead_hours": "hour",
  "appointment.max_advance_days": "day",
};

const TEXT_PREVIEW_LENGTH = 120;

function shortDay(day: OperatingDay["day"]): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** A one-line, human-readable value for the review-changes dialog. */
export function formatSettingValue(key: SettingKey, value: unknown): string {
  if (value === null) return "Off";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") {
    const unit = UNITS[key];
    return unit ? `${value} ${unit}${value === 1 ? "" : "s"}` : String(value);
  }
  if (typeof value === "string") {
    if (value === "") return "(empty)";
    return value.length <= TEXT_PREVIEW_LENGTH
      ? value
      : `${value.slice(0, TEXT_PREVIEW_LENGTH - 1)}…`;
  }
  if (key === "chatbot.enabled_categories" && Array.isArray(value)) {
    return (value as KnowledgeCategory[]).map((category) => KNOWLEDGE_CATEGORY_LABELS[category]).join(", ");
  }
  if (key === "hospital.operating_hours" && Array.isArray(value)) {
    return (value as OperatingDay[])
      .map((day) =>
        day.open && day.close
          ? `${shortDay(day.day)} ${day.open}–${day.close}`
          : `${shortDay(day.day)} closed`,
      )
      .join(" · ");
  }
  return JSON.stringify(value);
}
