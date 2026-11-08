# FRONT DESK STAFF MODULE
**Project:** CamiConnect  
**Module:** Front Desk Appointment Management  
**Role:** Front Desk Staff  
**Status:** Proposed Specification

## 1. Overview

The Front Desk Staff Module is responsible for handling appointment requests submitted through Cami AI and managing patient appointments.

Front desk staff serve as the human verification and confirmation layer between the AI chatbot and the hospital's actual appointment system.

Cami AI assists patients in submitting appointment requests, but it cannot independently confirm appointments.

Front desk staff are responsible for reviewing requests, verifying the provided information, checking schedule availability, and confirming or rejecting appointment requests.

The module must also support staff-assisted appointment creation for walk-in and phone-in patients.

## 2. Objectives

- Provide a centralized appointment request management interface.
- Allow staff to review appointment requests submitted through Cami AI.
- Allow staff to verify patient and appointment information.
- Give staff authority to confirm or reject appointment requests.
- Prevent conflicting and duplicate appointments.
- Allow staff to create appointments on behalf of patients.
- Maintain appointment status and transaction history.
- Provide a clear overview of daily appointment activities.

## 3. User Role and Permissions

### Front Desk Staff

Front desk staff are authorized to:

- View incoming appointment requests.
- View patient information necessary for appointment processing.
- Review requested doctors, specialties, dates, and times.
- Check current doctor availability.
- Confirm appointment requests.
- Reject appointment requests with a reason.
- Reschedule appointments when authorized.
- Cancel appointments when authorized.
- Create appointments for walk-in and phone-in patients.
- Update appointment attendance status.
- View daily appointment schedules.
- Search and retrieve patient appointment records.

Front desk staff must not be allowed to:

- Create or manage administrator accounts.
- Create or delete doctor accounts.
- Modify doctor specialties.
- Modify recurring doctor schedules.
- Access unrestricted administrative analytics.
- Access patient information unrelated to their assigned responsibilities.

All permissions must be enforced server-side and through Supabase Row Level Security (RLS).

## 4. Dashboard Overview

The front desk dashboard should provide an overview of current appointment activities.

### Dashboard Summary Cards

Amended 2026-11-08 (owner decision, UI redesign):

1. **Pending Confirmation** — Appointment requests waiting for staff review, with how many have waited 24 hours or more.
2. **Today's Appointments** — Appointments scheduled for the current Manila day, with how many are confirmed and pending.
3. **Checked In** — Patients checked in today, with the next confirmed appointment time.
4. **Completed Today** — Appointments marked as completed today, with the day's no-shows.

### Dashboard Sections

- Pending appointment requests, oldest first, with how long each has waited.
- Today's appointment schedule.
- Recent activity: recently confirmed, rejected, and cancelled appointments in one feed, newest first.
- Quick appointment search through the ⌘K "Find patient" search in the sidebar.

The dashboard should prioritize pending requests because these require staff attention.

## 5. Appointment Request Management

### Request Queue

Display all appointment requests submitted through Cami AI.

Each request should display:

- Request ID
- Patient name
- Patient contact information
- Requested service or specialty
- Requested doctor, if applicable
- Requested appointment date
- Requested appointment time
- Request submission date
- Current request status

Staff should be able to filter requests by:

- Pending
- Confirmed
- Rejected
- Cancelled
- Date
- Doctor
- Specialty

### Request Details

When staff open a request, display:

- Patient information
- Appointment details
- Requested doctor or specialty
- Patient-provided information
- Relevant appointment requirements
- Request creation timestamp
- Previous status changes
- AI conversation context relevant to the appointment, subject to privacy and access controls

Staff must have enough information to evaluate the request without needing to repeat the entire conversation with the patient.

## 6. Appointment Confirmation Workflow

This is the primary responsibility of the front desk module.

### Confirmation Process

1. Patient communicates with Cami AI.
2. Cami identifies the requested service, specialty, or doctor.
3. Cami collects the required appointment information.
4. Cami retrieves available appointment options.
5. Patient selects a preferred schedule.
6. Cami displays a summary and asks the patient to submit the request.
7. Patient submits the appointment request.
8. The system creates an appointment with `pending_confirmation` status.
9. The request appears in the front desk staff queue.
10. Staff review the patient and appointment details.
11. Staff verify that the requested schedule remains available.
12. Staff confirm or reject the appointment request.
13. The system updates the appointment status.
14. The patient can view the updated appointment status through CamiConnect.

### Confirm Appointment

When staff confirm a request:

- Validate the request is still pending.
- Recheck doctor and schedule availability.
- Verify required appointment information.
- Confirm the appointment through a controlled backend operation.
- Update the appointment status to `confirmed`.
- Record the staff member responsible for confirmation.
- Record the confirmation timestamp.
- Make the confirmed appointment visible to the patient.

A successful confirmation must only be displayed after the database transaction succeeds.

### Reject Appointment

Staff must provide a rejection reason.

Possible reasons include:

- Requested schedule is no longer available.
- Incomplete appointment information.
- Invalid or unsupported appointment request.
- Doctor unavailable.
- Other hospital-approved reasons.

After rejection:

- Update the appointment status to `rejected`.
- Record the rejection reason.
- Record the responsible staff member.
- Make the updated status visible to the patient.

The system must not silently delete rejected requests.

## 7. Staff-Assisted Appointment Creation

The module must support patients who do not use CamiConnect.

Staff should be able to create appointments for:

- Walk-in patients.
- Patients contacting the hospital by phone.
- Patients requesting assistance directly from hospital personnel.

### Required Information

- Patient identification or patient account reference.
- Patient name and contact information when required.
- Requested hospital service or specialty.
- Preferred doctor, if applicable.
- Appointment date.
- Appointment time.
- Other hospital-required information.

### Booking Process

1. Staff search for an existing patient.
2. If no patient record exists, staff register the patient according to hospital policy.
3. Staff select the requested service or specialty.
4. Staff select a doctor when applicable.
5. Staff retrieve available appointment slots.
6. Staff select the requested schedule.
7. Staff review the appointment details.
8. Staff submit the appointment.

Staff-created appointments must be recorded with the appropriate booking source and staff identity.

The system must preserve the distinction between the patient who owns the appointment and the staff member who created it.

## 8. Daily Appointment Management

Provide a daily appointment schedule view.

Display:

- Appointment time.
- Patient name.
- Doctor.
- Specialty or service.
- Appointment status.
- Booking source.

Staff should be able to:

- View appointments by date.
- Filter appointments by doctor.
- Filter appointments by status.
- Search for patients.
- Open appointment details.
- Update attendance status when authorized.

### Attendance Status

Staff can update confirmed appointments to:

- `checked_in`
- `completed`
- `no_show`

The system must record the staff member and timestamp associated with these changes.

## 9. Appointment Rescheduling and Cancellation

Staff must be able to process authorized appointment changes.

### Rescheduling

1. Open the existing appointment.
2. Retrieve available alternative schedules.
3. Select a new date and time.
4. Review the changes.
5. Confirm the rescheduling operation.
6. Update the appointment schedule.
7. Record the staff member responsible.
8. Make the updated appointment information available to the patient.

### Cancellation

1. Open the appointment.
2. Select the cancellation action.
3. Provide a cancellation reason.
4. Confirm the cancellation.
5. Update the appointment status.
6. Record the responsible staff member and timestamp.

All changes must be recorded in the appointment audit history.

## 10. Database Requirements

The module should use the existing Supabase appointment, patient, doctor, specialty, and schedule tables.

The appointment table must support:

- `id`
- `patient_id`
- `doctor_id` (nullable when appropriate)
- `specialty_id` (nullable when appropriate)
- `scheduled_start`
- `scheduled_end`
- `status`
- `booking_source`
- `created_by`
- `confirmed_by`
- `confirmed_at`
- `rejection_reason`
- `cancellation_reason`
- `created_at`
- `updated_at`

### Booking Source

Supported values:

- `ai_chatbot`
- `front_desk`
- `other`

### Appointment Audit History

Create an `appointment_audit_logs` table.

Suggested fields:

- `id`
- `appointment_id`
- `actor_user_id`
- `action`
- `previous_status`
- `new_status`
- `previous_values` (JSONB)
- `new_values` (JSONB)
- `reason`
- `created_at`

Audit logs must be append-only for ordinary staff operations.

## 11. Appointment Status Lifecycle

Supported appointment statuses:

- `pending_confirmation`
- `confirmed`
- `rejected`
- `cancelled`
- `checked_in`
- `completed`
- `no_show`

Expected transitions:

- `pending_confirmation` → `confirmed`
- `pending_confirmation` → `rejected`
- `pending_confirmation` → `cancelled`
- `confirmed` → `checked_in`
- `confirmed` → `cancelled`
- `confirmed` → `no_show`
- `confirmed` → `rescheduled` (if implemented as a separate status; otherwise update the schedule and retain the appropriate appointment status)
- `checked_in` → `completed`

All transitions must be validated by the backend.

## 12. Notification Integration

When an appointment is:

- Submitted: notify the patient that the request is pending confirmation.
- Confirmed: notify the patient that the appointment has been confirmed.
- Rejected: notify the patient and provide the rejection reason.
- Rescheduled: notify the patient of the new schedule.
- Cancelled: notify the patient of the cancellation.

Notification delivery may use the application's supported notification channels.

The appointment status in the database remains the source of truth, not notification delivery.

## 13. Technical Requirements

- Next.js + TypeScript.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Row Level Security.
- Server-side appointment validation.
- Atomic appointment confirmation.
- Database-level double-booking prevention.
- Server-side role authorization.
- Append-only appointment audit history.

The AI chatbot must not be allowed to bypass the front desk confirmation process.

## 14. Acceptance Criteria

- [ ] Front desk staff can securely log in.
- [ ] Front desk staff can access their dedicated dashboard.
- [ ] Pending appointment requests appear in a centralized queue.
- [ ] Staff can view complete appointment request details.
- [ ] Staff can verify doctor and schedule availability.
- [ ] Staff can confirm appointment requests.
- [ ] Staff can reject requests with a reason.
- [ ] Confirmed appointments are saved with the correct status.
- [ ] Rejected requests retain their history.
- [ ] Patients can view their updated appointment status.
- [ ] Staff can create appointments for walk-in patients.
- [ ] Staff can create appointments for phone-in patients.
- [ ] Staff can view daily appointment schedules.
- [ ] Staff can update attendance status.
- [ ] Staff can process authorized cancellations and rescheduling.
- [ ] Every important appointment action is recorded in audit logs.
- [ ] Concurrent confirmation attempts cannot double-book a doctor.
- [ ] Staff cannot access administrative functions outside their permissions.
- [ ] The AI cannot independently confirm appointments.

## 15. Definition of Done

The module is complete when front desk staff can manage the complete appointment request lifecycle, from reviewing AI-submitted requests to confirming, rejecting, and managing appointments.

All appointment confirmations must be performed by an authorized front desk staff member or another explicitly authorized hospital role.

    

PR 1 — feat(db): appointment lifecycle schema + audit log

Migration: add the missing appointment columns, plus appointment_status and booking_source enums.
appointment_audit_logs table, append-only: RLS allows INSERT only, with no UPDATE or DELETE policies, and an audit trigger.
Double-booking guard: a btree_gist exclusion constraint on (doctor_id, tstzrange(scheduled_start, scheduled_end)) for blocking statuses.
DB trigger: inserts with booking_source = 'ai_chatbot' must have status pending_confirmation. This is what stops the AI from bypassing staff confirmation.
A pure TypeScript canTransition(from, to) function with full unit tests for the §11 transitions.
Tests: transition matrix, overlap rejection, audit rows can’t be updated or deleted, AI insert with confirmed fails.

PR 2 — feat(front-desk): auth, role guard, layout

Add the front_desk role, middleware and a server-side requireRole() helper.
RLS policies for front desk read/write scope.
Empty /front-desk shell with sidebar, top bar and breadcrumb (your blue and white board layout).
Tests: front desk can reach /front-desk; it gets 403 on admin routes and admin APIs; a patient can’t reach /front-desk.

PR 3 — feat(front-desk): request queue + details

Queue page with filters for status, date, doctor and specialty.
Details page showing patient info, request info, status history from audit logs, and the AI conversation excerpt (only the appointment-related portion).
Read-only: no actions yet.
Tests: filters, the details payload, and RLS hiding unrelated patient data.

PR 4 — feat(front-desk): confirm / reject (the core PR)

Postgres RPC functions confirm_appointment and reject_appointment. Each runs as one transaction: SELECT … FOR UPDATE, check the transition is allowed, re-check availability, update, write the audit row.
API routes plus confirm and reject dialogs. Reject requires a reason.
The UI shows success only after the RPC returns.
Tests: two simultaneous confirms for the same slot (exactly one succeeds), confirming a non-pending request fails, reject without a reason fails, rejected rows are kept.

PR 5 — feat(front-desk): daily schedule + attendance

Day view filtered by doctor and status, with a booking-source badge.
Attendance actions: checked_in, completed and no_show, each audited.
Tests: valid and invalid attendance transitions; actor and timestamp are recorded.

PR 6 — feat(front-desk): reschedule + cancel

Fetch available slots, then a reschedule_appointment RPC that is atomic and re-checks the overlap guard.
cancel_appointment RPC with a required reason.
Tests: rescheduling into a taken slot fails, previous_values/new_values are stored in the audit log, cancelling a completed appointment fails.

PR 7 — feat(front-desk): staff-assisted booking

Patient search, then register a new patient if none is found, then pick specialty, doctor and slot, review, and submit.
Stored with booking_source = 'front_desk', created_by = staff, and patient_id = patient.
Tests: the owner and creator stay distinct, an overlapping slot is rejected, the audit row is written.

PR 8 — feat(front-desk): dashboard overview

Four summary cards, pending requests first, today’s schedule, recent confirmed, recent rejected/cancelled, and quick search. (Amended 2026-11-08: the cards and a merged recent-activity feed follow §4; quick search moved to the ⌘K palette.)
This comes late because it only aggregates data the earlier PRs already create.
Tests: the “today” counts use the Asia/Manila day boundary, not UTC.

PR 9 — feat(patient): appointment status + notifications

Patient “My Appointments” view showing status and rejection or cancellation reasons.
Notification hooks on submit, confirm, reject, reschedule and cancel, delivered in-app first.
Tests: the database status stays correct even if a notification fails.