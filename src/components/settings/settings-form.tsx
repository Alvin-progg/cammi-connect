"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRef, useState } from "react";

import { FIELD_CLASS, Field, LABEL_CLASS } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from "@/components/front-desk/dialog-styles";
import { Button } from "@/components/ui/button";
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_LABELS } from "@/lib/knowledge/types";
import { formatSettingValue, SETTING_LABELS } from "@/lib/settings/display";
import {
  HOSPITAL_TIMEZONE,
  SLOT_MINUTE_OPTIONS,
  WEEKDAY_LABELS,
  diffSettings,
  settingsFromFormData,
  settingsGroupSchemas,
  type SettingChange,
  type SettingGroup,
  type SystemSettings,
} from "@/lib/settings/schema";
import {
  saveSettingsAction,
  sendPolicyToKnowledgeBaseAction,
  type SettingsActionState,
} from "@/server/settings/actions";

const IDLE_STATE: SettingsActionState = { status: "idle" };

const HINT_CLASS = "text-xs text-ink-muted";

/**
 * One settings tab. "Review changes" validates the form in the browser and
 * lists previous → new values; only "Save changes" in that dialog submits.
 * The server validates again and records the audit row.
 */
export function SettingsForm({
  group,
  settings,
}: {
  group: SettingGroup;
  settings: SystemSettings;
}) {
  const { state, formAction, pending } = useAdminForm(saveSettingsAction, IDLE_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const [changes, setChanges] = useState<SettingChange[]>([]);
  const [open, setOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  function review() {
    const form = formRef.current;
    if (!form) return;
    const parsed = settingsGroupSchemas[group].safeParse(
      settingsFromFormData(group, new FormData(form)),
    );
    if (!parsed.success) {
      setReviewError(parsed.error.issues[0]?.message ?? "Check the form values.");
      return;
    }
    const pendingChanges = diffSettings(settings, parsed.data);
    if (pendingChanges.length === 0) {
      setReviewError("Nothing changed.");
      return;
    }
    setReviewError(null);
    setChanges(pendingChanges);
    setOpen(true);
  }

  const errorMessage = reviewError ?? (state.status === "error" ? state.message : null);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        aria-label={`${group} settings`}
        className="flex max-w-2xl flex-col gap-5"
      >
        <input type="hidden" name="group" value={group} />
        {group === "appointment" ? <AppointmentFields settings={settings} /> : null}
        {group === "hospital" ? <HospitalFields settings={settings} /> : null}
        {group === "chatbot" ? <ChatbotFields settings={settings} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={review} disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Review changes"}
          </Button>
          {errorMessage ? (
            <p role="alert" className="text-sm text-danger-soft-ink">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </form>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className={DIALOG_BACKDROP_CLASS} />
          <Dialog.Popup className={DIALOG_POPUP_CLASS}>
            <Dialog.Title className="text-lg font-semibold text-ink">Review changes</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink-secondary">
              These settings change as soon as you save. The change is recorded in the audit log.
            </Dialog.Description>
            <dl className="mt-4 flex flex-col gap-3">
              {changes.map((change) => (
                <div key={change.key} className="rounded-lg border border-line p-3 text-sm">
                  <dt className="font-medium text-ink">{SETTING_LABELS[change.key]}</dt>
                  <dd className="mt-1 text-ink-muted">
                    <span className="sr-only">Previous: </span>
                    <span className="break-words line-through">
                      {formatSettingValue(change.key, change.previous)}
                    </span>
                  </dd>
                  <dd className="mt-0.5 text-ink">
                    <span className="sr-only">New: </span>
                    <span className="break-words">{formatSettingValue(change.key, change.next)}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close render={<Button variant="ghost" />}>Go back</Dialog.Close>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => {
                  // The outcome shows under the form: a toast on success, an alert on refusal.
                  formRef.current?.requestSubmit();
                  setOpen(false);
                }}
              >
                Save changes
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <Field id={name} label={label}>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        defaultValue={defaultValue ?? ""}
        className={FIELD_CLASS}
      />
      {hint ? <p className={HINT_CLASS}>{hint}</p> : null}
    </Field>
  );
}

function PolicyField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <Field id={name} label={label}>
      <textarea
        id={name}
        name={name}
        rows={4}
        maxLength={5000}
        defaultValue={defaultValue}
        className={`${FIELD_CLASS} py-2`}
      />
    </Field>
  );
}

function AppointmentFields({ settings }: { settings: SystemSettings }) {
  return (
    <>
      <Field id="appointment.default_slot_minutes" label="Default slot length">
        <select
          id="appointment.default_slot_minutes"
          name="appointment.default_slot_minutes"
          defaultValue={String(settings["appointment.default_slot_minutes"])}
          className={FIELD_CLASS}
        >
          {SLOT_MINUTE_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min
            </option>
          ))}
        </select>
        <p className={HINT_CLASS}>Pre-selected when a new consultation period is added.</p>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          name="appointment.min_lead_hours"
          label="Minimum booking lead time (hours)"
          defaultValue={settings["appointment.min_lead_hours"]}
          min={0}
          max={168}
          hint="Cami offers only slots at least this far ahead. Front desk bookings are not limited."
        />
        <NumberField
          name="appointment.max_advance_days"
          label="Maximum advance booking (days)"
          defaultValue={settings["appointment.max_advance_days"]}
          min={1}
          max={365}
          hint="How far ahead patients can book through Cami."
        />
      </div>
      <NumberField
        name="appointment.request_expiry_hours"
        label="Request expiry (hours)"
        defaultValue={settings["appointment.request_expiry_hours"]}
        min={1}
        max={720}
        hint="Leave blank to keep expiry off. Saved for the hospital's policy; requests do not expire yet."
      />
      <PolicyField
        name="appointment.cancellation_policy_text"
        label="Cancellation policy"
        defaultValue={settings["appointment.cancellation_policy_text"]}
      />
      <PolicyField
        name="appointment.reschedule_policy_text"
        label="Reschedule policy"
        defaultValue={settings["appointment.reschedule_policy_text"]}
      />
    </>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  type = "text",
  maxLength,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: "text" | "email" | "tel";
  maxLength: number;
}) {
  return (
    <Field id={name} label={label}>
      <input
        id={name}
        name={name}
        type={type}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className={FIELD_CLASS}
      />
    </Field>
  );
}

function HospitalFields({ settings }: { settings: SystemSettings }) {
  return (
    <>
      <TextField name="hospital.name" label="Hospital name" defaultValue={settings["hospital.name"]} maxLength={200} />
      <TextField name="hospital.address" label="Address" defaultValue={settings["hospital.address"]} maxLength={200} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="hospital.contact_phone"
          label="Contact phone"
          type="tel"
          defaultValue={settings["hospital.contact_phone"]}
          maxLength={50}
        />
        <TextField
          name="hospital.contact_email"
          label="Contact email"
          type="email"
          defaultValue={settings["hospital.contact_email"]}
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Timezone</span>
        <p className="text-sm text-ink">{HOSPITAL_TIMEZONE}</p>
        <p className={HINT_CLASS}>Every date and time in CamiConnect uses Manila time. It can&apos;t be changed.</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL_CLASS}>Operating hours</legend>
        {settings["hospital.operating_hours"].map((day) => {
          const label = WEEKDAY_LABELS[day.day];
          return (
            <div
              key={day.day}
              role="group"
              aria-label={label}
              className="grid grid-cols-[6rem_1fr_1fr_auto] items-center gap-2"
            >
              <span className="text-sm text-ink">{label}</span>
              <input
                type="time"
                name={`hours.${day.day}.open`}
                aria-label="Opens"
                defaultValue={day.open ?? ""}
                className={FIELD_CLASS}
              />
              <input
                type="time"
                name={`hours.${day.day}.close`}
                aria-label="Closes"
                defaultValue={day.close ?? ""}
                className={FIELD_CLASS}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name={`hours.${day.day}.closed`}
                  defaultChecked={day.open === null}
                  className="size-4"
                />
                Closed
              </label>
            </div>
          );
        })}
      </fieldset>
    </>
  );
}

function ChatbotFields({ settings }: { settings: SystemSettings }) {
  const enabledCategories = new Set(settings["chatbot.enabled_categories"]);
  return (
    <>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          name="chatbot.enabled"
          defaultChecked={settings["chatbot.enabled"]}
          className="size-4"
        />
        Cami chatbot is on
      </label>
      <p className={`${HINT_CLASS} -mt-4`}>
        When off, patients see a maintenance message with the hospital contact phone.
      </p>
      <Field id="chatbot.welcome_message" label="Welcome message">
        <textarea
          id="chatbot.welcome_message"
          name="chatbot.welcome_message"
          rows={3}
          maxLength={500}
          defaultValue={settings["chatbot.welcome_message"]}
          className={`${FIELD_CLASS} py-2`}
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL_CLASS}>Knowledge categories Cami answers from</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {KNOWLEDGE_CATEGORIES.map((category) => (
            <label key={category} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="chatbot.enabled_categories"
                value={category}
                defaultChecked={enabledCategories.has(category)}
                className="size-4"
              />
              {KNOWLEDGE_CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

const POLICIES = [
  { key: "appointment.cancellation_policy_text", name: "cancellation policy" },
  { key: "appointment.reschedule_policy_text", name: "reschedule policy" },
] as const;

/**
 * Turns a saved policy text into a draft knowledge document. Only saved text
 * is sent, so the button stays disabled until the policy has been saved.
 */
export function PolicyToKnowledgeBase({ settings }: { settings: SystemSettings }) {
  const { state, formAction, pending } = useAdminForm(sendPolicyToKnowledgeBaseAction, IDLE_STATE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {POLICIES.map((policy) => (
          <form key={policy.key} action={formAction}>
            <input type="hidden" name="key" value={policy.key} />
            <Button
              type="submit"
              variant="secondary"
              disabled={pending || settings[policy.key].trim() === ""}
            >
              {`Send ${policy.name} to knowledge base`}
            </Button>
          </form>
        ))}
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
