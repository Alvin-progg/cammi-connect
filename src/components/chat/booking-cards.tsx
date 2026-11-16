"use client";

import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatManilaDate, formatManilaTime } from "@/lib/appointments/format";
import { manilaDateOf } from "@/lib/chat/booking";
import type {
  CardEvent,
  ChatMessagePayload,
  DoctorOption,
  ServiceRequirementView,
} from "@/lib/chat/schemas";
import { BOOKING_REASON_MAX_LENGTH } from "@/lib/chat/state";
import { SERVICE_KIND_LABELS, type ServiceKind } from "@/lib/services/booking";

import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { BookedPaymentDetails, ChargeBreakdown, PayerOptions, PrivilegeOptions } from "./payment-cards";

export type BookingPayload = Extract<
  ChatMessagePayload,
  {
    kind:
      | "book_offer"
      | "privilege_options"
      | "payer_options"
      | "specialty_options"
      | "service_options"
      | "doctor_options"
      | "slot_picker"
      | "booking_summary"
      | "booking_result";
  }
>;

const BOOKING_KINDS = new Set<ChatMessagePayload["kind"]>([
  "book_offer",
  "privilege_options",
  "payer_options",
  "specialty_options",
  "service_options",
  "doctor_options",
  "slot_picker",
  "booking_summary",
  "booking_result",
]);

export function isBookingPayload(payload: ChatMessagePayload): payload is BookingPayload {
  return BOOKING_KINDS.has(payload.kind);
}

export type CardProps = {
  /** Only the latest assistant message's card accepts actions. */
  interactive: boolean;
  /** A chat request is in flight. */
  busy: boolean;
  onEvent: (event: CardEvent) => void;
};

/**
 * Booking cards shown under an assistant reply (AI-APT-001 S3). Every value
 * comes from the server payload, which is built from database rows; cards
 * only send IDs back, and the server re-checks each one.
 */
export function BookingCard({ payload, ...props }: CardProps & { payload: BookingPayload }) {
  switch (payload.kind) {
    case "book_offer":
      return (
        <div className="mt-3">
          <button
            type="button"
            disabled={!props.interactive || props.busy}
            onClick={() => props.onEvent({ type: "accept_booking_offer" })}
            className={buttonVariants({ variant: "primary" })}
          >
            Yes, book
          </button>
        </div>
      );
    case "privilege_options":
      return <PrivilegeOptions payload={payload} {...props} />;
    case "payer_options":
      return <PayerOptions payload={payload} {...props} />;
    case "specialty_options":
      return (
        <>
          <SpecialtyOptions specialties={payload.specialties} {...props} />
          {payload.serviceKinds?.length ? <ServiceKindOptions kinds={payload.serviceKinds} {...props} /> : null}
        </>
      );
    case "service_options":
      return <ServiceOptions payload={payload} {...props} />;
    case "doctor_options":
      return (
        <>
          <DoctorOptions doctors={payload.doctors} label="Doctors" {...props} />
          {payload.changeSpecialty ? <RoutedSpecialtyActions payload={payload} {...props} /> : null}
        </>
      );
    case "slot_picker":
      return <SlotPicker payload={payload} {...props} />;
    case "booking_summary":
      return <BookingSummary payload={payload} {...props} />;
    case "booking_result":
      return <BookingResult payload={payload} />;
  }
}

function SpecialtyOptions({
  specialties,
  interactive,
  busy,
  onEvent,
}: CardProps & { specialties: { id: string; name: string }[] }) {
  return (
    <ul aria-label="Specialties" className="mt-3 flex flex-wrap gap-2">
      {specialties.map((specialty) => (
        <li key={specialty.id}>
          <button
            type="button"
            disabled={!interactive || busy}
            onClick={() => onEvent({ type: "select_specialty", specialtyId: specialty.id })}
            className={buttonVariants({ variant: "secondary" })}
          >
            {specialty.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** PAY-07 "What kind?": a lab test, imaging, or a package instead of a consultation. */
function ServiceKindOptions({ kinds, interactive, busy, onEvent }: CardProps & { kinds: ServiceKind[] }) {
  return (
    <ul aria-label="Tests and packages" className="mt-2 flex flex-wrap gap-2">
      {kinds.map((serviceKind) => (
        <li key={serviceKind}>
          <button
            type="button"
            disabled={!interactive || busy}
            onClick={() => onEvent({ type: "select_service_kind", serviceKind })}
            className={buttonVariants({ variant: "outline" })}
          >
            {SERVICE_KIND_LABELS[serviceKind]}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** PAY-07: lab tests are ticked together; an imaging test or a package is one tap. */
function ServiceOptions({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<BookingPayload, { kind: "service_options" }> }) {
  const [picked, setPicked] = useState<string[]>([]);
  const disabled = !interactive || busy;
  const note = (requiresDoctorRequest: boolean) =>
    requiresDoctorRequest ? (
      <span className="block text-xs text-ink-muted">Needs a doctor&apos;s request</span>
    ) : null;

  if (!payload.multiple) {
    return (
      <ul aria-label="Services" className="mt-3 space-y-2">
        {payload.services.map((service) => (
          <li key={service.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onEvent({ type: "select_services", serviceIds: [service.id] })}
              className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-ink">{service.name}</span>
                {note(service.requiresDoctorRequest)}
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-ink-muted" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <fieldset className="mt-3" disabled={disabled}>
      <legend className="sr-only">Lab tests</legend>
      <ul className="space-y-2">
        {payload.services.map((service) => (
          <li key={service.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={picked.includes(service.id)}
                onChange={(event) =>
                  setPicked((current) =>
                    event.target.checked
                      ? [...current, service.id]
                      : current.filter((id) => id !== service.id),
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-ink">{service.name}</span>
                {note(service.requiresDoctorRequest)}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={picked.length === 0}
        onClick={() => onEvent({ type: "select_services", serviceIds: picked })}
        className={`${buttonVariants({ variant: "primary" })} mt-3`}
      >
        Continue
      </button>
    </fieldset>
  );
}

/** AI-APT-002: Cami picked the specialty, so it stays one tap away from changing. */
function RoutedSpecialtyActions({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<BookingPayload, { kind: "doctor_options" }> }) {
  const disabled = !interactive || busy;
  const { alternative } = payload;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {alternative ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEvent({ type: "select_specialty", specialtyId: alternative.id })}
          className={buttonVariants({ variant: "secondary" })}
        >
          See {alternative.name} doctors
        </button>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onEvent({ type: "change_booking", field: "specialty" })}
        className={buttonVariants({ variant: "ghost" })}
      >
        Change specialty
      </button>
    </div>
  );
}

function DoctorOptions({
  doctors,
  label,
  interactive,
  busy,
  onEvent,
}: CardProps & { doctors: DoctorOption[]; label: string }) {
  return (
    <ul aria-label={label} className="mt-3 space-y-2">
      {doctors.map((doctor) => {
        const details = [doctor.departmentName, doctor.specialties.join(", ")]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={doctor.id}>
            <button
              type="button"
              disabled={!interactive || busy}
              onClick={() => onEvent({ type: "select_doctor", doctorId: doctor.id })}
              aria-label={`Choose ${doctor.name}${details ? `, ${details}` : ""}`}
              className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-ink">{doctor.name}</span>
                {details ? (
                  <span className="block break-words text-xs text-ink-muted">{details}</span>
                ) : null}
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-ink-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SlotPicker({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<BookingPayload, { kind: "slot_picker" }> }) {
  const [pickedStart, setPickedStart] = useState<string | null>(null);
  const disabled = !interactive || busy;

  return (
    <div className="mt-3 space-y-4">
      {payload.days.map((day) => (
        <div key={day.date} role="group" aria-labelledby={`slots-${day.date}`}>
          <p id={`slots-${day.date}`} className="text-xs font-medium text-ink-secondary">
            {formatManilaDate(day.date)}
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {day.slots.map((slot) => {
              const picked = slot.start === pickedStart;
              return (
                <li key={slot.start}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    disabled={disabled}
                    onClick={() => {
                      setPickedStart(slot.start);
                      onEvent({ type: "select_slot", start: slot.start });
                    }}
                    className={`focus-ring inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none ${
                      picked
                        ? "border-2 border-primary bg-primary-soft text-ink"
                        : "border border-line-strong bg-surface text-ink hover:bg-primary-soft"
                    }`}
                  >
                    {picked ? <CheckIcon className="size-4 text-primary" /> : null}
                    {payload.walkIn ? `From ${formatManilaTime(slot.start)}` : formatManilaTime(slot.start)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {payload.days.length > 0 ? (
        <p className="text-xs text-ink-muted">
          {payload.walkIn
            ? "First come, first served from opening time. Times are in Philippine time (Asia/Manila)."
            : "Times are in Philippine time (Asia/Manila)."}
        </p>
      ) : null}

      {payload.nextFromDate ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (payload.nextFromDate) onEvent({ type: "more_slots", fromDate: payload.nextFromDate });
          }}
          className={buttonVariants({ variant: "secondary" })}
        >
          Show later dates
        </button>
      ) : null}

      {payload.alternatives.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-ink-secondary">Other doctors</p>
          <DoctorOptions
            doctors={payload.alternatives}
            label="Other doctors"
            interactive={interactive}
            busy={busy}
            onEvent={onEvent}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Who and when: the doctor, or the services of a lab, imaging, or package visit (PAY-07). */
function VisitRows({
  payload,
}: {
  payload: Extract<BookingPayload, { kind: "booking_summary" | "booking_result" }>;
}) {
  const date = formatManilaDate(manilaDateOf(payload.start));
  return (
    <>
      {payload.services ? (
        <SummaryRow term="Services">{payload.services.join(", ")}</SummaryRow>
      ) : (
        <SummaryRow term="Doctor">{payload.doctorName}</SummaryRow>
      )}
      {payload.kind === "booking_summary" && payload.specialtyName ? (
        <SummaryRow term="Specialty">{payload.specialtyName}</SummaryRow>
      ) : null}
      <SummaryRow term="Date">{date}</SummaryRow>
      <SummaryRow term="Time">
        {payload.walkIn
          ? `Come in from ${formatManilaTime(payload.start)} to ${formatManilaTime(payload.end)} (Asia/Manila)`
          : `${formatManilaTime(payload.start)} – ${formatManilaTime(payload.end)} (Asia/Manila)`}
      </SummaryRow>
    </>
  );
}

/** PAY-07: published requirements, shown before payment. */
export function RequirementList({ requirements }: { requirements: ServiceRequirementView[] }) {
  return (
    <div className="mt-3">
      <p aria-hidden="true" className="text-xs font-medium text-ink-secondary">
        What to prepare
      </p>
      <ul aria-label="What to prepare" className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
        {requirements.map((requirement) => (
          <li key={`${requirement.serviceName}:${requirement.title}`} className="break-words">
            {`${requirement.serviceName}: ${requirement.title}`}
            {requirement.description ? (
              <span className="block text-xs text-ink-muted">{requirement.description}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-ink-muted">{term}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function BookingSummary({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<BookingPayload, { kind: "booking_summary" }> }) {
  const [confirming, setConfirming] = useState(false);
  const [editingReason, setEditingReason] = useState(false);
  const [reasonDraft, setReasonDraft] = useState(payload.reason ?? "");
  const disabled = !interactive || busy;
  const pendingConfirm = busy && confirming;

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <dl className="space-y-1.5 text-sm">
        <VisitRows payload={payload} />
        {payload.reason ? <SummaryRow term="Reason for visit">{payload.reason}</SummaryRow> : null}
      </dl>
      {payload.requirements?.length ? <RequirementList requirements={payload.requirements} /> : null}
      {payload.charge ? <ChargeBreakdown charge={payload.charge} /> : null}
      {editingReason ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = reasonDraft.trim();
            if (!reason) return;
            setEditingReason(false);
            onEvent({ type: "update_reason", reason });
          }}
        >
          <label htmlFor="booking-reason" className="text-sm font-medium text-ink">
            Reason for visit
          </label>
          <textarea
            id="booking-reason"
            value={reasonDraft}
            maxLength={BOOKING_REASON_MAX_LENGTH}
            rows={2}
            onChange={(event) => setReasonDraft(event.target.value)}
            className="focus-ring rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={disabled || !reasonDraft.trim()}
              className={buttonVariants({ variant: "secondary" })}
            >
              Save reason
            </button>
            <button
              type="button"
              onClick={() => setEditingReason(false)}
              className={buttonVariants({ variant: "ghost" })}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-busy={pendingConfirm || undefined}
          onClick={() => {
            setConfirming(true);
            onEvent({ type: "confirm_booking" });
          }}
          className={buttonVariants({ variant: "primary" })}
        >
          {pendingConfirm ? "Booking…" : "Confirm booking"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEvent({ type: "change_booking", field: "slot" })}
          className={buttonVariants({ variant: "secondary" })}
        >
          Change time
        </button>
        {payload.charge ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEvent({ type: "change_booking", field: "payment" })}
            className={buttonVariants({ variant: "ghost" })}
          >
            Change discount or payment
          </button>
        ) : null}
        {payload.services ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEvent({ type: "change_booking", field: "service" })}
            className={buttonVariants({ variant: "ghost" })}
          >
            Change tests
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEditingReason(true)}
              className={buttonVariants({ variant: "ghost" })}
            >
              Edit reason
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onEvent({ type: "change_booking", field: "doctor" })}
              className={buttonVariants({ variant: "ghost" })}
            >
              Change doctor
            </button>
          </>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEvent({ type: "cancel_booking" })}
          className={buttonVariants({ variant: "ghost" })}
        >
          Stop booking
        </button>
      </div>
      {interactive ? null : (
        <p className="mt-2 text-xs text-ink-muted">This summary is from earlier in the chat.</p>
      )}
    </div>
  );
}

/** Never says "confirmed": the doctor still has to accept the request (design.md §6.3). */
function BookingResult({ payload }: { payload: Extract<BookingPayload, { kind: "booking_result" }> }) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Request received</p>
        <StatusBadge status="requested" />
      </div>
      <dl className="mt-2 space-y-1.5 text-sm">
        <VisitRows payload={payload} />
      </dl>
      {payload.payment ? <BookedPaymentDetails payment={payload.payment} /> : null}
      <p className="mt-2 text-xs text-ink-muted">
        {payload.services ? "Awaiting front desk confirmation." : "Awaiting the doctor's confirmation."}
      </p>
      <Link
        href="/chat?view=appointments"
        className="focus-ring mt-2 inline-block text-sm text-primary underline underline-offset-4 hover:text-primary-hover"
      >
        View my appointments
      </Link>
    </div>
  );
}
