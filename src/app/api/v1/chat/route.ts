import { resolvePatientForApi } from "@/server/auth/dal";
import { generate } from "@/server/ai/opencode-zen";
import { handleChatRequest } from "@/server/chat/handler";
import { supabaseChatRepository } from "@/server/chat/repository";

export async function POST(request: Request): Promise<Response> {
  return handleChatRequest(request, {
    resolvePatient: resolvePatientForApi,
    store: supabaseChatRepository,
    generate: (input) => generate(input),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    // IDs and outcomes only; never message text (SPEC §7.3).
    log: (entry) => {
      const line = JSON.stringify({ event: "chat_turn", ...entry });
      if (entry.status >= 500) {
        console.error(line);
      } else {
        console.info(line);
      }
    },
  });
}
