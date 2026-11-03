import clsx from "clsx";
import Link from "next/link";

import type { DoctorTab } from "@/lib/doctors/types";

const TABS: { tab: DoctorTab; label: string }[] = [
  { tab: "profile", label: "Profile" },
  { tab: "schedule", label: "Schedule" },
  { tab: "appointments", label: "Appointments" },
];

/** Section links for the doctor detail page; the open one is marked current. */
export function DoctorTabs({ doctorId, active }: { doctorId: string; active: DoctorTab }) {
  return (
    <nav aria-label="Doctor sections" className="border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map(({ tab, label }) => {
          const current = tab === active;
          return (
            <li key={tab}>
              <Link
                href={tab === "profile" ? `/admin/doctors/${doctorId}` : `/admin/doctors/${doctorId}?tab=${tab}`}
                aria-current={current ? "page" : undefined}
                className={clsx(
                  "inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium focus-ring",
                  current
                    ? "border-primary text-ink"
                    : "border-transparent text-ink-secondary hover:text-ink",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
