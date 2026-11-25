import { describe, expect, it } from "vitest";

import { formatReply } from "@/lib/chat/format-reply";

describe("formatReply", () => {
  it("returns one paragraph for plain text", () => {
    expect(formatReply("Visiting hours are 9 to 8.")).toEqual([
      {
        kind: "paragraph",
        segments: [{ text: "Visiting hours are 9 to 8.", strong: false }],
      },
    ]);
  });

  it("turns **bold** into strong segments and removes the asterisks", () => {
    expect(
      formatReply("Bring a **valid ID** and **PhilHealth** card."),
    ).toEqual([
      {
        kind: "paragraph",
        segments: [
          { text: "Bring a ", strong: false },
          { text: "valid ID", strong: true },
          { text: " and ", strong: false },
          { text: "PhilHealth", strong: true },
          { text: " card.", strong: false },
        ],
      },
    ]);
  });

  it("turns * and - lines into one list", () => {
    expect(formatReply("Bring:\n* Valid ID\n- Lab results")).toEqual([
      { kind: "paragraph", segments: [{ text: "Bring:", strong: false }] },
      {
        kind: "list",
        items: [
          [{ text: "Valid ID", strong: false }],
          [{ text: "Lab results", strong: false }],
        ],
      },
    ]);
  });

  it("splits paragraphs on blank lines", () => {
    const blocks = formatReply("First part.\n\nSecond part.");

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "paragraph",
    ]);
  });

  it("drops an unclosed ** while a reply is still being typed out", () => {
    expect(formatReply("Bring a **valid")).toEqual([
      {
        kind: "paragraph",
        segments: [{ text: "Bring a valid", strong: false }],
      },
    ]);
  });

  it("removes stray asterisks and heading markers", () => {
    expect(formatReply("## Requirements\nBring 2 * copies")).toEqual([
      {
        kind: "paragraph",
        segments: [{ text: "Requirements Bring 2  copies", strong: false }],
      },
    ]);
  });

  it("keeps HTML-like text as plain text", () => {
    expect(formatReply("<img src=x onerror=alert(1)> **<b>hi</b>**")).toEqual([
      {
        kind: "paragraph",
        segments: [
          { text: "<img src=x onerror=alert(1)> ", strong: false },
          { text: "<b>hi</b>", strong: true },
        ],
      },
    ]);
  });
});
