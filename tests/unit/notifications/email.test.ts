import { describe, expect, it } from "vitest";

import { notificationEmailPath, renderNotificationEmail } from "@/lib/notifications/email";

const BASE_URL = "https://cami.example.test";

describe("notificationEmailPath", () => {
  it("sends doctors to their dashboard", () => {
    expect(notificationEmailPath("doctor", "new_request")).toBe("/doctor");
  });

  it("sends patients to My appointments for visit and payment news", () => {
    expect(notificationEmailPath("patient", "confirmed")).toBe("/chat?view=appointments");
    expect(notificationEmailPath("patient", "payment_verified")).toBe("/chat?view=appointments");
  });

  it("sends patients to their benefits page for PWD and HMO membership news", () => {
    for (const type of ["pwd_verified", "pwd_rejected", "hmo_membership_verified", "hmo_membership_rejected"]) {
      expect(notificationEmailPath("patient", type)).toBe("/account/benefits");
    }
  });
});

describe("renderNotificationEmail", () => {
  it("uses the notification title as the subject and links into the app", () => {
    const email = renderNotificationEmail({
      audience: "patient",
      type: "confirmed",
      title: "Your appointment is confirmed",
      body: "Mon, Dec 1 · 9:00 AM",
      baseUrl: BASE_URL,
    });

    expect(email.subject).toBe("Your appointment is confirmed · CamiConnect");
    expect(email.text).toContain("Mon, Dec 1 · 9:00 AM");
    expect(email.text).toContain("https://cami.example.test/chat?view=appointments");
    expect(email.html).toContain('href="https://cami.example.test/chat?view=appointments"');
  });

  it("escapes HTML in the title and body", () => {
    const email = renderNotificationEmail({
      audience: "doctor",
      type: "new_request",
      title: "New request: <b>Ana</b> & co",
      body: '"quoted"',
      baseUrl: BASE_URL,
    });

    expect(email.html).toContain("New request: &lt;b&gt;Ana&lt;/b&gt; &amp; co");
    expect(email.html).toContain("&quot;quoted&quot;");
    expect(email.html).not.toContain("<b>Ana</b>");
  });

  it("strips line breaks from the subject", () => {
    const email = renderNotificationEmail({
      audience: "doctor",
      type: "cancelled",
      title: "Cancelled:\r\nBcc: x@example.test",
      body: "",
      baseUrl: BASE_URL,
    });

    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});
