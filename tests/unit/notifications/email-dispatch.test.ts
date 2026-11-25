import { describe, expect, it, vi } from "vitest";

import {
  dispatchNotificationEmails,
  type NotificationEmailStore,
  type PendingNotificationEmail,
} from "@/lib/notifications/email";

const BASE_URL = "https://cami.example.test";

function pending(overrides: Partial<PendingNotificationEmail> = {}): PendingNotificationEmail {
  return {
    audience: "patient",
    id: "notification-1",
    recipientProfileId: "profile-1",
    type: "confirmed",
    title: "Your appointment is confirmed",
    body: "Mon, Dec 1 · 9:00 AM",
    ...overrides,
  };
}

function fakeStore(rows: PendingNotificationEmail[], email: string | null = "patient@example.test") {
  return {
    listPending: vi.fn(async () => rows),
    findRecipientEmail: vi.fn(async () => email),
    claim: vi.fn(async () => true),
    release: vi.fn(async () => undefined),
  } satisfies NotificationEmailStore;
}

describe("dispatchNotificationEmails", () => {
  it("claims, then sends each pending notification to the recipient", async () => {
    const store = fakeStore([pending(), pending({ audience: "doctor", id: "n-2", type: "new_request" })]);
    const send = vi.fn(async () => undefined);

    const summary = await dispatchNotificationEmails({ store, send, baseUrl: BASE_URL });

    expect(summary).toEqual({ sent: 2, skipped: 0, failed: 0 });
    expect(store.claim).toHaveBeenCalledWith("patient", "notification-1");
    expect(store.claim).toHaveBeenCalledWith("doctor", "n-2");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "patient@example.test", subject: "Your appointment is confirmed · CamiConnect" }),
    );
    expect(store.release).not.toHaveBeenCalled();
  });

  it("skips a row another dispatcher already claimed", async () => {
    const store = fakeStore([pending()]);
    store.claim.mockResolvedValueOnce(false);
    const send = vi.fn(async () => undefined);

    const summary = await dispatchNotificationEmails({ store, send, baseUrl: BASE_URL });

    expect(summary).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("marks a row done without sending when the recipient has no email", async () => {
    const store = fakeStore([pending()], null);
    const send = vi.fn(async () => undefined);

    const summary = await dispatchNotificationEmails({ store, send, baseUrl: BASE_URL });

    expect(summary).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(store.claim).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(store.release).not.toHaveBeenCalled();
  });

  it("releases the row when the address lookup fails, so it is not stuck claimed", async () => {
    const store = fakeStore([pending()]);
    store.findRecipientEmail.mockRejectedValueOnce(new Error("auth api down"));
    const send = vi.fn(async () => undefined);

    const summary = await dispatchNotificationEmails({ store, send, baseUrl: BASE_URL });

    expect(summary).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(store.release).toHaveBeenCalledWith("patient", "notification-1");
  });

  it("releases the row for a retry when sending fails, and keeps going", async () => {
    const store = fakeStore([pending(), pending({ id: "n-2" })]);
    const send = vi.fn().mockRejectedValueOnce(new Error("smtp down")).mockResolvedValueOnce(undefined);

    const summary = await dispatchNotificationEmails({ store, send, baseUrl: BASE_URL });

    expect(summary).toEqual({ sent: 1, skipped: 0, failed: 1 });
    expect(store.release).toHaveBeenCalledWith("patient", "notification-1");
  });
});
