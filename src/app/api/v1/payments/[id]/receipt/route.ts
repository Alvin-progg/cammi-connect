import { resolvePatientForApi } from "@/server/auth/dal";
import { supabaseChatRepository } from "@/server/chat/repository";
import { handleReceiptUpload } from "@/server/payments/receipts";
import { supabaseReceiptRepository } from "@/server/payments/repository";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

/** PAY-04: a patient's receipt photo for one of their payments. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/v1/payments/[id]/receipt">,
): Promise<Response> {
  const { id } = await context.params;
  return handleReceiptUpload(request, id, {
    resolvePatient: resolvePatientForApi,
    loadPaymentSettings: async () => {
      const settings = await getSettings(supabaseSettingsRepository);
      return { enabled: settings["payment.enabled"], maxReceipts: settings["payment.max_receipts"] };
    },
    store: supabaseReceiptRepository,
    chat: supabaseChatRepository,
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    // IDs and outcomes only; never amounts, references, or receipt content.
    log: (entry) => {
      const line = JSON.stringify({ event: "payment_receipt", ...entry });
      if (entry.status >= 500) {
        console.error(line);
      } else {
        console.info(line);
      }
    },
  });
}
