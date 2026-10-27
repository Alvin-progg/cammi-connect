#!/usr/bin/env node
/**
 * Synthetic seed data for the doctor dashboard suite.
 *
 * Run with: npm run db:seed
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SEED_DOCTOR_EMAIL, and optionally SEED_DOCTOR_PASSWORD / SEED_DOCTOR_NAME.
 *
 * The script is idempotent for the seed profiles, the doctor account link,
 * schedules, blocks, notifications, and the listed appointments. Re-running
 * it resets those rows to the values below. It never deletes rows.
 */
import { createClient } from "@supabase/supabase-js";

const MANILA_TIME_ZONE = "Asia/Manila";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SEED_PATIENT_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];

const SECOND_DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const COLLEAGUE_DOCTOR_ID = "00000000-0000-4000-8000-000000000102";

const DEPARTMENT_INTERNAL_MEDICINE_ID =
  "00000000-0000-4000-8000-000000000501";
const DEPARTMENT_PEDIATRICS_ID = "00000000-0000-4000-8000-000000000502";

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local and rerun the seed.`);
  }
  return value;
}

function dateInManila(date) {
  return DATE_FORMATTER.format(date);
}

function addManilaDays(date, days) {
  const base = new Date(`${date}T00:00:00+08:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return dateInManila(base);
}

function at(date, time) {
  return `${date}T${time}:00+08:00`;
}

async function findAuthUserByEmail(supabase, email) {
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  throw new Error(
    "Unable to find the seed doctor after scanning auth users. Create the user or reduce the auth user count.",
  );
}

async function ensureDoctorAuthUser(supabase, email, password, fullName) {
  const existing = await findAuthUserByEmail(supabase, email);
  if (existing) {
    if (!existing.email_confirmed_at) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
      });
      if (error) {
        throw new Error(
          `Unable to confirm the seed doctor auth user: ${error.message}`,
        );
      }
    }
    return existing;
  }

  if (!password) {
    throw new Error(
      `No Supabase Auth user exists for ${email}. Create it in Supabase Auth, or set SEED_DOCTOR_PASSWORD in .env.local so the seed can create it.`,
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    throw new Error(`Unable to create the seed doctor auth user: ${error?.message}`);
  }

  return data.user;
}

async function upsertDoctorProfile(supabase, authUserId, fullName) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        auth_user_id: authUserId,
        role: "doctor",
        full_name: fullName,
        department_id: DEPARTMENT_INTERNAL_MEDICINE_ID,
        specialty: "Internal Medicine",
        phone: "+63 43 555 0100",
        clinic_note: "Room 204, Outpatient Department",
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Unable to upsert the seed doctor profile: ${error?.message}`);
  }

  return data.id;
}

async function main() {
  const supabaseUrl = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const doctorEmail = requireEnv(
    "SEED_DOCTOR_EMAIL",
    process.env.SEED_DOCTOR_EMAIL?.trim().toLowerCase(),
  );
  const doctorName =
    process.env.SEED_DOCTOR_NAME?.trim() || "Dr. Maya Santos";
  const doctorPassword = process.env.SEED_DOCTOR_PASSWORD;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { error: departmentError } = await supabase.from("departments").upsert(
    [
      {
        id: DEPARTMENT_INTERNAL_MEDICINE_ID,
        name: "Internal Medicine",
        code: "IM",
      },
      { id: DEPARTMENT_PEDIATRICS_ID, name: "Pediatrics", code: "PED" },
    ],
    { onConflict: "id" },
  );
  if (departmentError) {
    throw new Error(`Unable to upsert departments: ${departmentError.message}`);
  }

  const doctorUser = await ensureDoctorAuthUser(
    supabase,
    doctorEmail,
    doctorPassword,
    doctorName,
  );
  const doctorProfileId = await upsertDoctorProfile(
    supabase,
    doctorUser.id,
    doctorName,
  );

  const syntheticProfiles = [
    ...SEED_PATIENT_IDS.map((id, index) => ({
      id,
      auth_user_id: null,
      role: "patient",
      full_name: `Synthetic Patient ${String.fromCharCode(65 + index)}`,
    })),
    {
      id: SECOND_DOCTOR_ID,
      auth_user_id: null,
      role: "doctor",
      full_name: "Dr. Paolo Reyes",
      department_id: DEPARTMENT_PEDIATRICS_ID,
      specialty: "Pediatrics",
    },
    {
      id: COLLEAGUE_DOCTOR_ID,
      auth_user_id: null,
      role: "doctor",
      full_name: "Dr. Liza Mercado",
      department_id: DEPARTMENT_INTERNAL_MEDICINE_ID,
      specialty: "Internal Medicine",
    },
  ];

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(syntheticProfiles, { onConflict: "id" });
  if (profileError) {
    throw new Error(`Unable to upsert synthetic profiles: ${profileError.message}`);
  }

  const today = dateInManila(new Date());
  const tomorrow = addManilaDays(today, 1);
  const [patientA, patientB, patientC, patientD] = SEED_PATIENT_IDS;

  const appointments = [
    {
      id: "00000000-0000-4000-8000-000000000201",
      doctor_id: doctorProfileId,
      patient_id: patientA,
      scheduled_at: at(today, "09:00"),
      duration_minutes: 30,
      status: "confirmed",
      reason: "Routine consultation",
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      doctor_id: doctorProfileId,
      patient_id: patientB,
      scheduled_at: at(today, "10:30"),
      duration_minutes: 30,
      status: "requested",
      reason: "Follow-up check-up",
    },
    {
      id: "00000000-0000-4000-8000-000000000203",
      doctor_id: doctorProfileId,
      patient_id: patientC,
      scheduled_at: at(today, "14:00"),
      duration_minutes: 30,
      status: "completed",
      reason: "Blood pressure review",
    },
    {
      id: "00000000-0000-4000-8000-000000000204",
      doctor_id: doctorProfileId,
      patient_id: patientD,
      scheduled_at: at(today, "15:30"),
      duration_minutes: 30,
      status: "cancelled",
      reason: "New patient consultation",
      cancellation_reason: "Patient asked to move to next week",
      cancelled_by_role: "doctor",
    },
    {
      id: "00000000-0000-4000-8000-000000000205",
      doctor_id: doctorProfileId,
      patient_id: patientC,
      scheduled_at: at(today, "16:30"),
      duration_minutes: 30,
      status: "confirmed",
      reason: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000206",
      doctor_id: doctorProfileId,
      patient_id: patientA,
      scheduled_at: at(tomorrow, "09:00"),
      duration_minutes: 30,
      status: "confirmed",
      reason: "Follow-up check-up",
    },
    {
      id: "00000000-0000-4000-8000-000000000207",
      doctor_id: doctorProfileId,
      patient_id: patientB,
      scheduled_at: at(tomorrow, "11:00"),
      duration_minutes: 30,
      status: "requested",
      reason: "Lab result review",
    },
    {
      id: "00000000-0000-4000-8000-000000000208",
      doctor_id: SECOND_DOCTOR_ID,
      patient_id: patientD,
      scheduled_at: at(today, "09:00"),
      duration_minutes: 30,
      status: "confirmed",
      reason: "Routine consultation",
    },
    {
      id: "00000000-0000-4000-8000-000000000209",
      doctor_id: SECOND_DOCTOR_ID,
      patient_id: patientA,
      scheduled_at: at(today, "13:00"),
      duration_minutes: 30,
      status: "requested",
      reason: "Follow-up check-up",
    },
    {
      id: "00000000-0000-4000-8000-000000000210",
      doctor_id: SECOND_DOCTOR_ID,
      patient_id: patientC,
      scheduled_at: at(tomorrow, "10:00"),
      duration_minutes: 30,
      status: "confirmed",
      reason: "Routine consultation",
    },
    {
      id: "00000000-0000-4000-8000-000000000211",
      doctor_id: SECOND_DOCTOR_ID,
      patient_id: patientB,
      scheduled_at: at(tomorrow, "15:00"),
      duration_minutes: 30,
      status: "cancelled",
      reason: "New patient consultation",
    },
    // Past appointments for history and statistics.
    {
      id: "00000000-0000-4000-8000-000000000301",
      doctor_id: doctorProfileId,
      patient_id: patientA,
      scheduled_at: at(addManilaDays(today, -2), "09:30"),
      duration_minutes: 30,
      status: "completed",
      reason: "Routine consultation",
    },
    {
      id: "00000000-0000-4000-8000-000000000302",
      doctor_id: doctorProfileId,
      patient_id: patientB,
      scheduled_at: at(addManilaDays(today, -2), "11:00"),
      duration_minutes: 30,
      status: "completed",
      reason: "Diabetes follow-up",
    },
    {
      id: "00000000-0000-4000-8000-000000000303",
      doctor_id: doctorProfileId,
      patient_id: patientC,
      scheduled_at: at(addManilaDays(today, -4), "10:00"),
      duration_minutes: 30,
      status: "no_show",
      reason: "Blood pressure review",
    },
    {
      id: "00000000-0000-4000-8000-000000000304",
      doctor_id: doctorProfileId,
      patient_id: patientD,
      scheduled_at: at(addManilaDays(today, -4), "13:30"),
      duration_minutes: 30,
      status: "completed",
      reason: "New patient consultation",
    },
    {
      id: "00000000-0000-4000-8000-000000000305",
      doctor_id: doctorProfileId,
      patient_id: patientA,
      scheduled_at: at(addManilaDays(today, -7), "15:00"),
      duration_minutes: 30,
      status: "cancelled",
      reason: "Routine consultation",
      cancellation_reason: "Doctor on emergency leave",
      cancelled_by_role: "doctor",
    },
    {
      id: "00000000-0000-4000-8000-000000000306",
      doctor_id: doctorProfileId,
      patient_id: patientB,
      scheduled_at: at(addManilaDays(today, -9), "09:00"),
      duration_minutes: 30,
      status: "completed",
      reason: "Lab result review",
    },
    // Upcoming appointments beyond tomorrow.
    {
      id: "00000000-0000-4000-8000-000000000307",
      doctor_id: doctorProfileId,
      patient_id: patientC,
      scheduled_at: at(addManilaDays(today, 2), "10:00"),
      duration_minutes: 30,
      status: "confirmed",
      reason: "Routine consultation",
    },
    {
      id: "00000000-0000-4000-8000-000000000308",
      doctor_id: doctorProfileId,
      patient_id: patientD,
      scheduled_at: at(addManilaDays(today, 3), "09:30"),
      duration_minutes: 30,
      status: "requested",
      reason: "Follow-up check-up",
    },
    {
      id: "00000000-0000-4000-8000-000000000309",
      doctor_id: doctorProfileId,
      patient_id: patientA,
      scheduled_at: at(addManilaDays(today, 5), "14:00"),
      duration_minutes: 30,
      status: "requested",
      reason: "Annual physical exam",
    },
  ];

  const { error: appointmentError } = await supabase
    .from("appointments")
    .upsert(appointments, { onConflict: "id" });
  if (appointmentError) {
    throw new Error(`Unable to upsert appointments: ${appointmentError.message}`);
  }

  // Regular consultation hours: main doctor Mon–Fri 09:00–17:00 (30 min
  // slots); Dr. Reyes Mon/Wed/Fri mornings. day_of_week is Sunday-first.
  const schedules = [
    ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({
      doctor_id: doctorProfileId,
      day_of_week: dayOfWeek,
      start_time: "09:00",
      end_time: "17:00",
      slot_duration_minutes: 30,
      is_active: true,
    })),
    ...[1, 3, 5].map((dayOfWeek) => ({
      doctor_id: SECOND_DOCTOR_ID,
      day_of_week: dayOfWeek,
      start_time: "08:00",
      end_time: "12:00",
      slot_duration_minutes: 30,
      is_active: true,
    })),
  ];

  const { error: scheduleError } = await supabase
    .from("doctor_schedules")
    .upsert(schedules, { onConflict: "doctor_id,day_of_week" });
  if (scheduleError) {
    throw new Error(`Unable to upsert schedules: ${scheduleError.message}`);
  }

  const blockedSlots = [
    {
      id: "00000000-0000-4000-8000-000000000401",
      doctor_id: doctorProfileId,
      starts_at: at(tomorrow, "13:00"),
      ends_at: at(tomorrow, "17:00"),
      reason: "Hospital committee meeting",
    },
  ];

  const { error: blockError } = await supabase
    .from("doctor_blocked_slots")
    .upsert(blockedSlots, { onConflict: "id" });
  if (blockError) {
    throw new Error(`Unable to upsert blocked slots: ${blockError.message}`);
  }

  const notifications = [
    {
      id: "00000000-0000-4000-8000-000000000601",
      doctor_id: doctorProfileId,
      appointment_id: "00000000-0000-4000-8000-000000000207",
      type: "new_request",
      title: "New appointment request",
      body: "Synthetic Patient B requested a consultation for tomorrow, 11:00 AM (Lab result review).",
      read_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000602",
      doctor_id: doctorProfileId,
      appointment_id: "00000000-0000-4000-8000-000000000204",
      type: "cancelled",
      title: "Appointment cancelled",
      body: "The 3:30 PM consultation with Synthetic Patient D was cancelled.",
      read_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000603",
      doctor_id: doctorProfileId,
      appointment_id: "00000000-0000-4000-8000-000000000206",
      type: "rescheduled",
      title: "Appointment rescheduled",
      body: "Synthetic Patient A's follow-up was moved to tomorrow, 9:00 AM.",
      read_at: null,
    },
  ];

  const { error: notificationError } = await supabase
    .from("doctor_notifications")
    .upsert(notifications, { onConflict: "id" });
  if (notificationError) {
    throw new Error(
      `Unable to upsert notifications: ${notificationError.message}`,
    );
  }

  const todayCount = appointments.filter((appointment) =>
    appointment.scheduled_at.startsWith(today),
  ).length;

  console.log("Seed complete.");
  console.log(`Doctor login: ${doctorEmail}`);
  console.log(`Doctor profile: ${doctorProfileId}`);
  console.log(`Synthetic profiles: ${syntheticProfiles.length}`);
  console.log(
    `Appointments: ${appointments.length} (${todayCount} today, ${appointments.length - todayCount} other days)`,
  );
  console.log(
    `Schedules: ${schedules.length} · Blocked slots: ${blockedSlots.length} · Notifications: ${notifications.length}`,
  );
  console.log(
    `Manila dates: ${today} and ${tomorrow}. Re-running the seed resets these synthetic rows.`,
  );
}

main().catch((error) => {
  console.error(
    `Seed failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exitCode = 1;
});
