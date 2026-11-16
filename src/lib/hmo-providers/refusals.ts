/** Codes raised by the 0033 HMO provider functions, with their messages. */
export const HMO_PROVIDER_REFUSALS = [
  "not_admin",
  "duplicate",
  "not_found",
  "unchanged",
  "invalid_price",
] as const;

export type HmoProviderRefusal = (typeof HMO_PROVIDER_REFUSALS)[number];

export const HMO_PROVIDER_REFUSAL_MESSAGES: Record<HmoProviderRefusal, string> = {
  not_admin: "Only an active administrator can manage HMO providers.",
  duplicate: "An HMO provider with that name already exists.",
  not_found: "That HMO provider no longer exists.",
  unchanged: "Nothing to change.",
  invalid_price: "Amounts can't be negative.",
};

export function hmoProviderRefusalFromCode(
  code: string | undefined | null,
): HmoProviderRefusal | null {
  return HMO_PROVIDER_REFUSALS.find((refusal) => refusal === code) ?? null;
}
