"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import {
  addBlockedSlotAction,
  removeBlockedSlotAction,
  saveScheduleDayAction,
  type ScheduleActionState,
} from "@/server/schedules/actions";
import { SLOT_DURATIONS } from "@/lib/schedules/types";
import type { WeeklySchedule } from "@/lib/schedules/types";

const IDLE_STATE: ScheduleActionState = { status: "idle" };

function useScheduleToast(
  state: ScheduleActionState,
  onSuccess?: () => void,
) {
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

export function ScheduleDayRow({
  dayOfWeek,
  label,
  schedule,
}: {
  dayOfWeek: number;
  label: string;
  schedule: WeeklySchedule | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveScheduleDayAction,
    IDLE_STATE,
  );
  useScheduleToast(state);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={schedule?.isActive ?? false}
            className="size-4 accent-primary focus-ring"
          />
          Consultation day
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`start-${dayOfWeek}`}
            className="text-xs font-medium text-ink-muted"
          >
            Start
          </label>
          <input
            id={`start-${dayOfWeek}`}
            name="startTime"
            type="time"
            required
            defaultValue={schedule?.startTime ?? "09:00"}
            className="min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`end-${dayOfWeek}`}
            className="text-xs font-medium text-ink-muted"
          >
            End
          </label>
          <input
            id={`end-${dayOfWeek}`}
            name="endTime"
            type="time"
            required
            defaultValue={schedule?.endTime ?? "17:00"}
            className="min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`duration-${dayOfWeek}`}
            className="text-xs font-medium text-ink-muted"
          >
            Slot length
          </label>
          <select
            id={`duration-${dayOfWeek}`}
            name="slotDurationMinutes"
            defaultValue={String(schedule?.slotDurationMinutes ?? 30)}
            className="min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
          >
            {SLOT_DURATIONS.map((duration) => (
              <option key={duration} value={duration}>
                {duration} min
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function BlockSlotForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    addBlockedSlotAction,
    IDLE_STATE,
  );
  useScheduleToast(state, () => formRef.current?.reset());

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="block-date" className="text-xs font-medium text-ink-muted">
            Date
          </label>
          <input
            id="block-date"
            name="date"
            type="date"
            required
            className="min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="block-start"
            className="text-xs font-medium text-ink-muted"
          >
            From
          </label>
          <input
            id="block-start"
            name="startTime"
            type="time"
            required
            className="min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="block-end" className="text-xs font-medium text-ink-muted">
            Until
          </label>
          <input
            id="block-end"
            name="endTime"
            type="time"
            required
            className="min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
          />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label
            htmlFor="block-reason"
            className="text-xs font-medium text-ink-muted"
          >
            Reason
          </label>
          <input
            id="block-reason"
            name="reason"
            type="text"
            required
            minLength={3}
            maxLength={200}
            placeholder="e.g. Inpatient rounds, leave"
            className="min-h-11 rounded-lg border border-control-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-ring"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
        >
          {pending ? "Blocking…" : "Block this time"}
        </button>
        <FormError state={state} />
      </div>
    </form>
  );
}

export function RemoveBlockButton({ blockId }: { blockId: string }) {
  const [state, formAction, pending] = useActionState(
    removeBlockedSlotAction,
    IDLE_STATE,
  );
  useScheduleToast(state);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="blockId" value={blockId} />
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
