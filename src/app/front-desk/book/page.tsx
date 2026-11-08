import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { BookingForm } from "@/components/front-desk/booking-form";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { RegisterPatientForm } from "@/components/front-desk/register-patient-form";
import { SplitLayout } from "@/components/shell/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton, buttonVariants } from "@/components/ui/button";
import { Avatar, Card, CardHeader, DetailList } from "@/components/ui/card";
import { CONTROL_CLASS, FieldGrid, Fieldset } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/navigation";
import { initialsOf } from "@/components/ui/rail";
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
const FIELD_LABEL_CLASS = "text-sm font-medium text-ink";
const LEAD = "For walk-ins and phone calls. Bookings made here are confirmed right away.";

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
        lead={LEAD}
      >
        <SplitLayout
          main={<PatientStep search={params.search} />}
          side={
            <Card className="shadow-card xl:sticky xl:top-6">
              <CardHeader title="Review" />
              <DetailList
                termWidth="4.5rem"
                items={[
                  ["Patient", "Not chosen"],
                  ["Source", "Front desk"],
                ]}
              />
              <p className="mt-4 text-xs text-ink-muted">Find or register the patient first.</p>
            </Card>
          }
        />
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
      title="New appointment"
      lead={LEAD}
    >
      {/* Keyed so a new doctor or date starts from a fresh form. */}
      <BookingForm
        key={`${doctor?.id ?? "none"}-${params.date}`}
        patientId={patient.id}
        patientName={patient.fullName}
        doctorId={doctor?.id ?? null}
        doctorName={doctor?.fullName ?? null}
        specialtyId={params.specialtyId}
        dateLabel={formatManilaMediumDate(params.date)}
        slots={slots}
        noDoctorMessage={
          doctors.length === 0
            ? "No doctors are taking appointments for this specialty."
            : "Choose a doctor and a date, then show the free slots."
        }
        patientStep={<PatientSummary patient={patient} />}
        doctorControl={
          <form method="get" aria-label="Choose a doctor and date" className="flex flex-col gap-3">
            <input type="hidden" name="patient" value={patient.id} />
            <FieldGrid className="lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
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
              <div className="flex flex-col gap-1.5">
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
              <div className="flex flex-col gap-1.5">
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
            </FieldGrid>
            <button
              type="submit"
              className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
            >
              Show slots
            </button>
          </form>
        }
      />
    </FrontDeskShell>
  );
}

async function PatientStep({ search }: { search: string | null }) {
  const outcome = search
    ? await searchPatients(search, supabaseFrontDeskPatientsRepository)
    : null;

  return (
    <Fieldset legend="1 · Patient">
      <form method="get" role="search" aria-label="Find the patient" className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Name or phone number"
          type="search"
          name="q"
          placeholder="Name or phone"
          defaultValue={search ?? ""}
          minLength={2}
          maxLength={PATIENT_SEARCH_MAX_LENGTH}
          required
          className="flex-1"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>
      {outcome && !outcome.ok ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {outcome.message}
        </p>
      ) : null}
      {outcome?.ok ? <PatientResults patients={outcome.patients} /> : null}
      <details>
        <summary
          className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit cursor-pointer list-none" })}
        >
          <UserPlus aria-hidden="true" />
          Register walk-in patient
        </summary>
        <section aria-labelledby="register-patient-title" className="mt-4 flex flex-col gap-3">
          <h2 id="register-patient-title" className="text-sm font-semibold text-ink">
            Register a new patient
          </h2>
          <p className="text-sm text-ink-muted">
            Search first. Register only when the patient isn&apos;t already on file.
          </p>
          <RegisterPatientForm />
        </section>
      </details>
    </Fieldset>
  );
}

function PatientResults({ patients }: { patients: PatientMatch[] }) {
  if (patients.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No patients match. Use Register walk-in patient below.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line rounded-xl border border-line px-3">
      {patients.map((patient) => (
        <li key={patient.id} className="flex flex-wrap items-center gap-3 py-2.5">
          <Avatar initials={initialsOf(patient.fullName, "PT")} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{patient.fullName}</p>
            <p className="text-xs text-ink-muted">{patient.phone ?? "No phone on file"}</p>
          </div>
          <AccountBadge hasAccount={patient.hasAccount} />
          <LinkButton
            variant="ghost"
            size="sm"
            href={`${BOOK_PATH}?patient=${patient.id}`}
            aria-label={`Select ${patient.fullName}`}
          >
            Select
          </LinkButton>
        </li>
      ))}
    </ul>
  );
}

function AccountBadge({ hasAccount }: { hasAccount: boolean }) {
  return <Badge tone="neutral">{hasAccount ? "Online account" : "Walk-in record"}</Badge>;
}

function PatientSummary({ patient }: { patient: PatientMatch }) {
  return (
    <Fieldset legend="1 · Patient">
      <section aria-label="Patient" className="flex flex-wrap items-center gap-3">
        <Avatar initials={initialsOf(patient.fullName, "PT")} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{patient.fullName}</p>
          <p className="text-xs text-ink-muted">{patient.phone ?? "No phone on file"}</p>
        </div>
        <AccountBadge hasAccount={patient.hasAccount} />
        <Badge tone="info">Selected</Badge>
        <LinkButton variant="ghost" size="sm" href={BOOK_PATH}>
          Change patient
        </LinkButton>
      </section>
    </Fieldset>
  );
}
