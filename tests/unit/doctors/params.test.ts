import { describe, expect, it } from "vitest";

import { parseDoctorStatusFilter, parseDoctorTab } from "@/lib/doctors/params";

describe("parseDoctorStatusFilter", () => {
  it("accepts active and inactive, and falls back to all", () => {
    expect(parseDoctorStatusFilter("active")).toBe("active");
    expect(parseDoctorStatusFilter("inactive")).toBe("inactive");
    expect(parseDoctorStatusFilter(undefined)).toBe("all");
    expect(parseDoctorStatusFilter("deleted")).toBe("all");
    expect(parseDoctorStatusFilter(["inactive", "active"])).toBe("inactive");
  });
});

describe("parseDoctorTab", () => {
  it("accepts the three tabs and falls back to the profile", () => {
    expect(parseDoctorTab("schedule")).toBe("schedule");
    expect(parseDoctorTab("appointments")).toBe("appointments");
    expect(parseDoctorTab(undefined)).toBe("profile");
    expect(parseDoctorTab("billing")).toBe("profile");
  });
});
