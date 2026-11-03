// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DOCTOR_REFUSAL_MESSAGES } from "@/lib/doctors/refusals";
import type { DoctorFormInput } from "@/lib/doctors/schemas";
import {
  linkDoctorAccount,
  saveDoctor,
  setDoctorActive,
  type DoctorAdminStore,
} from "@/server/doctors/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000011";
const PATIENT_ID = "00000000-0000-4000-8000-000000000021";

const INPUT: DoctorFormInput = {
  fullName: "Dr. Ana Cruz",
  departmentId: "00000000-0000-4000-8000-000000000501",
  specialtyIds: ["00000000-0000-4000-8000-000000000701", "00000000-0000-4000-8000-000000000702"],
  contactEmail: "ana.cruz@example.test",
  contactPhone: null,
  bio: null,
  accountProfileId: null,
};

const CONFLICT = {
  appointmentId: "00000000-0000-4000-8000-000000000201",
  scheduledAt: "2026-11-10T01:00:00Z",
  status: "confirmed" as const,
};

function fakeStore() {
  return {
    listDoctors: vi.fn().mockResolvedValue([]),
    getDoctor: vi.fn().mockResolvedValue(null),
    listLinkableAccounts: vi
      .fn()
      .mockResolvedValue([{ profileId: ACCOUNT_ID, fullName: "Dr. Invited Account" }]),
    listFutureConflicts: vi.fn().mockResolvedValue([]),
    listAppointmentHistory: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ ok: true, doctorId: DOCTOR_ID }),
    linkAccount: vi.fn().mockResolvedValue({ ok: true }),
    setActive: vi.fn().mockResolvedValue({ ok: true }),
  } satisfies DoctorAdminStore;
}

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
});

describe("saveDoctor", () => {
  it("creates a doctor without a login as the acting admin", async () => {
    await expect(
      saveDoctor({ actorId: ADMIN_ID, doctorId: null, input: INPUT }, store),
    ).resolves.toEqual({ ok: true, doctorId: DOCTOR_ID, message: "Doctor saved." });
    expect(store.save).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      doctorId: null,
      ...INPUT,
    });
  });

  it("creates a doctor on a linkable doctor account", async () => {
    await saveDoctor(
      { actorId: ADMIN_ID, doctorId: null, input: { ...INPUT, accountProfileId: ACCOUNT_ID } },
      store,
    );
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: null, accountProfileId: ACCOUNT_ID }),
    );
  });

  it("refuses to link an account that is not an unlinked doctor account, without writing", async () => {
    await expect(
      saveDoctor(
        { actorId: ADMIN_ID, doctorId: null, input: { ...INPUT, accountProfileId: PATIENT_ID } },
        store,
      ),
    ).resolves.toEqual({ ok: false, message: DOCTOR_REFUSAL_MESSAGES.not_linkable });
    expect(store.save).not.toHaveBeenCalled();
  });

  it("ignores an account on update: linking an existing doctor is a separate action", async () => {
    await saveDoctor(
      { actorId: ADMIN_ID, doctorId: DOCTOR_ID, input: { ...INPUT, accountProfileId: ACCOUNT_ID } },
      store,
    );
    expect(store.listLinkableAccounts).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: DOCTOR_ID, accountProfileId: null }),
    );
  });

  it("maps database refusals to their messages", async () => {
    for (const code of ["inactive_department", "inactive_specialty", "not_doctor_account"] as const) {
      store.save.mockResolvedValueOnce({ ok: false, code });
      await expect(
        saveDoctor({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, input: INPUT }, store),
      ).resolves.toEqual({ ok: false, message: DOCTOR_REFUSAL_MESSAGES[code] });
    }
  });

  it("hides unexpected failures behind a generic message", async () => {
    store.save.mockResolvedValue({ ok: false, code: undefined });
    await expect(
      saveDoctor({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, input: INPUT }, store),
    ).resolves.toEqual({ ok: false, message: "Something went wrong. Try again." });
  });
});

describe("linkDoctorAccount", () => {
  it("links a linkable doctor account as the acting admin", async () => {
    await expect(
      linkDoctorAccount({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, accountProfileId: ACCOUNT_ID }, store),
    ).resolves.toEqual({ ok: true, message: "Account linked." });
    expect(store.linkAccount).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      doctorId: DOCTOR_ID,
      accountProfileId: ACCOUNT_ID,
    });
  });

  it("rejects a non-doctor account without writing", async () => {
    await expect(
      linkDoctorAccount({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, accountProfileId: PATIENT_ID }, store),
    ).resolves.toEqual({ ok: false, message: DOCTOR_REFUSAL_MESSAGES.not_linkable });
    expect(store.linkAccount).not.toHaveBeenCalled();
  });

  it("explains why the database refused the link", async () => {
    for (const code of ["already_linked", "account_has_history", "not_linkable"] as const) {
      store.linkAccount.mockResolvedValueOnce({ ok: false, code });
      await expect(
        linkDoctorAccount(
          { actorId: ADMIN_ID, doctorId: DOCTOR_ID, accountProfileId: ACCOUNT_ID },
          store,
        ),
      ).resolves.toEqual({ ok: false, message: DOCTOR_REFUSAL_MESSAGES[code] });
    }
  });
});

describe("setDoctorActive", () => {
  it("refuses to deactivate while future appointments exist, listing them without writing", async () => {
    store.listFutureConflicts.mockResolvedValue([CONFLICT]);

    await expect(
      setDoctorActive({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, isActive: false }, store),
    ).resolves.toEqual({
      ok: false,
      message: DOCTOR_REFUSAL_MESSAGES.has_future_appointments,
      conflicts: [CONFLICT],
    });
    expect(store.setActive).not.toHaveBeenCalled();
  });

  it("deactivates when nothing is booked ahead", async () => {
    await expect(
      setDoctorActive({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, isActive: false }, store),
    ).resolves.toEqual({ ok: true, message: "Doctor deactivated." });
    expect(store.setActive).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      doctorId: DOCTOR_ID,
      isActive: false,
    });
  });

  it("activates without checking appointments", async () => {
    await expect(
      setDoctorActive({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, isActive: true }, store),
    ).resolves.toEqual({ ok: true, message: "Doctor activated." });
    expect(store.listFutureConflicts).not.toHaveBeenCalled();
  });

  it("lists the conflicts when a booking slipped in before the database check", async () => {
    store.listFutureConflicts.mockResolvedValueOnce([]).mockResolvedValueOnce([CONFLICT]);
    store.setActive.mockResolvedValue({ ok: false, code: "has_future_appointments" });

    await expect(
      setDoctorActive({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, isActive: false }, store),
    ).resolves.toEqual({
      ok: false,
      message: DOCTOR_REFUSAL_MESSAGES.has_future_appointments,
      conflicts: [CONFLICT],
    });
  });

  it("maps other database refusals to their messages", async () => {
    store.setActive.mockResolvedValue({ ok: false, code: "unchanged" });
    await expect(
      setDoctorActive({ actorId: ADMIN_ID, doctorId: DOCTOR_ID, isActive: true }, store),
    ).resolves.toEqual({ ok: false, message: DOCTOR_REFUSAL_MESSAGES.unchanged });
  });
});
