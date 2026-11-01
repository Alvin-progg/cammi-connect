"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ChevronRightIcon, PlusIcon } from "@/components/doctor/icons";
import {
  formatClockTime,
  formatManilaDateTime,
  formatManilaMediumDate,
  formatManilaTime,
} from "@/lib/appointments/format";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";
import {
  SCHEDULE_EXCEPTION_LABELS,
  SCHEDULE_EXCEPTION_TYPES,
  SLOT_DURATIONS,
  WEEKDAY_LABELS,
  type ScheduleException,
  type WeeklySchedule,
} from "@/lib/schedules/types";
import {
  addScheduleExceptionAction,
  adminAddScheduleExceptionAction,
  adminRemoveScheduleExceptionAction,
  adminSaveSchedulePeriodAction,
  removeScheduleExceptionAction,
  saveSchedulePeriodAction,
  type ScheduleActionState,
} from "@/server/schedules/actions";

/**
 * "doctor" edits the signed-in doctor's own schedule (the server takes the
 * doctor from the session). "admin" edits the doctor named by `doctorId`.
 */
type EditorProps =
  | { editor: "doctor"; doctorId?: undefined }
  | { editor: "admin"; doctorId: string };

const ACTIONS = {
  doctor: {
    savePeriod: saveSchedulePeriodAction,
    addException: addScheduleExceptionAction,
    removeException: removeScheduleExceptionAction,
  },
  admin: {
    savePeriod: adminSaveSchedulePeriodAction,
    addException: adminAddScheduleExceptionAction,
    removeException: adminRemoveScheduleExceptionAction,
  },
} as const;

const IDLE_STATE: ScheduleActionState = { status: "idle" };

/** Monday-first, the order a working week is read in. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const FIELD_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const LABEL_CLASS = "text-xs font-medium text-ink-muted";
const PRIMARY_BUTTON_CLASS =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink pressable hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60";
const SECONDARY_BUTTON_CLASS =
  "focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink pressable hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60";
/** A <summary> styled as a button that adds something ("+ Add period"). */
const ADD_SUMMARY_CLASS =
  "focus-ring inline-flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink pressable hover:bg-surface-muted group-open:bg-surface-muted [&::-webkit-details-marker]:hidden";
const SECTION_HEADING_CLASS = "text-xl font-semibold text-ink";
const SECTION_INTRO_CLASS = "mt-1 text-sm leading-6 text-ink-secondary";

function useScheduleToast(state: ScheduleActionState, onSuccess?: () => void) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess?.();
    }
  }, [state, onSuccess]);
}

/** Collapses a <details> disclosure, e.g. after its form saved. */
function useCloseDisclosure() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const close = useCallback(() => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, []);
  return [detailsRef, close] as const;
}

function FormError({ state }: { state: ScheduleActionState }) {
  if (state.status !== "error") {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-danger-soft-ink">
      {state.message}
    </p>
  );
}

function DoctorField({ doctorId }: { doctorId?: string }) {
  return doctorId ? <input type="hidden" name="doctorId" value={doctorId} /> : null;
}

/** "Until Dec 31, 2026", "Starts Jan 5, 2027", "Ended …", or "Ongoing". */
function effectiveLabel(period: WeeklySchedule, today: string): string {
  if (period.effectiveUntil !== null && period.effectiveUntil < today) {
    return `Ended ${formatManilaMediumDate(period.effectiveUntil)}`;
  }
  if (period.effectiveFrom > today) {
    const starts = `Starts ${formatManilaMediumDate(period.effectiveFrom)}`;
    return period.effectiveUntil
      ? `${starts} · until ${formatManilaMediumDate(period.effectiveUntil)}`
      : starts;
  }
  return period.effectiveUntil
    ? `Until ${formatManilaMediumDate(period.effectiveUntil)}`
    : "Ongoing";
}

function PeriodFields({
  idPrefix,
  period,
  defaultEffectiveFrom,
}: {
  idPrefix: string;
  period: WeeklySchedule | null;
  defaultEffectiveFrom: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-start`} className={LABEL_CLASS}>
          Start
        </label>
        <input
          id={`${idPrefix}-start`}
          name="startTime"
          type="time"
          required
          defaultValue={period?.startTime ?? "09:00"}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-end`} className={LABEL_CLASS}>
          End
        </label>
        <input
          id={`${idPrefix}-end`}
          name="endTime"
          type="time"
          required
          defaultValue={period?.endTime ?? "12:00"}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-duration`} className={LABEL_CLASS}>
          Slot length
        </label>
        <select
          id={`${idPrefix}-duration`}
          name="slotDurationMinutes"
          defaultValue={String(period?.slotDurationMinutes ?? 30)}
          className={FIELD_CLASS}
        >
          {SLOT_DURATIONS.map((duration) => (
            <option key={duration} value={duration}>
              {duration} min
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-from`} className={LABEL_CLASS}>
          Effective from
        </label>
        <input
          id={`${idPrefix}-from`}
          name="effectiveFrom"
          type="date"
          required
          defaultValue={period?.effectiveFrom ?? defaultEffectiveFrom}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-until`} className={LABEL_CLASS}>
          Effective until
        </label>
        <input
          id={`${idPrefix}-until`}
          name="effectiveUntil"
          type="date"
          defaultValue={period?.effectiveUntil ?? ""}
          className={FIELD_CLASS}
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink-secondary">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={period?.isActive ?? true}
          className="size-4 accent-primary focus-ring"
        />
        Active
      </label>
    </div>
  );
}

/**
 * One consultation period: a read-only summary row that discloses its edit
 * form. Keeping the form mounted while collapsed preserves unsaved edits if
 * the doctor closes and reopens the row.
 */
function PeriodRow({
  period,
  today,
  ...editorProps
}: EditorProps & { period: WeeklySchedule; today: string }) {
  const [detailsRef, closeDetails] = useCloseDisclosure();
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].savePeriod,
    IDLE_STATE,
  );
  useScheduleToast(state, closeDetails);

  const hours = `${formatClockTime(period.startTime)} – ${formatClockTime(period.endTime)}`;

  return (
    <details ref={detailsRef} className="group rounded-lg">
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ease-snappy hover:bg-surface-muted group-open:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={`text-sm font-medium tabular-nums ${
              period.isActive ? "text-ink" : "text-ink-muted line-through"
            }`}
          >
            {hours} · {period.slotDurationMinutes} min
          </span>
          <span className="text-xs text-ink-muted">{effectiveLabel(period, today)}</span>
        </span>
        {period.isActive ? null : (
          <span className="inline-flex shrink-0 items-center rounded-full border border-line-strong bg-surface px-2 py-0.5 text-xs font-medium text-ink-secondary">
            Inactive
          </span>
        )}
        <span className="shrink-0 text-sm font-medium text-primary group-open:hidden">
          Edit
        </span>
        <span className="hidden shrink-0 text-sm font-medium text-ink-secondary group-open:inline">
          Close
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-ink-muted transition-transform duration-150 ease-snappy group-open:rotate-90 motion-reduce:transition-none" />
      </summary>

      <form
        action={formAction}
        aria-label={`Edit ${hours}`}
        className="disclosure-motion mt-2 flex flex-col gap-3 rounded-lg border border-line bg-surface p-3"
      >
        <DoctorField doctorId={editorProps.doctorId} />
        <input type="hidden" name="periodId" value={period.id} />
        <input type="hidden" name="dayOfWeek" value={period.dayOfWeek} />
        <PeriodFields
          idPrefix={`period-${period.id}`}
          period={period}
          defaultEffectiveFrom={period.effectiveFrom}
        />
        <p className="text-xs text-ink-muted">
          Uncheck Active to retire this period without deleting it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={PRIMARY_BUTTON_CLASS}
          >
            {pending ? "Saving…" : "Save period"}
          </button>
          <FormError state={state} />
        </div>
      </form>
    </details>
  );
}

function AddPeriodForm({ today, ...editorProps }: EditorProps & { today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [detailsRef, closeDetails] = useCloseDisclosure();
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].savePeriod,
    IDLE_STATE,
  );
  const onSuccess = useCallback(() => {
    formRef.current?.reset();
    closeDetails();
  }, [closeDetails]);
  useScheduleToast(state, onSuccess);

  return (
    <details ref={detailsRef} className="group">
      <summary className={ADD_SUMMARY_CLASS}>
        <PlusIcon className="size-4 transition-transform duration-150 ease-snappy group-open:rotate-45 motion-reduce:transition-none" />
        Add period
      </summary>
      <form
        ref={formRef}
        action={formAction}
        aria-label="Add consultation period"
        className="disclosure-motion mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-line-strong bg-surface p-4"
      >
        <DoctorField doctorId={editorProps.doctorId} />
        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label htmlFor="new-period-day" className={LABEL_CLASS}>
            Weekday
          </label>
          <select
            id="new-period-day"
            name="dayOfWeek"
            defaultValue="1"
            className={FIELD_CLASS}
          >
            {WEEKDAY_LABELS.map((label, dayOfWeek) => (
              <option key={label} value={dayOfWeek}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <PeriodFields idPrefix="new-period" period={null} defaultEffectiveFrom={today} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={PRIMARY_BUTTON_CLASS}
          >
            {pending ? "Adding…" : "Add period"}
          </button>
          <FormError state={state} />
        </div>
      </form>
    </details>
  );
}

/**
 * Weekly consultation periods as a read-only Monday–Sunday summary. A day may
 * hold several periods, each with its own slot length and effective dates;
 * each row opens its own edit form. Unchecking "Active" retires a period
 * without deleting it.
 */
export function SchedulePeriodsSection({
  schedules,
  today,
  ...editorProps
}: EditorProps & { schedules: WeeklySchedule[]; today: string }) {
  const days = WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    label: WEEKDAY_LABELS[dayOfWeek],
    periods: schedules
      .filter((schedule) => schedule.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  return (
    <section aria-labelledby="weekly-hours-heading">
      <h2 id="weekly-hours-heading" className={SECTION_HEADING_CLASS}>
        Weekly hours
      </h2>
      <p className={SECTION_INTRO_CLASS}>
        Times are in Asia/Manila (PHT). Changing hours never moves existing
        appointments.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {schedules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
            No consultation periods yet.
          </p>
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            {days.map((day) => {
              const headingId = `weekday-${day.dayOfWeek}-heading`;
              return (
                <div
                  key={day.dayOfWeek}
                  role="group"
                  aria-labelledby={headingId}
                  className="grid gap-1 px-2 py-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3"
                >
                  <h3
                    id={headingId}
                    className={`px-3 pt-2 text-sm font-semibold sm:pt-3 ${
                      day.periods.length > 0 ? "text-ink" : "text-ink-muted"
                    }`}
                  >
                    {day.label}
                  </h3>
                  <div className="flex flex-col gap-1">
                    {day.periods.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-ink-muted sm:py-3">
                        Not available
                      </p>
                    ) : (
                      day.periods.map((period) => (
                        <PeriodRow
                          key={period.id}
                          period={period}
                          today={today}
                          {...editorProps}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <AddPeriodForm today={today} {...editorProps} />
      </div>
    </section>
  );
}

function AddExceptionForm(editorProps: EditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [detailsRef, closeDetails] = useCloseDisclosure();
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].addException,
    IDLE_STATE,
  );
  const onSuccess = useCallback(() => {
    formRef.current?.reset();
    closeDetails();
  }, [closeDetails]);
  useScheduleToast(state, onSuccess);

  return (
    <details ref={detailsRef} className="group">
      <summary className={ADD_SUMMARY_CLASS}>
        <PlusIcon className="size-4 transition-transform duration-150 ease-snappy group-open:rotate-45 motion-reduce:transition-none" />
        Add exception
      </summary>
      <form
        ref={formRef}
        action={formAction}
        aria-label="Add schedule exception"
        className="disclosure-motion mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-line-strong bg-surface p-4"
      >
        <DoctorField doctorId={editorProps.doctorId} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="flex flex-col gap-1">
            <label htmlFor="exception-type" className={LABEL_CLASS}>
              Type
            </label>
            <select
              id="exception-type"
              name="exceptionType"
              defaultValue="blocked_period"
              className={FIELD_CLASS}
            >
              {SCHEDULE_EXCEPTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SCHEDULE_EXCEPTION_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exception-start-date" className={LABEL_CLASS}>
              From date
            </label>
            <input
              id="exception-start-date"
              name="startDate"
              type="date"
              required
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exception-end-date" className={LABEL_CLASS}>
              Until date
            </label>
            <input
              id="exception-end-date"
              name="endDate"
              type="date"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exception-start-time" className={LABEL_CLASS}>
              From time
            </label>
            <input
              id="exception-start-time"
              name="startTime"
              type="time"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exception-end-time" className={LABEL_CLASS}>
              Until time
            </label>
            <input
              id="exception-end-time"
              name="endTime"
              type="time"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="exception-reason" className={LABEL_CLASS}>
              Reason
            </label>
            <input
              id="exception-reason"
              name="reason"
              type="text"
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g. Annual leave"
              className="min-h-11 rounded-lg border border-control-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-ring"
            />
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          Leave both times blank to block whole days. Leave the end date blank
          for a single day.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={PRIMARY_BUTTON_CLASS}
          >
            {pending ? "Adding…" : "Add exception"}
          </button>
          <FormError state={state} />
        </div>
      </form>
    </details>
  );
}

/**
 * Removing an exception reopens its slots for patients to book, so it takes
 * an inline second step. Focus follows the swap (to Cancel, the safe choice,
 * and back to Remove) so keyboard users never lose their place.
 */
function RemoveExceptionButton({
  exceptionId,
  ...editorProps
}: EditorProps & { exceptionId: string }) {
  const [confirming, setConfirming] = useState(false);
  const userToggled = useRef(false);
  const removeRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].removeException,
    IDLE_STATE,
  );
  useScheduleToast(state);

  useEffect(() => {
    if (userToggled.current) {
      (confirming ? cancelRef : removeRef).current?.focus();
    }
  }, [confirming]);

  function toggle(next: boolean) {
    userToggled.current = true;
    setConfirming(next);
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
      <DoctorField doctorId={editorProps.doctorId} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      {confirming ? (
        <>
          <p className="text-sm text-ink-secondary">
            Remove? This reopens these slots for booking.
          </p>
          <button
            ref={cancelRef}
            type="button"
            disabled={pending}
            onClick={() => toggle(false)}
            className={SECONDARY_BUTTON_CLASS}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-danger bg-danger px-3 text-sm font-medium text-danger-ink pressable hover:bg-danger-hover disabled:pointer-events-none disabled:opacity-60"
          >
            {pending ? "Removing…" : "Confirm"}
          </button>
        </>
      ) : (
        <button
          ref={removeRef}
          type="button"
          onClick={() => toggle(true)}
          className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-danger/30 bg-danger-soft px-3 text-sm font-medium text-danger-soft-ink pressable hover:bg-danger hover:text-danger-ink"
        >
          Remove
        </button>
      )}
      <FormError state={state} />
    </form>
  );
}

/**
 * Date-specific unavailability: leave, blocked periods, unavailable dates,
 * and temporary changes. Exceptions override the weekly hours.
 */
export function ScheduleExceptionsSection({
  exceptions,
  ...editorProps
}: EditorProps & { exceptions: ScheduleException[] }) {
  return (
    <section aria-labelledby="schedule-exceptions-heading">
      <h2 id="schedule-exceptions-heading" className={SECTION_HEADING_CLASS}>
        Time off &amp; exceptions
      </h2>
      <p className={SECTION_INTRO_CLASS}>
        Exceptions override the weekly hours. Existing appointments inside them
        are kept and reported so they can be followed up.
      </p>

      {exceptions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
          No exceptions in this period.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {exceptions.map((exception) => (
            <li
              key={exception.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-ink">
                    {SCHEDULE_EXCEPTION_LABELS[exception.exceptionType]}
                  </span>
                  {exception.reason}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                  {formatManilaDateTime(exception.startsAt)} –{" "}
                  {manilaDateOfTimestamp(exception.startsAt) ===
                  manilaDateOfTimestamp(exception.endsAt)
                    ? formatManilaTime(exception.endsAt)
                    : formatManilaDateTime(exception.endsAt)}{" "}
                  PHT
                </p>
              </div>
              <RemoveExceptionButton exceptionId={exception.id} {...editorProps} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <AddExceptionForm {...editorProps} />
      </div>
    </section>
  );
}
