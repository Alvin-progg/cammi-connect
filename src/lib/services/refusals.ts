/** Codes raised by the 0021 service functions, with their messages. */
export const SERVICE_REFUSALS = [
  "not_admin",
  "duplicate",
  "not_found",
  "unchanged",
  "inactive_department",
  "invalid_price",
] as const;

export type ServiceRefusal = (typeof SERVICE_REFUSALS)[number];

export const SERVICE_REFUSAL_MESSAGES: Record<ServiceRefusal, string> = {
  not_admin: "Only an active administrator can manage services.",
  duplicate: "A service with that name already exists.",
  not_found: "That service no longer exists.",
  unchanged: "Nothing to change.",
  inactive_department: "Choose an active department.",
  invalid_price: "Amounts can't be negative.",
};

export function serviceRefusalFromCode(code: string | undefined | null): ServiceRefusal | null {
  return SERVICE_REFUSALS.find((refusal) => refusal === code) ?? null;
}
