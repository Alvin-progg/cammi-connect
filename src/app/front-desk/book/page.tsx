import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { BookingForm } from "@/components/front-desk/booking-form";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { RegisterPatientForm } from "@/components/front-desk/register-patient-form";
import { buttonVariants } from "@/components/ui/button";
import { todayInManila } from "@/lib/appointments/filters";
import { formatManilaMediumDate } from "@/lib/appointments/format";
import {
  PATIENT_SEARCH_MAX_LENGTH,
  parseBookingParams,
  type PatientMatch,
} from "@/lib/front-desk/booking";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseAvailabilitySource } from "@/server/availability/repository";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { listBookableDoctors } from "@/server/directory/service";
import { supabaseFrontDeskPatientsRepository } from "@/server/front-desk/repository";
import { listBookingSlots, searchPatients } from "@/server/front-desk/service";

export const instant = false;

export const metadata: Metadata = { title: "New appointment" };

const BOOK_PATH = "/front-desk/book";
const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const SECONDARY_BUTTON_CLASS = buttonVariants({ variant: "secondary" });
const LINK_CLASS =
  "focus-ring inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline";

/**
 * Staff-assisted booking for walk-in and phone-in patients (SPEC-frontdesk
 * §7). Step 1 finds or registers the patient; step 2 picks a doctor, a date,
 * and a slot from real availability. Every step is a GET page except the
 * two writes, which are Server Actions re-checked by the database.
 */
export default async function FrontDeskBookPage({ searchParams }: PageProps<"/front-desk/book">) {
  const session = await getFrontDeskSession(BOOK_PATH);
  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const now = new Date();
  const params = parseBookingParams(await searchParams, now);

  if (!params.patientId) {
    return (
      <FrontDeskShell
        staffName={session.staff.fullName}
        active="book"
        crumbs={[{ label: "New appointment" }]}
      >
        <PatientStep search={params.search} />
      </FrontDeskShell>
    );
  }

  const patient = await supabaseFrontDeskPatientsRepository.getPatient(params.patientId);
  if (!patient) {
    notFound();
  }

  const [specialties, doctors] = await Promise.all([
    supabaseDirectoryRepository.listSpecialties(),
    listBookableDoctors(
      { specialtyId: params.specialtyId ?? undefined },
      supabaseDirectoryRepository,
    ),
  ]);
  const activeSpecialties = specialties.filter((specialty) => specialty.isActive);
  // A doctor outside the chosen specialty counts as not chosen.
  const doctor = doctors.find((entry) => entry.id === params.doctorId) ?? null;
  const slots = doctor
    ? await listBookingSlots(
        { doctorId: doctor.id, specialtyId: params.specialtyId, date: params.date },
        supabaseAvailabilitySource,
        now,
      )
    : [];

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="book"
      crumbs={[{ label: "New appointment", href: BOOK_PATH }, { label: patient.fullName }]}
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <PatientSummary patient={patient} />
        <form method="get" aria-label="Choose a doctor and date" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="patient" value={patient.id} />
          <div className="flex flex-col gap-1">
            <label htmlFor="book-specialty" className={FIELD_LABEL_CLASS}>
              Specialty
            </label>
            <select
              id="book-specialty"
              name="specialty"
              defaultValue={params.specialtyId ?? ""}
              className={CONTROL_CLASS}
            >
              <option value="">Any specialty</option>
              {activeSpecialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="book-doctor" className={FIELD_LABEL_CLASS}>
              Doctor
            </label>
            <select
              id="book-doctor"
              name="doctor"
              defaultValue={doctor?.id ?? ""}
              className={CONTROL_CLASS}
            >
              <option value="">Choose a doctor</option>
              {doctors.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="book-date" className={FIELD_LABEL_CLASS}>
              Date
            </label>
            <input
              id="book-date"
              type="date"
              name="date"
              min={todayInManila(now)}
              defaultValue={params.date}
              className={CONTROL_CLASS}
            />
          </div>
          <button type="submit" className={SECONDARY_BUTTON_CLASS}>
            Show slots
          </button>
        </form>
        {doctor ? (
          <>
            <h2 className="text-base font-semibold text-ink">
              {`Free slots with ${doctor.fullName} on ${formatManilaMediumDate(params.date)}`}
            </h2>
            {/* Keyed so a new doctor or date starts from a fresh form. */}
            <BookingForm
              key={`${doctor.id}-${params.date}`}
              patientId={patient.id}
              patientName={patient.fullName}
              doctorId={doctor.id}
              doctorName={doctor.fullName}
              specialtyId={params.specialtyId}
              dateLabel={formatManilaMediumDate(params.date)}
              slots={slots}
            />
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            {doctors.length === 0
              ? "No doctors are taking appointments for this specialty."
              : "Choose a doctor and a date, then show the free slots."}
          </p>
        )}
      </div>
    </FrontDeskShell>
  );
}

async function PatientStep({ search }: { search: string | null }) {
  const outcome = search
    ? await searchPatients(search, supabaseFrontDeskPatientsRepository)
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <section aria-labelledby="patient-search-title" className="flex flex-col gap-4">
        <h2 id="patient-search-title" className="text-base font-semibold text-ink">
          Find the patient
        </h2>
        <form method="get" role="search" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="patient-search" className={FIELD_LABEL_CLASS}>
              Name or phone number
            </label>
            <input
              id="patient-search"
              type="search"
              name="q"
              defaultValue={search ?? ""}
              minLength={2}
              maxLength={PATIENT_SEARCH_MAX_LENGTH}
              required
              className={`${CONTROL_CLASS} w-72 max-w-full`}
            />
          </div>
          <button type="submit" className={SECONDARY_BUTTON_CLASS}>
            Search
          </button>
        </form>
        {outcome && !outcome.ok ? (
          <p role="alert" className="text-sm text-danger-soft-ink">
            {outcome.message}
          </p>
        ) : null}
        {outcome?.ok ? <PatientResults patients={outcome.patients} /> : null}
      </section>
      <section aria-labelledby="register-patient-title" className="flex flex-col gap-4">
        <h2 id="register-patient-title" className="text-base font-semibold text-ink">
          Register a new patient
        </h2>
        <p className="text-sm text-ink-secondary">
          Search first. Register only when the patient isn&apos;t already on file.
        </p>
        <RegisterPatientForm />
      </section>
    </div>
  );
}

function PatientResults({ patients }: { patients: PatientMatch[] }) {
  if (patients.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No patients match. Register the patient below.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {patients.map((patient) => (
        <li key={patient.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{patient.fullName}</p>
            <p className="text-sm text-ink-secondary">
              {patient.phone ?? "No phone on file"}
            </p>
          </div>
          <AccountBadge hasAccount={patient.hasAccount} />
          <Link
            href={`${BOOK_PATH}?patient=${patient.id}`}
            aria-label={`Select ${patient.fullName}`}
            className={SECONDARY_BUTTON_CLASS}
          >
            Select
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccountBadge({ hasAccount }: { hasAccount: boolean }) {
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-secondary">
      {hasAccount ? "Online account" : "Walk-in record"}
    </span>
  );
}

function PatientSummary({ patient }: { patient: PatientMatch }) {
  return (
    <section
      aria-label="Patient"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{patient.fullName}</p>
        <p className="text-sm text-ink-secondary">{patient.phone ?? "No phone on file"}</p>
      </div>
      <AccountBadge hasAccount={patient.hasAccount} />
      <Link href={BOOK_PATH} className={LINK_CLASS}>
        Change patient
      </Link>
    </section>
  );
}
