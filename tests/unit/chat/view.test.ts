import { describe, expect, it } from "vitest";

import { parseChatView } from "@/lib/chat/view";

describe("parseChatView", () => {
  it("opens the appointments view", () => {
    expect(parseChatView("appointments")).toBe("appointments");
    expect(parseChatView(["appointments", "chat"])).toBe("appointments");
  });

  it.each([undefined, "", "chat", "admin", "APPOINTMENTS"])(
    "falls back to the chat for %j",
    (value) => {
      expect(parseChatView(value)).toBe("chat");
    },
  );
});
