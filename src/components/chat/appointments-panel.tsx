import { CalendarIcon, PlusIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Table, Td, Th, Tr } from "@/components/ui/data";
import type { PatientAppointmentGroups } from "@/lib/appointments/patient";
import type { PatientAppointment } from "@/lib/appointments/types";
import { MANILA_TIME_ZONE } from "@/lib/appointments/filters";
import { formatManilaTime } from "@/lib/appointments/format";

import { CancelAppointmentButton } from "./cancel-appointment-button";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  month: "short",
});
const DAY_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  day: "numeric",
});
const YEAR_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  weekday: "long",
  year: "numeric",
});

function AppointmentCard({
  appointment,
  cancellable,
}: {
  appointment: PatientAppointment;
  cancellable: boolean;
}) {
  const start = new Date(appointment.scheduledAt);
  const whenLabel = `${WEEKDAY_FORMATTER.format(start)}, ${MONTH_FORMATTER.format(start)} ${DAY_FORMATTER.format(start)} · ${formatManilaTime(appointment.scheduledAt)}`;
  return (
    <li className="flex gap-5 rounded-xl border border-line bg-surface px-5 py-4.5 shadow-soft">
      <div
        aria-hidden="true"
        className="flex w-16 shrink-0 flex-col items-center justify-center self-start rounded-lg bg-primary-soft py-2"
      >
        <span className="text-xs font-medium text-primary">
          {MONTH_FORMATTER.format(start)}
        </span>
        <span className="text-2xl font-semibold leading-tight tabular-nums text-ink">
          {DAY_FORMATTER.format(start)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{appointment.doctorName}</p>
            {appointment.departmentName ? (
              <p className="truncate text-sm text-ink-muted">{appointment.departmentName}</p>
            ) : null}
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        <p className="mt-2 text-sm text-ink-secondary">
          <time dateTime={appointment.scheduledAt}>{whenLabel}</time>{" "}
          · {appointment.durationMinutes} min
        </p>
        {appointment.reason ? (
          <p className="mt-1 break-words text-sm text-ink-muted">{appointment.reason}</p>
        ) : null}
        {cancellable ? (
          <div className="mt-3">
            <CancelAppointmentButton
              appointmentId={appointment.id}
              doctorName={appointment.doctorName}
              whenLabel={whenLabel}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function SectionHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="text-lg font-semibold text-ink">
      {title}
      <span aria-hidden="true" className="font-medium text-ink-muted">
        {` · ${count}`}
      </span>
    </h2>
  );
}

function UpcomingSection({ appointments }: { appointments: PatientAppointment[] }) {
  return (
    <section aria-labelledby="appointments-upcoming">
      <SectionHeading id="appointments-upcoming" title="Upcoming" count={appointments.length} />
      {appointments.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No upcoming appointments.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {/* Upcoming appointments are requested or confirmed, so each can be cancelled. */}
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} cancellable />
          ))}
        </ul>
      )}
    </section>
  );
}

function PastSection({ appointments }: { appointments: PatientAppointment[] }) {
  return (
    <section aria-labelledby="appointments-past">
      <SectionHeading id="appointments-past" title="Past" count={appointments.length} />
      {appointments.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No past appointments.</p>
      ) : (
        <Table label="Past appointments" className="mt-3" minWidthClass="min-w-[560px]">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Doctor</Th>
              <Th>Department</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => {
              const start = new Date(appointment.scheduledAt);
              return (
                <Tr key={appointment.id}>
                  <Td className="whitespace-nowrap tabular-nums">
                    <time dateTime={appointment.scheduledAt}>
                      {`${MONTH_FORMATTER.format(start)} ${DAY_FORMATTER.format(start)}, ${YEAR_FORMATTER.format(start)}`}
                    </time>
                  </Td>
                  <Td>{appointment.doctorName}</Td>
                  <Td className="text-ink-secondary">{appointment.departmentName ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={appointment.status} />
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </section>
  );
}

/** The patient's appointments; upcoming ones can be cancelled (AI-APT-001 S4). */
export function AppointmentsPanel({ upcoming, past }: PatientAppointmentGroups) {
  const isEmpty = upcoming.length === 0 && past.length === 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <header className="border-b border-line bg-wash">
        <div className="mx-auto flex max-w-[896px] flex-wrap items-end justify-between gap-4 px-6 pb-7 pt-10">
          <div>
            <p className="text-sm font-medium text-primary">Patient portal</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-ink">My Appointments</h1>
            <p className="mt-1.5 text-base text-ink-secondary">
              Requests stay pending until the front desk confirms them. Times are in Philippine time.
            </p>
          </div>
          <LinkButton href="/chat">
            <PlusIcon aria-hidden="true" />
            Book with Cami
          </LinkButton>
        </div>
      </header>
      <div className="mx-auto flex max-w-[896px] flex-col gap-8 px-6 pb-12 pt-7">
        {isEmpty ? (
          <EmptyState
            icon={<CalendarIcon aria-hidden="true" />}
            title="No appointments yet"
            description="Ask the assistant to book one."
            action={
              <LinkButton variant="secondary" href="/chat" className="mt-3">
                Go to chat
              </LinkButton>
            }
          />
        ) : (
          <>
            <UpcomingSection appointments={upcoming} />
            <PastSection appointments={past} />
          </>
        )}
      </div>
    </div>
  );
}
