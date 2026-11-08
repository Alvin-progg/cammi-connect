import { LinkTabs } from "@/components/ui/navigation";
import type { DoctorTab } from "@/lib/doctors/types";

const TABS: { tab: DoctorTab; label: string }[] = [
  { tab: "profile", label: "Profile" },
  { tab: "schedule", label: "Schedule" },
  { tab: "appointments", label: "Appointments" },
];

/** Section links for the doctor detail page; the open one is marked current. */
export function DoctorTabs({ doctorId, active }: { doctorId: string; active: DoctorTab }) {
  return (
    <LinkTabs
      label="Doctor sections"
      items={TABS.map(({ tab, label }) => ({
        href: tab === "profile" ? `/admin/doctors/${doctorId}` : `/admin/doctors/${doctorId}?tab=${tab}`,
        label,
        current: tab === active,
      }))}
    />
  );
}
