import type { ReactNode } from "react";

import { DoctorRail } from "./doctor-rail";
import { NotificationsDialogProvider } from "./notifications-dialog";

/**
 * Workspace shell for the doctor dashboard: icon navigation rail plus a single
 * scrollable work area on the white canvas, per the approved 2026-10-27 layout.
 * Notifications open as a modal over the current view rather than a page.
 * Rendered by the doctor layout, so it stays mounted across view routes.
 */
export function DoctorShell({
  doctorName,
  specialty,
  notificationsPanel,
  children,
}: {
  doctorName: string;
  specialty: string | null;
  notificationsPanel: ReactNode;
  children: ReactNode;
}) {
  return (
    <NotificationsDialogProvider panel={notificationsPanel}>
      <div className="flex min-h-full flex-1 bg-canvas">
        <DoctorRail
          doctorName={doctorName}
          specialty={specialty}
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
