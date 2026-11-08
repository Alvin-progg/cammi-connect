import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { AttendanceActions } from "@/components/front-desk/attendance-actions";
import { SplitLayout } from "@/components/shell/staff-shell";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import {
  CancelAppointment,
  RequestDecision,
} from "@/components/front-desk/request-decision";
import { RequestDetailsView, SlotCheckAlert } from "@/components/front-desk/request-details";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import { todayInManila } from "@/lib/appointments/filters";
import { formatManilaMediumDate, formatManilaTime } from "@/lib/appointments/format";
import {
  canFrontDeskCancel,
  canFrontDeskReschedule,
} from "@/lib/front-desk/decisions";
import {
  formatRequestId,
  formatWaiting,
  nextPendingRequest,
  parseRequestQueueFilters,
} from "@/lib/front-desk/requests";
import { allowedAttendanceActions } from "@/lib/front-desk/schedule";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseFrontDeskRequestsRepository } from "@/server/front-desk/repository";
import { checkRequestSlot, getRequestDetails, listRequestQueue } from "@/server/front-desk/service";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";

export const instant = false;

export const metadata: Metadata = { title: "Appointment request" };

const SECONDARY_BUTTON_CLASS = buttonVariants({ variant: "outline", size: "lg", className: "w-full" });

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
  const [slotCheck, pendingQueue] = await Promise.all([
    isPending ? checkRequestSlot(request, supabaseDoctorSchedulesRepository) : null,
    // The pending queue, oldest first, for "N of M" and Next request.
    isPending && isCamiRequest
      ? listRequestQueue(parseRequestQueueFilters({}), supabaseFrontDeskRequestsRepository)
      : null,
  ]);
  const queuePosition = pendingQueue
    ? nextPendingRequest(pendingQueue.items.map((item) => item.id), request.id)
    : null;
  const specialty = request.specialtyNames.length > 0 ? request.specialtyNames.join(", ") : null;
  const requestedVia = isCamiRequest ? "in chat" : "at the front desk";
  const hasActions =
    isPending ||
    canFrontDeskReschedule(request.status) ||
    canFrontDeskCancel(request.status) ||
    attendanceActions.length > 0;
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
      title={request.patientName}
      badges={<StatusBadge status={request.status} />}
      lead={`${specialty ? `${specialty} with ` : ""}${request.doctorName} · ${whenLabel} · requested ${formatWaiting(request.createdAt, new Date()).label} ago ${requestedVia}`}
      actions={
        queuePosition ? (
          <>
            <span className="text-xs text-ink-muted">{`${queuePosition.position} of ${queuePosition.total}`}</span>
            {queuePosition.nextId ? (
              <LinkButton variant="outline" size="sm" href={`/front-desk/requests/${queuePosition.nextId}`}>
                Next request
                <ChevronRight aria-hidden="true" />
              </LinkButton>
            ) : null}
          </>
        ) : undefined
      }
    >
      <SplitLayout
        main={<RequestDetailsView request={request} />}
        side={
          <section
            aria-labelledby="request-actions-heading"
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card"
          >
            <div>
              <h2 id="request-actions-heading" className="text-lg font-semibold leading-7 text-ink">
                {isPending ? "Decide" : "Actions"}
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                The patient sees your decision in CamiConnect right away.
              </p>
            </div>
            {slotCheck ? <SlotCheckAlert slotCheck={slotCheck} /> : null}
            {isPending ? (
              <RequestDecision
                appointmentId={request.id}
                patientName={request.patientName}
                doctorName={request.doctorName}
                whenLabel={whenLabel}
              />
            ) : null}
            {canFrontDeskReschedule(request.status) || canFrontDeskCancel(request.status) ? (
              <div className="flex flex-col gap-2">
                {canFrontDeskReschedule(request.status) ? (
                  <Link
                    href={`/front-desk/requests/${request.id}/reschedule`}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    Reschedule
                  </Link>
                ) : null}
                {canFrontDeskCancel(request.status) ? (
                  <CancelAppointment
                    appointmentId={request.id}
                    patientName={request.patientName}
                    doctorName={request.doctorName}
                    whenLabel={whenLabel}
                  />
                ) : null}
              </div>
            ) : null}
            <AttendanceActions
              appointmentId={request.id}
              patientName={request.patientName}
              actions={attendanceActions}
            />
            {hasActions ? null : (
              <p className="text-sm text-ink-muted">No actions are available for this appointment.</p>
            )}
          </section>
        }
      />
    </FrontDeskShell>
  );
}
