// @vitest-environment node
import { describe, expect, it } from "vitest";

import { detectReceiptImageType, RECEIPT_MAX_BYTES } from "@/lib/billing/receipts";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const WEBP = new Uint8Array([...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WEBPVP8 ")]);

/**
 * PAY-04: receipts are accepted by file signature only, never by the file
 * name or the browser's content type (PAY-001 "Security and privacy").
 */
describe("detectReceiptImageType", () => {
  it("accepts JPEG, PNG, and WebP by their signatures", () => {
    expect(detectReceiptImageType(JPEG)).toEqual({ contentType: "image/jpeg", extension: "jpg" });
    expect(detectReceiptImageType(PNG)).toEqual({ contentType: "image/png", extension: "png" });
    expect(detectReceiptImageType(WEBP)).toEqual({ contentType: "image/webp", extension: "webp" });
  });

  it("rejects GIF, PDF, renamed text, and empty files", () => {
    expect(detectReceiptImageType(ascii("GIF89a\x01\x00\x01\x00"))).toBeNull();
    expect(detectReceiptImageType(ascii("%PDF-1.7\n%"))).toBeNull();
    expect(detectReceiptImageType(ascii("hello, this is receipt.jpg"))).toBeNull();
    expect(detectReceiptImageType(new Uint8Array())).toBeNull();
  });

  it("rejects truncated signatures and other RIFF files", () => {
    expect(detectReceiptImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectReceiptImageType(PNG.slice(0, 7))).toBeNull();
    expect(detectReceiptImageType(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")]))).toBeNull();
  });

  it("caps receipts at 5 MB", () => {
    expect(RECEIPT_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
