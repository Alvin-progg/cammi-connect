import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { AttendanceActions } from "@/components/front-desk/attendance-actions";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { RequestDecision } from "@/components/front-desk/request-decision";
import { RequestDetailsView } from "@/components/front-desk/request-details";
import { todayInManila } from "@/lib/appointments/filters";
import { formatManilaMediumDate, formatManilaTime } from "@/lib/appointments/format";
import { formatRequestId } from "@/lib/front-desk/requests";
import { allowedAttendanceActions } from "@/lib/front-desk/schedule";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseFrontDeskRequestsRepository } from "@/server/front-desk/repository";
import { checkRequestSlot, getRequestDetails } from "@/server/front-desk/service";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";

export const instant = false;

export const metadata: Metadata = { title: "Appointment request" };

export default async function FrontDeskRequestPage({
  params,
}: PageProps<"/front-desk/requests/[id]">) {
  const { id } = await params;
  const session = await getFrontDeskSession(`/front-desk/requests/${encodeURIComponent(id)}`);

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const request = await getRequestDetails(id, supabaseFrontDeskRequestsRepository);
  if (!request) {
    notFound();
  }

  const isPending = request.status === "requested";
  // Details open for every booking source; only Cami requests belong to the
  // request queue, so other appointments sit under the daily schedule.
  const isCamiRequest = request.bookingSource === "ai_chatbot";
  const attendanceActions = allowedAttendanceActions(request.status, request.scheduledAt);
  const slotCheck = isPending
    ? await checkRequestSlot(request, supabaseDoctorSchedulesRepository)
    : null;
  // todayInManila gives the Manila calendar date of any instant.
  const whenLabel = `${formatManilaMediumDate(todayInManila(new Date(request.scheduledAt)))}, ${formatManilaTime(request.scheduledAt)}`;

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active={isCamiRequest ? "requests" : "schedule"}
      crumbs={
        isCamiRequest
          ? [
              { label: "Requests", href: "/front-desk/requests" },
              { label: `Request ${formatRequestId(request.id)}` },
            ]
          : [
              { label: "Daily schedule", href: "/front-desk/schedule" },
              { label: `Appointment ${formatRequestId(request.id)}` },
            ]
      }
    >
      <div className="flex flex-col gap-6">
        {isPending ? (
          <RequestDecision
            appointmentId={request.id}
            patientName={request.patientName}
            doctorName={request.doctorName}
            whenLabel={whenLabel}
          />
        ) : null}
        <AttendanceActions
          appointmentId={request.id}
          patientName={request.patientName}
          actions={attendanceActions}
        />
        <RequestDetailsView request={request} slotCheck={slotCheck} />
      </div>
    </FrontDeskShell>
  );
}
