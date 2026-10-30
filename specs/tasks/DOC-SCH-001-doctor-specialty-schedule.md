# DOC-SCH-001 — Doctor, Specialty, and Schedule Management

- Status: Approved (scope decisions recorded 2026-10-30)
- Type: Feature
- Priority: High
- Module: Hospital Management / Appointment Scheduling
- ADRs: [`ADR-0007`](../decisions/ADR-0007-appointment-and-doctor-policy.md) (amended
  2026-10-30), [`ADR-0003`](../decisions/ADR-0003-database-connections-and-rls.md) (note
  2026-10-30)
- Requirements: `FR-004`, `FR-005`, `FR-006`, `UI-004`, `UI-005`

## Objective

Manage departments, medical specialties, doctors, and each doctor's recurring weekly
consultation schedule. Calculate availability from registered schedules, appointment
durations, existing bookings, and schedule exceptions. Patients select a specialty or a
specific doctor when booking.

## Approved scope decisions (2026-10-30)

1. **Doctor identity.** `doctors` is a 1:1 extension of `profiles`: `doctors.id` is both
   primary key and foreign key to `profiles(id)`. The ticket's `user_id` is
   `profiles.auth_user_id`, which is nullable, so a doctor need not have a login.
2. **Scope.** Database, domain logic, services, an atomic booking function, and an admin
   UI for departments, specialties, doctors, and schedules. Patient booking gets a
   service and a Server Action but no pages; patient booking UI is a follow-up ticket.
3. **Doctor self-edit is kept.** Doctors keep editing their own schedule periods and
   exceptions from `/doctor`. Admins can manage any doctor's schedule from `/admin`.
4. **Roles and RLS.** Only `admin` is added to the enforced roles. RLS stays
   deny-by-default per ADR-0003 and authorization is enforced in the server layer.
   Front Desk and the AI Chatbot are deferred to their own tickets; the chatbot will
   later call the same read-only availability service.

## Database

| Table | Columns |
|---|---|
| `departments` | `id`, `name`, `code`, `description`, `is_active`, `created_at` |
| `specialties` | `id`, `name`, `description`, `is_active`, `created_at` |
| `doctors` | `id` (= `profiles.id`), `department_id`, `full_name`, `is_active`, `created_at`, `updated_at` |
| `doctor_specialties` | `doctor_id`, `specialty_id` |
| `doctor_schedules` | `id`, `doctor_id`, `day_of_week`, `start_time`, `end_time`, `slot_duration_minutes`, `effective_from`, `effective_until`, `is_active`, `created_at`, `updated_at` |
| `schedule_exceptions` | `id`, `doctor_id`, `start_datetime`, `end_datetime`, `exception_type`, `reason`, `created_at` |

Exception types: `leave`, `blocked_period`, `unavailable_date`, `temporary_change`. Every
exception removes availability. A temporary change that adds hours is an
effective-dated schedule period.

## Business rules

- A doctor may have multiple specialties; a specialty may have multiple doctors.
- A doctor may have multiple weekly schedule periods, including several on one day.
  Active periods for the same doctor and weekday may not overlap in time while their
  effective dates overlap.
- Appointment duration is the schedule's `slot_duration_minutes` (15, 30, 45, or 60).
  Slots start on a grid from the period start; a partial last slot is not offered.
- Patients cannot book outside registered consultation hours.
- Schedule exceptions override weekly availability.
- Existing active (`requested`/`confirmed`) appointments are excluded from availability.
- All scheduling uses `Asia/Manila`.
- Schedule changes never modify existing appointments. Saving a schedule reports how many
  future active appointments now fall outside the doctor's hours; those are kept.

## Permissions (this ticket)

| Role | Permissions |
|---|---|
| Admin | Manage departments, specialties, doctors, and any doctor's schedule and exceptions |
| Doctor | View and edit own schedule periods and exceptions; view own appointments |
| Patient | View active doctors, specialties, and availability; book through the server |
| Front Desk | Deferred |
| AI Chatbot | Deferred; will call the read-only availability service |

## Acceptance criteria

- [ ] Departments can be created and managed.
- [ ] Specialties can be created and managed.
- [ ] Doctors can be assigned to departments.
- [ ] Doctors can have multiple specialties.
- [ ] Doctors can have independent weekly schedules.
- [ ] Different consultation hours can be configured per weekday.
- [ ] Fixed appointment durations are supported.
- [ ] Multiple consultation periods per day are supported.
- [ ] Schedule exceptions can block specific dates and periods.
- [ ] Available slots are calculated correctly.
- [ ] Existing appointments are excluded from availability.
- [ ] Overlapping bookings are prevented at database level.
- [ ] Patients can retrieve doctors by specialty.
- [ ] Patients can retrieve availability for a specific doctor.
- [ ] Unauthorized users cannot modify doctor schedules.

## Verification

Automated unit and component tests cover the domain logic, services, and authorization.
Under ADR-0003 the migration, booking function, grants, and concurrent booking are
verified only by the manual hosted smoke test in `db/README.md`.
