import {
  supabaseAppointmentBooker,
  supabasePatientAppointmentsRepository,
} from "@/server/appointments/repository";
import { resolvePatientForApi } from "@/server/auth/dal";
import { embedTexts } from "@/server/ai/gemini-embeddings";
import { generate } from "@/server/ai/groq";
import { supabaseAvailabilitySource } from "@/server/availability/repository";
import { handleChatRequest } from "@/server/chat/handler";
import { supabaseChatRepository } from "@/server/chat/repository";
import { createChatTools } from "@/server/chat/tools";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseKnowledgeRepository } from "@/server/knowledge/repository";
import { searchHospitalInformation } from "@/server/knowledge/service";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

async function embedQuery(question: string): Promise<number[]> {
  const [embedding] = await embedTexts([question], "RETRIEVAL_QUERY");
  return embedding;
}

export async function POST(request: Request): Promise<Response> {
  // Read once per request, and only after the handler has authenticated the patient.
  let settings: ReturnType<typeof getSettings> | undefined;
  const loadSettings = () => (settings ??= getSettings(supabaseSettingsRepository));

  return handleChatRequest(request, {
    resolvePatient: resolvePatientForApi,
    store: supabaseChatRepository,
    generate: (input) => generate(input),
    searchKnowledge: async (question) =>
      searchHospitalInformation(question, {
        embedQuery,
        store: supabaseKnowledgeRepository,
        categories: (await loadSettings())["chatbot.enabled_categories"],
      }),
    tools: createChatTools({
      directory: supabaseDirectoryRepository,
      availability: supabaseAvailabilitySource,
      booker: supabaseAppointmentBooker,
      patientAppointments: supabasePatientAppointmentsRepository,
      now: () => new Date(),
      minLeadHours: async () => (await loadSettings())["appointment.min_lead_hours"],
    }),
    loadChatSettings: async () => {
      const current = await loadSettings();
      return {
        enabled: current["chatbot.enabled"],
        bookingHorizonDays: current["appointment.max_advance_days"],
      };
    },
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
