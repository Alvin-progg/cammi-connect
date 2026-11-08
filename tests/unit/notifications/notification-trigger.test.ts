import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from "@/lib/notifications/types";

const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf8");

describe("doctor notification migrations", () => {
  it("0028 only adds the confirmed enum value, so it can run on its own", () => {
    const sql = read("0028_doctor_notification_confirmed.sql");
    expect(sql).toMatch(/alter type public\.doctor_notification_type add value if not exists 'confirmed'/);
    expect(sql).not.toMatch(/create (or replace )?(function|trigger|table)/i);
  });

  it("0029 fires after every appointment insert and update", () => {
    const sql = read("0029_doctor_notification_trigger.sql");
    expect(sql).toMatch(
      /create trigger appointments_notify_doctor\s+after insert or update on public\.appointments\s+for each row execute function public\.cammi_connect_notify_doctor\(\)/,
    );
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).toMatch(/revoke all on function public\.cammi_connect_notify_doctor\(\)\s+from public, anon, authenticated/);
  });

  it("writes a notification for each appointment event", () => {
    const body = functionBodies(read("0029_doctor_notification_trigger.sql")).find(
      (fn) => fn.name === "cammi_connect_notify_doctor",
    )?.body;
    expect(body).toBeDefined();
    for (const type of ["new_request", "confirmed", "rescheduled", "cancelled"]) {
      expect(body).toContain(`'${type}'`);
    }
    expect(body).toContain("insert into public.doctor_notifications");
    // A doctor cancelling their own appointment is not notified about it.
    expect(body).toMatch(/cancelled_by_role[\s\S]*'doctor'/);
  });

  it("knows the confirmed type in TypeScript", () => {
    expect(NOTIFICATION_TYPES).toContain("confirmed");
    expect(NOTIFICATION_TYPE_LABELS.confirmed).toBe("Confirmed");
  });
});
