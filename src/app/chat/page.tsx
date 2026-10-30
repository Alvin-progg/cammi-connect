import type { Metadata } from "next";

import { AccessDenied } from "@/components/auth/access-denied";
import { ChatShell } from "@/components/chat/chat-shell";
import { greetingFor } from "@/lib/chat/greeting";
import { getPatientSession } from "@/server/auth/dal";
import { supabaseChatRepository } from "@/server/chat/repository";
import { loadChatView } from "@/server/chat/service";

export const metadata: Metadata = { title: "Chat · CamiConnect" };

type ChatSearchParams = { c?: string | string[] };

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

  const requestedId = Array.isArray(params.c) ? params.c[0] : params.c;
  const view = await loadChatView(session.patient.id, requestedId, supabaseChatRepository);
  const { salutation, firstName } = greetingFor(session.patient.fullName, new Date());

  return (
    <main id="main" className="flex h-dvh flex-col bg-surface-muted sm:p-4 lg:p-6">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden bg-surface sm:rounded-2xl sm:border sm:border-line sm:shadow-card">
        <ChatShell
          // A new key resets the client thread when another chat is opened.
          key={view.conversationId ?? "new"}
          salutation={salutation}
          firstName={firstName}
          conversations={view.conversations}
          conversationId={view.conversationId}
          initialMessages={view.messages}
        />
      </div>
    </main>
  );
}
