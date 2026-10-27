import type { ReactNode } from "react";

import type { DoctorView } from "@/lib/appointments/dashboard";
import type { DepartmentColleague } from "@/server/profiles/service";

import { DoctorSidebar } from "./doctor-sidebar";

/**
 * Workspace shell for the doctor dashboard: persistent sidebar at lg+, single
 * scrollable work area. Layout follows the approved reference structure while
 * using the Calm Care token palette.
 */
export function DoctorShell({
  activeView,
  doctorName,
  specialty,
  departmentName,
  colleagues,
  todayCount,
  unreadCount,
  children,
}: {
  activeView: DoctorView;
  doctorName: string;
  specialty: string | null;
  departmentName: string | null;
  colleagues: DepartmentColleague[];
  todayCount: number;
  unreadCount: number;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-canvas">
      <DoctorSidebar
        activeView={activeView}
        doctorName={doctorName}
        specialty={specialty}
        departmentName={departmentName}
        colleagues={colleagues}
        todayCount={todayCount}
        unreadCount={unreadCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
