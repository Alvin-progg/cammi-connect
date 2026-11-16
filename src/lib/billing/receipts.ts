/**
 * PAY-04 receipt rules, shared by the upload route and the 0035 migration
 * (tests/unit/billing/payment-receipts-sql.test.ts keeps them in step).
 */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_UPLOADS_PER_WINDOW = 5;
export const RECEIPT_WINDOW_MINUTES = 10;
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp";

export type ReceiptImageType =
  | { contentType: "image/jpeg"; extension: "jpg" }
  | { contentType: "image/png"; extension: "png" }
  | { contentType: "image/webp"; extension: "webp" };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return (
    bytes.length >= offset + signature.length &&
    signature.every((value, index) => bytes[offset + index] === value)
  );
}

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * The image type from the file's own signature (magic bytes). The file name
 * and the browser's content type are never trusted.
 */
export function detectReceiptImageType(bytes: Uint8Array): ReceiptImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, PNG_SIGNATURE)) return { contentType: "image/png", extension: "png" };
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}
