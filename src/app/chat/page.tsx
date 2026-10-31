import type { Metadata } from "next";

import { AccessDenied } from "@/components/auth/access-denied";
import { ChatShell } from "@/components/chat/chat-shell";
import { splitPatientAppointments } from "@/lib/appointments/patient";
import { greetingFor } from "@/lib/chat/greeting";
import { parseChatView } from "@/lib/chat/view";
import { supabasePatientAppointmentsRepository } from "@/server/appointments/repository";
import { listPatientAppointments } from "@/server/appointments/service";
import { getPatientSession } from "@/server/auth/dal";
import { supabaseChatRepository } from "@/server/chat/repository";
import { loadChatView } from "@/server/chat/service";

export const metadata: Metadata = { title: "Chat · CamiConnect" };

type ChatSearchParams = { c?: string | string[]; view?: string | string[] };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<ChatSearchParams>;
}) {
  const params = await searchParams;
  const session = await getPatientSession("/chat");

  if (!session) {
    return <AccessDenied message="The chat assistant is only available to patient accounts." />;
  }

  const patientId = session.patient.id;
  const pageView = parseChatView(params.view);
  const requestedId = Array.isArray(params.c) ? params.c[0] : params.c;
  const now = new Date();

  const [view, appointments] = await Promise.all([
    loadChatView(patientId, pageView === "chat" ? requestedId : undefined, supabaseChatRepository),
    pageView === "appointments"
      ? listPatientAppointments(patientId, supabasePatientAppointmentsRepository)
      : null,
  ]);
  const { salutation, firstName } = greetingFor(session.patient.fullName, now);

  return (
    <main id="main" className="flex h-dvh flex-col bg-surface">
      <ChatShell
        // A new key resets the client thread when another chat is opened.
        key={`${pageView}:${view.conversationId ?? "new"}`}
        salutation={salutation}
        firstName={firstName}
        conversations={view.conversations}
        conversationId={view.conversationId}
        initialMessages={view.messages}
        appointments={appointments ? splitPatientAppointments(appointments, now) : null}
      />
    </main>
  );
}
