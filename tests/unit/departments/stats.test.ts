import { describe, expect, it } from "vitest";

import { countsByStatus, totalsByDepartment } from "@/lib/departments/stats";

const CARDIOLOGY = "00000000-0000-4000-8000-000000000501";
const PEDIATRICS = "00000000-0000-4000-8000-000000000502";

const ROWS = [
  { departmentId: CARDIOLOGY, status: "confirmed" as const, count: 3 },
  { departmentId: CARDIOLOGY, status: "completed" as const, count: 5 },
  { departmentId: PEDIATRICS, status: "cancelled" as const, count: 2 },
];

describe("totalsByDepartment", () => {
  it("adds up every status per department", () => {
    const totals = totalsByDepartment(ROWS);
    expect(totals.get(CARDIOLOGY)).toBe(8);
    expect(totals.get(PEDIATRICS)).toBe(2);
    expect(totals.get("missing")).toBeUndefined();
  });
});

describe("countsByStatus", () => {
  it("returns one department's counts by status", () => {
    expect(countsByStatus(ROWS, CARDIOLOGY)).toEqual({ confirmed: 3, completed: 5 });
    expect(countsByStatus(ROWS, "missing")).toEqual({});
  });
});
