"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  formatManilaDateTime,
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

const FIELD_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const LABEL_CLASS = "text-xs font-medium text-ink-muted";
const PRIMARY_BUTTON_CLASS =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none";

function useScheduleToast(state: ScheduleActionState, onSuccess?: () => void) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess?.();
    }
  }, [state, onSuccess]);
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

function PeriodRow({
  period,
  ...editorProps
}: EditorProps & { period: WeeklySchedule }) {
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].savePeriod,
    IDLE_STATE,
  );
  useScheduleToast(state);

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-3 rounded-lg border border-line p-3 ${
        period.isActive ? "bg-surface" : "bg-surface-muted"
      }`}
    >
      <DoctorField doctorId={editorProps.doctorId} />
      <input type="hidden" name="periodId" value={period.id} />
      <input type="hidden" name="dayOfWeek" value={period.dayOfWeek} />
      <PeriodFields
        idPrefix={`period-${period.id}`}
        period={period}
        defaultEffectiveFrom={period.effectiveFrom}
      />
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
  );
}

function AddPeriodForm({ today, ...editorProps }: EditorProps & { today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].savePeriod,
    IDLE_STATE,
  );
  useScheduleToast(state, () => formRef.current?.reset());

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label="Add consultation period"
      className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong bg-surface p-4"
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
  );
}

/**
 * Weekly consultation periods grouped by weekday. A day may hold several
 * periods; each has its own slot length and effective dates. Unchecking
 * "Active" retires a period without deleting it.
 */
export function SchedulePeriodsSection({
  schedules,
  today,
  ...editorProps
}: EditorProps & { schedules: WeeklySchedule[]; today: string }) {
  const days = WEEKDAY_LABELS.map((label, dayOfWeek) => ({
    label,
    periods: schedules
      .filter((schedule) => schedule.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((day) => day.periods.length > 0);

  return (
    <section aria-labelledby="weekly-hours-heading">
      <h2 id="weekly-hours-heading" className="text-xl font-semibold text-ink">
        Regular consultation hours
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink-secondary">
        Add one or more consultation periods per weekday. Each period has a
        fixed appointment length. Times are in Asia/Manila (PHT). Changing
        hours never moves existing appointments.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
            No consultation periods yet.
          </p>
        ) : (
          days.map((day) => (
            <fieldset
              key={day.label}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
            >
              <legend className="px-1 text-sm font-semibold text-ink">
                {day.label}
              </legend>
              {day.periods.map((period) => (
                <PeriodRow key={period.id} period={period} {...editorProps} />
              ))}
            </fieldset>
          ))
        )}
        <AddPeriodForm today={today} {...editorProps} />
      </div>
    </section>
  );
}

function AddExceptionForm(editorProps: EditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].addException,
    IDLE_STATE,
  );
  useScheduleToast(state, () => formRef.current?.reset());

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label="Add schedule exception"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
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
  );
}

function RemoveExceptionButton({
  exceptionId,
  ...editorProps
}: EditorProps & { exceptionId: string }) {
  const [state, formAction, pending] = useActionState(
    ACTIONS[editorProps.editor].removeException,
    IDLE_STATE,
  );
  useScheduleToast(state);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <DoctorField doctorId={editorProps.doctorId} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-danger/30 bg-danger-soft px-3 text-sm font-medium text-danger-soft-ink transition-colors hover:bg-danger hover:text-danger-ink disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
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
      <h2
        id="schedule-exceptions-heading"
        className="text-xl font-semibold text-ink"
      >
        Schedule exceptions
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink-secondary">
        Block dates or times when the doctor is unavailable. Exceptions
        override the weekly hours; existing appointments inside them are kept
        and reported so they can be followed up.
      </p>
      <div className="mt-4">
        <AddExceptionForm {...editorProps} />
      </div>
      {exceptions.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
          No exceptions in this period.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {exceptions.map((exception) => (
            <li
              key={exception.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-ink">
                    {SCHEDULE_EXCEPTION_LABELS[exception.exceptionType]}
                  </span>
                  {exception.reason}
                </p>
                <p className="text-xs text-ink-muted">
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
    </section>
  );
}
