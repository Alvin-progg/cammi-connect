import { Avatar } from "@/components/ui/card";
import { initialsOf } from "@/components/ui/rail";

import { DoctorViewTitle } from "./doctor-view-title";
import { NotificationsBellButton } from "./notifications-dialog";

/**
 * Workspace header: view title with the Manila date, the notifications
 * button, and the signed-in doctor (redesign).
 */
export function DoctorHeader({
  todayLabel,
  unreadCount,
  doctorName,
  specialty,
}: {
  todayLabel: string;
  unreadCount: number;
  doctorName: string;
  specialty: string | null;
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 w-full max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
            <DoctorViewTitle />
          </h1>
          <p className="hidden truncate text-sm text-ink-muted sm:block">{todayLabel} · PHT</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationsBellButton unreadCount={unreadCount} />
          <div className="hidden items-center gap-2.5 sm:flex">
            <Avatar initials={initialsOf(doctorName, "DR")} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{doctorName}</p>
              {specialty ? <p className="truncate text-xs text-ink-muted">{specialty}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
