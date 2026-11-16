"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { SLOT_DURATIONS, WEEKDAY_LABELS } from "@/lib/schedules/types";
import type { HospitalService, ServiceSchedulePeriod } from "@/lib/services/types";
import { saveServiceScheduleAction, type ServiceActionState } from "@/server/services/actions";

const IDLE_STATE: ServiceActionState = { status: "idle" };

/**
 * PAY-07 service hours: a list of active periods, each removable, and a form
 * to add one. Every save goes through the audited 0038 function. Walk-in
 * services use their periods as opening hours; scheduled ones as slots.
 */
export function ServiceScheduleEditor({
  service,
  periods,
  today,
}: {
  service: Pick<HospitalService, "id" | "bookingMode">;
  periods: ServiceSchedulePeriod[];
  today: string;
}) {
  const active = periods.filter((period) => period.isActive);
  const scheduled = service.bookingMode === "scheduled";

  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 ? (
        <p className="text-sm text-ink-secondary">No hours yet. Patients can&apos;t book this service in chat.</p>
      ) : (
        <ul aria-label="Service hours" className="flex flex-col gap-2">
          {active.map((period) => (
            <li key={period.id}>
              <RemovePeriod serviceId={service.id} period={period} scheduled={scheduled} />
            </li>
          ))}
        </ul>
      )}
      <AddPeriod serviceId={service.id} scheduled={scheduled} today={today} />
    </div>
  );
}

function periodLabel(period: ServiceSchedulePeriod, scheduled: boolean): string {
  const base = `${WEEKDAY_LABELS[period.dayOfWeek]} ${period.startTime}–${period.endTime}`;
  const slots = scheduled ? ` · ${period.slotMinutes}-min slots, ${period.capacityPerSlot} per slot` : "";
  const until = period.effectiveUntil ? ` · until ${period.effectiveUntil}` : "";
  return `${base}${slots} · from ${period.effectiveFrom}${until}`;
}

function RemovePeriod({
  serviceId,
  period,
  scheduled,
}: {
  serviceId: string;
  period: ServiceSchedulePeriod;
  scheduled: boolean;
}) {
  const { state, formAction, pending } = useAdminForm(saveServiceScheduleAction, IDLE_STATE);
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
    >
      <span className="text-sm text-ink">{periodLabel(period, scheduled)}</span>
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="scheduleId" value={period.id} />
      <input type="hidden" name="dayOfWeek" value={period.dayOfWeek} />
      <input type="hidden" name="startTime" value={period.startTime} />
      <input type="hidden" name="endTime" value={period.endTime} />
      <input type="hidden" name="slotMinutes" value={period.slotMinutes} />
      <input type="hidden" name="capacityPerSlot" value={period.capacityPerSlot} />
      <input type="hidden" name="effectiveFrom" value={period.effectiveFrom} />
      <input type="hidden" name="effectiveUntil" value={period.effectiveUntil ?? ""} />
      <input type="hidden" name="isActive" value="false" />
      <FormFooter state={state} pending={pending} label="Remove" pendingLabel="Removing…" variant="outlineDanger" />
    </form>
  );
}

function AddPeriod({
  serviceId,
  scheduled,
  today,
}: {
  serviceId: string;
  scheduled: boolean;
  today: string;
}) {
  const { state, formAction, pending } = useAdminForm(saveServiceScheduleAction, IDLE_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="serviceId" value={serviceId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="service-hours-day" label="Day">
          <select id="service-hours-day" name="dayOfWeek" defaultValue="1" className={FIELD_CLASS}>
            {WEEKDAY_LABELS.map((label, day) => (
              <option key={label} value={day}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="service-hours-from" label="Effective from">
          <input id="service-hours-from" name="effectiveFrom" type="date" defaultValue={today} required className={FIELD_CLASS} />
        </Field>
        <Field id="service-hours-start" label="Opens">
          <input id="service-hours-start" name="startTime" type="time" defaultValue="08:00" required className={FIELD_CLASS} />
        </Field>
        <Field id="service-hours-end" label="Closes">
          <input id="service-hours-end" name="endTime" type="time" defaultValue="12:00" required className={FIELD_CLASS} />
        </Field>
        {scheduled ? (
          <>
            <Field id="service-hours-slot" label="Slot length (minutes)">
              <select id="service-hours-slot" name="slotMinutes" defaultValue="30" className={FIELD_CLASS}>
                {SLOT_DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="service-hours-capacity" label="Patients per slot">
              <input
                id="service-hours-capacity"
                name="capacityPerSlot"
                type="number"
                min={1}
                max={100}
                defaultValue={1}
                required
                className={FIELD_CLASS}
              />
            </Field>
          </>
        ) : (
          <>
            {/* Walk-in: the hours are opening hours; the daily cap is on the details form. */}
            <input type="hidden" name="slotMinutes" value="60" />
            <input type="hidden" name="capacityPerSlot" value="1" />
          </>
        )}
        <Field id="service-hours-until" label="Effective until (optional)">
          <input id="service-hours-until" name="effectiveUntil" type="date" className={FIELD_CLASS} />
        </Field>
      </div>
      {state.status === "success" ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
      <FormFooter state={state} pending={pending} label="Add hours" />
    </form>
  );
}
