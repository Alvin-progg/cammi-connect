import { formatScheduleSummary } from "@/lib/schedules/types";
import type { WeeklySchedule } from "@/lib/schedules/types";
import type { DoctorProfileDetails } from "@/server/profiles/service";

import { ProfileContactForm } from "./doctor-profile-panel";

/**
 * Profile tab: hospital-managed assignment (read-only) plus the doctor's
 * permitted editable contact details.
 */
export function DoctorProfileView({
  details,
  schedules,
}: {
  details: DoctorProfileDetails;
  schedules: WeeklySchedule[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="profile-assignment-heading"
        className="rounded-xl border border-line bg-surface p-4 sm:p-6"
      >
        <h2
          id="profile-assignment-heading"
          className="text-xl font-semibold text-ink"
        >
          Hospital assignment
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          Managed by the hospital administration. Contact them to change these
          details.
        </p>
        <dl className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-ink-muted">Full name</dt>
            <dd className="text-sm font-medium text-ink">{details.fullName}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-ink-muted">Department</dt>
            <dd className="text-sm text-ink">
              {details.department?.name ?? "Not assigned"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-ink-muted">Specialty</dt>
            <dd className="text-sm text-ink">
              {details.specialty ?? "Not recorded"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-ink-muted">
              Consultation schedule
            </dt>
            <dd className="text-sm text-ink">
              {formatScheduleSummary(schedules)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="profile-contact-heading"
        className="rounded-xl border border-line bg-surface p-4 sm:p-6"
      >
        <h2
          id="profile-contact-heading"
          className="text-xl font-semibold text-ink"
        >
          Contact details
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          You may update your contact number and clinic note.
        </p>
        <div className="mt-4">
          <ProfileContactForm
            initialPhone={details.phone ?? ""}
            initialClinicNote={details.clinicNote ?? ""}
          />
        </div>
      </section>
    </div>
  );
}
