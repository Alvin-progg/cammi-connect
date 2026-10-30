import type { ReactNode } from "react";

import type { DoctorView } from "@/lib/appointments/dashboard";

import { DoctorRail } from "./doctor-rail";
import { NotificationsDialogProvider } from "./notifications-dialog";

/**
 * Workspace shell for the doctor dashboard: icon navigation rail plus a single
 * scrollable work area on the white canvas, per the approved 2026-10-27 layout.
 * Notifications open as a modal over the current view rather than a page.
 */
export function DoctorShell({
  activeView,
  doctorName,
  specialty,
  unreadCount,
  notificationsPanel,
  children,
}: {
  activeView: DoctorView;
  doctorName: string;
  specialty: string | null;
  unreadCount: number;
  notificationsPanel: ReactNode;
  children: ReactNode;
}) {
  return (
    <NotificationsDialogProvider panel={notificationsPanel}>
      <div className="flex min-h-full flex-1 bg-canvas">
        <DoctorRail
          activeView={activeView}
          doctorName={doctorName}
          specialty={specialty}
          unreadCount={unreadCount}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </NotificationsDialogProvider>
  );
}
