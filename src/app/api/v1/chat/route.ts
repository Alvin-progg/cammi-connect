import { supabaseAppointmentBooker } from "@/server/appointments/repository";
import { resolvePatientForApi } from "@/server/auth/dal";
import { embedTexts } from "@/server/ai/gemini-embeddings";
import { generate } from "@/server/ai/opencode-zen";
import { supabaseAvailabilitySource } from "@/server/availability/repository";
import { handleChatRequest } from "@/server/chat/handler";
import { supabaseChatRepository } from "@/server/chat/repository";
import { createChatTools } from "@/server/chat/tools";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseKnowledgeRepository } from "@/server/knowledge/repository";
import { searchHospitalInformation } from "@/server/knowledge/service";

async function embedQuery(question: string): Promise<number[]> {
  const [embedding] = await embedTexts([question], "RETRIEVAL_QUERY");
  return embedding;
}

export async function POST(request: Request): Promise<Response> {
  return handleChatRequest(request, {
    resolvePatient: resolvePatientForApi,
    store: supabaseChatRepository,
    generate: (input) => generate(input),
    searchKnowledge: (question) =>
      searchHospitalInformation(question, { embedQuery, store: supabaseKnowledgeRepository }),
    tools: createChatTools({
      directory: supabaseDirectoryRepository,
      availability: supabaseAvailabilitySource,
      booker: supabaseAppointmentBooker,
      now: () => new Date(),
    }),
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
