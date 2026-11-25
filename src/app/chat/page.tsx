import type { Metadata } from "next";
import { connection } from "next/server";

import { AccessDenied } from "@/components/auth/access-denied";
import { ChatMaintenance } from "@/components/chat/chat-maintenance";
import { ChatShell } from "@/components/chat/chat-shell";
import { splitPatientAppointments } from "@/lib/appointments/patient";
import { greetingFor } from "@/lib/chat/greeting";
import { paymentQrImageSrc } from "@/lib/chat/payment";
import { parseChatView } from "@/lib/chat/view";
import { supabasePatientAppointmentsRepository } from "@/server/appointments/repository";
import { listPatientAppointments } from "@/server/appointments/service";
import { getPatientSession } from "@/server/auth/dal";
import { supabaseChatRepository } from "@/server/chat/repository";
import { loadChatView } from "@/server/chat/service";
import { supabasePatientNotificationsRepository } from "@/server/notifications/patient-repository";
import { listPatientNotifications } from "@/server/notifications/patient-service";
import { listOpenPaymentsForPatient } from "@/server/payments/repository";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

export const metadata: Metadata = { title: "Chat · CamiConnect" };

type ChatSearchParams = { c?: string | string[]; view?: string | string[] };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<ChatSearchParams>;
}) {
  await connection();
  const params = await searchParams;
  const session = await getPatientSession("/chat");

  if (!session) {
    return <AccessDenied message="The chat assistant is only available to patient accounts." />;
  }

  const settings = await getSettings(supabaseSettingsRepository);
  if (!settings["chatbot.enabled"]) {
    return (
      <main id="main" className="flex h-dvh flex-col bg-surface">
        <ChatMaintenance contactPhone={settings["hospital.contact_phone"]} />
      </main>
    );
  }

  const patientId = session.patient.id;
  const pageView = parseChatView(params.view);
  const requestedId = Array.isArray(params.c) ? params.c[0] : params.c;
  const now = new Date();

  const paymentEnabled = settings["payment.enabled"];
  const [view, appointments, payments, notifications] = await Promise.all([
    loadChatView(patientId, pageView === "chat" ? requestedId : undefined, supabaseChatRepository),
    pageView === "appointments"
      ? listPatientAppointments(patientId, supabasePatientAppointmentsRepository)
      : null,
    // "Pay later" (PAY-04): unpaid payments for the patient's requests.
    pageView === "appointments" && paymentEnabled ? listOpenPaymentsForPatient(patientId) : {},
    listPatientNotifications(patientId, supabasePatientNotificationsRepository),
  ]);
  const { salutation, firstName } = greetingFor(session.patient.fullName, now);

  return (
    <main id="main" className="flex h-dvh flex-col overflow-hidden bg-surface">
      <ChatShell
        // A new key resets the client thread when another chat is opened.
        key={`${pageView}:${view.conversationId ?? "new"}`}
        salutation={salutation}
        firstName={firstName}
        welcomeMessage={settings["chatbot.welcome_message"]}
        patientName={session.patient.fullName}
        conversations={view.conversations}
        conversationId={view.conversationId}
        initialMessages={view.messages}
        appointments={
          appointments ? { ...splitPatientAppointments(appointments, now), payments } : null
        }
        notifications={notifications}
        paymentQr={
          paymentEnabled
            ? {
                imageSrc: paymentQrImageSrc(settings["payment.qr_image_path"]),
                accountName: settings["payment.account_name"],
              }
            : null
        }
      />
    </main>
  );
}
