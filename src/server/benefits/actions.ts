"use server";

import { revalidatePath } from "next/cache";

import {
  accreditationSaveSchema,
  appointmentHmoUpdateSchema,
  benefitDecisionSchema,
  hmoSubmissionSchema,
  pwdSubmissionSchema,
} from "@/lib/benefits/schemas";
import { getAdminSession, getFrontDeskSession, getPatientSession } from "@/server/auth/dal";
import { sendNotificationEmailsAfterResponse } from "@/server/notifications/email-dispatch";

import { supabaseBenefitsWriteStore } from "./repository";
import { readOptionalImage } from "./registration";
import {
  decideBenefit,
  saveDoctorAccreditation,
  submitHmoMembership,
  submitPwdDeclaration,
  updateAppointmentHmo,
  viewBenefitDocument,
  type BenefitKind,
} from "./service";

/**
 * BEN-03 Server Actions. Each one resolves its session first and takes the
 * acting profile ID from that session, never from form input. Patient
 * actions write only the signed-in patient's own records.
 */

export type BenefitActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export type BenefitViewState = { status: "error"; message: string } | { status: "success"; url: string };

const PATIENT_PATH = "/account/benefits";
const FRONT_DESK_PATH = "/front-desk/benefits";
const ADMIN_DOCTORS_PATH = "/admin/doctors";
const MISSING_SESSION = "You are not authorized to do that.";

const error = (message: string): BenefitActionState => ({ status: "error", message });

export async function submitPwdAction(
  _previous: BenefitActionState,
  formData: FormData,
): Promise<BenefitActionState> {
  const session = await getPatientSession(PATIENT_PATH);
  if (!session) return error(MISSING_SESSION);

  const parsed = pwdSubmissionSchema.safeParse({ idNumber: formData.get("idNumber") });
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Check the PWD ID number.");

  const image = await readOptionalImage(formData.get("image"));
  if (!image) return error("Upload a photo of your PWD ID.");

  const result = await submitPwdDeclaration(
    { patientId: session.patient.id, idNumber: parsed.data.idNumber, image },
    supabaseBenefitsWriteStore,
  );
  if (!result.ok) return error(result.message);

  revalidatePath(PATIENT_PATH);
  return { status: "success", message: "PWD details sent. The front desk will check them." };
}

export async function submitHmoAction(
  _previous: BenefitActionState,
  formData: FormData,
): Promise<BenefitActionState> {
  const session = await getPatientSession(PATIENT_PATH);
  if (!session) return error(MISSING_SESSION);

  const parsed = hmoSubmissionSchema.safeParse({
    providerId: formData.get("providerId"),
    membershipNumber: formData.get("membershipNumber"),
  });
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Check the HMO details.");

  const card = await readOptionalImage(formData.get("card"));
  const result = await submitHmoMembership(
    {
      patientId: session.patient.id,
      providerId: parsed.data.providerId,
      membershipNumber: parsed.data.membershipNumber,
      card,
    },
    supabaseBenefitsWriteStore,
  );
  if (!result.ok) return error(result.message);

  revalidatePath(PATIENT_PATH);
  return { status: "success", message: "HMO membership sent. The front desk will check it." };
}

/** Front desk verify or reject for a PWD declaration or an HMO membership. */
export async function decideBenefitAction(
  _previous: BenefitActionState,
  formData: FormData,
): Promise<BenefitActionState> {
  const session = await getFrontDeskSession(FRONT_DESK_PATH);
  if (!session) return error(MISSING_SESSION);

  const kind = formData.get("kind");
  if (kind !== "pwd" && kind !== "hmo") return error("Invalid record type.");
  const recordId = formData.get("recordId");
  if (typeof recordId !== "string" || recordId === "") return error("Invalid record reference.");

  const parsed = benefitDecisionSchema.safeParse({
    decision: formData.get("decision"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Check the decision.");

  const result = await decideBenefit(
    { kind, recordId, staffId: session.staff.id, ...parsed.data },
    supabaseBenefitsWriteStore,
  );
  if (!result.ok) return error(result.message);

  revalidatePath(FRONT_DESK_PATH);
  revalidatePath(PATIENT_PATH);
  sendNotificationEmailsAfterResponse();
  return {
    status: "success",
    message: result.status === "verified" ? "Verified." : "Rejected. The patient can resubmit.",
  };
}

/** Audited, short-lived link to a benefit document. */
export async function viewBenefitDocumentAction(kind: BenefitKind, recordId: string): Promise<BenefitViewState> {
  const session = await getFrontDeskSession(FRONT_DESK_PATH);
  if (!session) return { status: "error", message: MISSING_SESSION };
  if (kind !== "pwd" && kind !== "hmo") return { status: "error", message: "Invalid record type." };

  const result = await viewBenefitDocument({ kind, recordId, staffId: session.staff.id }, supabaseBenefitsWriteStore);
  return result.ok ? { status: "success", url: result.url } : { status: "error", message: result.message };
}

export async function saveAccreditationAction(
  _previous: BenefitActionState,
  formData: FormData,
): Promise<BenefitActionState> {
  const session = await getAdminSession(ADMIN_DOCTORS_PATH);
  if (!session) return error(MISSING_SESSION);

  const parsed = accreditationSaveSchema.safeParse({
    doctorId: formData.get("doctorId"),
    providerId: formData.get("providerId"),
    status: formData.get("status"),
    validFrom: formData.get("validFrom"),
    validUntil: formData.get("validUntil") ?? "",
  });
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Check the accreditation.");

  const result = await saveDoctorAccreditation(
    { actorId: session.admin.id, ...parsed.data },
    supabaseBenefitsWriteStore,
  );
  if (!result.ok) return error(result.message);

  revalidatePath(ADMIN_DOCTORS_PATH, "layout");
  return { status: "success", message: "Accreditation saved." };
}

/** Front desk: authorization and coverage for one appointment, set independently. */
export async function updateAppointmentHmoAction(
  _previous: BenefitActionState,
  formData: FormData,
): Promise<BenefitActionState> {
  const appointmentId = formData.get("appointmentId");
  const session = await getFrontDeskSession(FRONT_DESK_PATH);
  if (!session) return error(MISSING_SESSION);
  if (typeof appointmentId !== "string" || appointmentId === "") return error("Invalid appointment reference.");

  const parsed = appointmentHmoUpdateSchema.safeParse({
    authorization: formData.get("authorization"),
    coverage: formData.get("coverage"),
    loaNumber: formData.get("loaNumber") ?? undefined,
    remarks: formData.get("remarks") ?? undefined,
  });
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Check the HMO details.");

  const result = await updateAppointmentHmo(
    { appointmentId, staffId: session.staff.id, ...parsed.data, authorization: parsed.data.authorization, coverage: parsed.data.coverage },
    supabaseBenefitsWriteStore,
  );
  if (!result.ok) return error(result.message);

  revalidatePath("/front-desk/requests", "layout");
  return { status: "success", message: "HMO authorization saved." };
}
