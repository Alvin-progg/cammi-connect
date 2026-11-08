import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { RescheduleForm } from "@/components/front-desk/reschedule-form";
import { buttonVariants } from "@/components/ui/button";
import { isValidManilaDate, todayInManila } from "@/lib/appointments/filters";
import { formatManilaMediumDate, formatManilaTime } from "@/lib/appointments/format";
import { canFrontDeskReschedule } from "@/lib/front-desk/decisions";
import { formatRequestId } from "@/lib/front-desk/requests";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseFrontDeskRequestsRepository } from "@/server/front-desk/repository";
import { getRequestDetails, listRescheduleSlots } from "@/server/front-desk/service";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import { CONTROL_CLASS } from "@/components/ui/field";

export const instant = false;

export const metadata: Metadata = { title: "Reschedule appointment" };

const SECONDARY_BUTTON_CLASS = buttonVariants({ variant: "outline", size: "sm" });

export default async function FrontDeskReschedulePage({
  params,
  searchParams,
}: PageProps<"/front-desk/requests/[id]/reschedule">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const session = await getFrontDeskSession(
    `/front-desk/requests/${encodeURIComponent(id)}/reschedule`,
  );

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const request = await getRequestDetails(id, supabaseFrontDeskRequestsRepository);
  if (!request) {
    notFound();
  }

  const now = new Date();
  const requestedDate = Array.isArray(query.date) ? query.date[0] : query.date;
  const date =
    requestedDate && isValidManilaDate(requestedDate) ? requestedDate : todayInManila(now);
  const detailsHref = `/front-desk/requests/${request.id}`;
  const isCamiRequest = request.bookingSource === "ai_chatbot";
  const reference = formatRequestId(request.id);
  // todayInManila gives the Manila calendar date of any instant.
  const currentLabel = `${formatManilaMediumDate(todayInManila(new Date(request.scheduledAt)))}, ${formatManilaTime(request.scheduledAt)}`;

  const canReschedule = canFrontDeskReschedule(request.status);
  const slots = canReschedule
    ? await listRescheduleSlots(
        {
          appointmentId: request.id,
          doctorId: request.doctorId,
          currentScheduledAt: request.scheduledAt,
          date,
        },
        {
          listSchedulesForDoctor: (doctorId) =>
            supabaseDoctorSchedulesRepository.listSchedulesForDoctor(doctorId),
          listExceptionsForDoctor: (input) =>
            supabaseDoctorSchedulesRepository.listExceptionsForDoctor(input),
          listActiveIntervals: (input) =>
            supabaseDoctorAppointmentsRepository.listActiveIntervals(input),
        },
        now,
      )
    : [];

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active={isCamiRequest ? "requests" : "schedule"}
      crumbs={[
        isCamiRequest
          ? { label: "Requests", href: "/front-desk/requests" }
          : { label: "Daily schedule", href: "/front-desk/schedule" },
        {
          label: isCamiRequest ? `Request ${reference}` : `Appointment ${reference}`,
          href: detailsHref,
        },
        { label: "Reschedule" },
      ]}
      title={`Reschedule ${request.patientName}`}
      lead={`Currently ${currentLabel} with ${request.doctorName}. Rescheduling keeps the same doctor.`}
    >
      {canReschedule ? (
        // Keyed by date so a new date starts from a fresh form.
        <RescheduleForm
          key={date}
          appointmentId={request.id}
          currentLabel={currentLabel}
          doctorName={request.doctorName}
          dateLabel={formatManilaMediumDate(date)}
          dateControl={
            <form method="get" aria-label="Choose a date" className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="reschedule-date" className="text-sm font-medium text-ink">
                Date
              </label>
              <div className="flex gap-2">
                <input
                  id="reschedule-date"
                  type="date"
                  name="date"
                  min={todayInManila(now)}
                  defaultValue={date}
                  className={CONTROL_CLASS}
                />
                <button type="submit" className={SECONDARY_BUTTON_CLASS}>
                  Show slots
                </button>
              </div>
            </form>
          }
          slots={slots}
          detailsHref={detailsHref}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Only pending or confirmed appointments can be rescheduled.
          </p>
          <Link
            href={detailsHref}
            className="focus-ring inline-flex h-9 items-center self-start rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
          >
            Back to the appointment
          </Link>
        </div>
      )}
    </FrontDeskShell>
  );
}
