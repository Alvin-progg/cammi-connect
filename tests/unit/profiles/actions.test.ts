// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDoctorSession } from "@/server/auth/dal";
import { updateDoctorProfileAction } from "@/server/profiles/actions";
import { updateDoctorContact } from "@/server/profiles/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getDoctorSession: vi.fn() }));
vi.mock("@/server/profiles/service", () => ({ updateDoctorContact: vi.fn() }));

const IDLE = { status: "idle" } as const;
const DOCTOR_A = "00000000-0000-4000-8000-000000000101";
const DOCTOR_B = "00000000-0000-4000-8000-000000000102";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDoctorSession).mockResolvedValue({
    user: { id: "auth-doctor-a", email: "doctor.a@example.test" },
    doctor: { id: DOCTOR_A, fullName: "Dr. A" },
  });
});

describe("updateDoctorProfileAction", () => {
  it("only ever updates the signed-in doctor, whatever id the form carries", async () => {
    await expect(
      updateDoctorProfileAction(
        IDLE,
        formData({ doctorId: DOCTOR_B, id: DOCTOR_B, phone: "0917 000 0000", clinicNote: "" }),
      ),
    ).resolves.toEqual({ status: "success", message: "Profile updated." });

    expect(updateDoctorContact).toHaveBeenCalledTimes(1);
    expect(updateDoctorContact).toHaveBeenCalledWith(expect.objectContaining({ doctorId: DOCTOR_A }));
  });

  it("denies anyone without a doctor session", async () => {
    vi.mocked(getDoctorSession).mockResolvedValue(null);

    await expect(
      updateDoctorProfileAction(IDLE, formData({ phone: "0917 000 0000", clinicNote: "" })),
    ).resolves.toEqual({ status: "error", message: "You are not authorized to update this profile." });
    expect(updateDoctorContact).not.toHaveBeenCalled();
  });
});
