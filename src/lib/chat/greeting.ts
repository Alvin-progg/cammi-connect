import { MANILA_TIME_ZONE } from "@/lib/appointments/filters";

export type Greeting = {
  salutation: "Good Morning" | "Good Afternoon" | "Good Evening";
  firstName: string;
};

function manilaHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

/** Chat greeting by the Manila hour, using only the patient's first name. */
export function greetingFor(fullName: string, now: Date): Greeting {
  const hour = manilaHour(now);
  const salutation =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const firstName = fullName.trim().split(/\s+/)[0] || "there";
  return { salutation, firstName };
}
