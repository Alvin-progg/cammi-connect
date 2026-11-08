// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDirectoryRepository } from "@/server/directory/repository";

vi.mock("server-only", () => ({}));
// Cache directives only work inside Next; here every call reads through.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000501";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000701";

// Rows as the database would return them if every column were selected. The
// directory read must still hand back no contact details.
const ROWS: Record<string, Record<string, unknown>[]> = {
  doctors: [
    {
      id: DOCTOR_ID,
      full_name: "Dr. Maya Santos",
      department_id: DEPARTMENT_ID,
      is_active: true,
      contact_email: "maya.santos@example.test",
      contact_phone: "0917 000 0000",
      bio: "Synthetic bio.",
    },
  ],
  doctor_specialties: [{ doctor_id: DOCTOR_ID, specialty_id: SPECIALTY_ID }],
  specialties: [{ id: SPECIALTY_ID, name: "Cardiology" }],
  departments: [{ id: DEPARTMENT_ID, name: "Cardiology" }],
};

const calls: { table: string; method: string; args: unknown[] }[] = [];

function queryBuilder(table: string) {
  const builder = {
    then(resolve: (value: { data: unknown; error: null }) => unknown) {
      return Promise.resolve({ data: ROWS[table], error: null }).then(resolve);
    },
  } as Record<string, unknown>;
  for (const method of ["select", "eq", "in", "not", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/server/db/admin-client", () => ({
  getSupabaseAdminClient: () => ({ from: (table: string) => queryBuilder(table) }),
}));

beforeEach(() => {
  calls.length = 0;
});

describe("supabaseDirectoryRepository.listDoctors (patient and Cami directory)", () => {
  it("filters to active doctors and never selects or returns contact details", async () => {
    const doctors = await supabaseDirectoryRepository.listDoctors({ activeOnly: true });

    expect(calls).toContainEqual({ table: "doctors", method: "eq", args: ["is_active", true] });
    const doctorSelect = calls.find((call) => call.table === "doctors" && call.method === "select");
    expect(String(doctorSelect?.args[0])).not.toMatch(/contact|bio|\*/);
    expect(doctors).toEqual([
      {
        id: DOCTOR_ID,
        fullName: "Dr. Maya Santos",
        departmentId: DEPARTMENT_ID,
        departmentName: "Cardiology",
        isActive: true,
        specialties: [{ id: SPECIALTY_ID, name: "Cardiology" }],
      },
    ]);
  });
});
