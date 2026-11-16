/** Codes raised by the 0021 service functions, with their messages. */
export const SERVICE_REFUSALS = [
  "not_admin",
  "duplicate",
  "not_found",
  "unchanged",
  "inactive_department",
  "invalid_price",
  // PAY-07 service hours (0038).
  "not_bookable",
  "invalid_period",
  "overlap",
] as const;

export type ServiceRefusal = (typeof SERVICE_REFUSALS)[number];

export const SERVICE_REFUSAL_MESSAGES: Record<ServiceRefusal, string> = {
  not_admin: "Only an active administrator can manage services.",
  duplicate: "A service with that name already exists.",
  not_found: "That service no longer exists.",
  unchanged: "Nothing to change.",
  inactive_department: "Choose an active department.",
  invalid_price: "Amounts can't be negative.",
  not_bookable: "Set the booking mode to walk-in or scheduled before adding hours.",
  invalid_period: "Check the hours: a period holds at least one slot and lasts at most 8 hours.",
  overlap: "These hours overlap another period on the same day.",
};

export function serviceRefusalFromCode(code: string | undefined | null): ServiceRefusal | null {
  return SERVICE_REFUSALS.find((refusal) => refusal === code) ?? null;
}
