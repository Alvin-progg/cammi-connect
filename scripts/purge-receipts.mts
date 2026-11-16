#!/usr/bin/env node
/**
 * Receipt retention for PAY-001 D5 (ADR-0005 amendment).
 *
 * Run with: npm run payments:purge-receipts  (add --dry-run to only count)
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Apply db/migrations/0039_payment_expiry.sql first.
 *
 * Deletes receipt images from the private payment-receipts bucket 90 days
 * after their payment closed (src/lib/billing/retention.ts), then marks the
 * rows through cammi_connect_mark_receipts_purged. Payment rows, receipt rows,
 * and payment history stay. A row is marked only after its image was removed,
 * so a failed run is simply repeated. Prints counts only, never paths or IDs.
 */
import { createClient } from "@supabase/supabase-js";

import { isReceiptPurgeable, RECEIPT_RETENTION_DAYS, type ReceiptRetentionRow } from "../src/lib/billing/retention.ts";

const BUCKET = "payment-receipts";
const PAGE_SIZE = 1000;
/** Ids per `in` filter and objects per Storage remove call. */
const BATCH_SIZE = 100;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. See db/README.md.`);
  }
  return value;
}

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += BATCH_SIZE) result.push(values.slice(index, index + BATCH_SIZE));
  return result;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const now = new Date();
  // A receipt is uploaded before its payment closes, so only older uploads can qualify.
  const uploadedBefore = new Date(now.getTime() - RECEIPT_RETENTION_DAYS * 86_400_000).toISOString();

  const receipts: { id: string; payment_id: string; storage_path: string }[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("payment_receipts")
      .select("id, payment_id, storage_path")
      .is("purged_at", null)
      .lt("uploaded_at", uploadedBefore)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Unable to load receipts.");
    receipts.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  const payments = new Map<string, { status: string; updated_at: string; appointment_id: string }>();
  for (const ids of batches([...new Set(receipts.map((receipt) => receipt.payment_id))])) {
    const { data, error } = await supabase.from("payments").select("id, status, updated_at, appointment_id").in("id", ids);
    if (error) throw new Error("Unable to load payments.");
    for (const row of data ?? []) payments.set(row.id, row);
  }

  const appointments = new Map<string, { status: string; updated_at: string }>();
  for (const ids of batches([...new Set([...payments.values()].map((payment) => payment.appointment_id))])) {
    const { data, error } = await supabase.from("appointments").select("id, status, updated_at").in("id", ids);
    if (error) throw new Error("Unable to load appointments.");
    for (const row of data ?? []) appointments.set(row.id, row);
  }

  const purgeable = receipts.filter((receipt) => {
    const payment = payments.get(receipt.payment_id);
    const appointment = payment && appointments.get(payment.appointment_id);
    if (!payment || !appointment) return false;
    const row = {
      paymentStatus: payment.status,
      paymentUpdatedAt: payment.updated_at,
      appointmentStatus: appointment.status,
      appointmentUpdatedAt: appointment.updated_at,
    } as ReceiptRetentionRow; // statuses come from the payment_status and appointment_status enums
    return isReceiptPurgeable(row, now);
  });

  console.log(`${purgeable.length} of ${receipts.length} older receipts are past retention.`);
  if (dryRun) return;

  let marked = 0;
  for (const batch of batches(purgeable)) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(batch.map((receipt) => receipt.storage_path));
    if (removeError) throw new Error("Unable to delete receipt images.");
    const { data, error } = await supabase.rpc("cammi_connect_mark_receipts_purged", {
      p_receipt_ids: batch.map((receipt) => receipt.id),
    });
    if (error) throw new Error("Unable to mark receipts purged.");
    marked += Number(data ?? 0);
  }
  console.log(`Deleted and marked ${marked} receipts.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Receipt purge failed.");
  process.exitCode = 1;
});
