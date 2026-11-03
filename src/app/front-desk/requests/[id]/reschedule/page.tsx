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

export const instant = false;

export const metadata: Metadata = { title: "Reschedule appointment" };

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const SECONDARY_BUTTON_CLASS = buttonVariants({ variant: "secondary" });

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
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <p className="text-sm leading-6 text-ink-secondary">
          {`${request.patientName} with ${request.doctorName}. Choose a free slot with the same doctor.`}
        </p>
        {canReschedule ? (
          <>
            <form
              method="get"
              aria-label="Choose a date"
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="reschedule-date" className={FIELD_LABEL_CLASS}>
                  Date
                </label>
                <input
                  id="reschedule-date"
                  type="date"
                  name="date"
                  min={todayInManila(now)}
                  defaultValue={date}
                  className={CONTROL_CLASS}
                />
              </div>
              <button type="submit" className={SECONDARY_BUTTON_CLASS}>
                Show slots
              </button>
            </form>
            <h2 className="text-base font-semibold text-ink">
              {`Free slots on ${formatManilaMediumDate(date)}`}
            </h2>
            {/* Keyed by date so a new date starts from a fresh form. */}
            <RescheduleForm
              key={date}
              appointmentId={request.id}
              currentLabel={currentLabel}
              slots={slots}
              detailsHref={detailsHref}
            />
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            Only pending or confirmed appointments can be rescheduled.
          </p>
        )}
        <Link
          href={detailsHref}
          className="focus-ring inline-flex min-h-11 items-center self-start rounded-lg px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
        >
          Back to the appointment
        </Link>
      </div>
    </FrontDeskShell>
  );
}
