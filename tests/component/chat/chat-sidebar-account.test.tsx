import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "@/components/chat/chat-sidebar";

vi.mock("@/server/notifications/patient-actions", () => ({
  markPatientNotificationReadAction: vi.fn(),
  markAllPatientNotificationsReadAction: vi.fn(),
}));

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/server/chat/conversation-actions", () => ({
  setConversationPinnedAction: vi.fn(),
  deleteConversationAction: vi.fn(),
}));

function renderSidebar(patientName: string) {
  return render(
    <ChatSidebar
      state="open"
      onToggle={vi.fn()}
      onExpand={vi.fn()}
      onNavigate={vi.fn()}
      searchOpen={false}
      onSearchOpenChange={vi.fn()}
      conversations={[]}
      activeConversationId={null}
      appointmentsActive={false}
      patientName={patientName}
    />,
  );
}

describe("ChatSidebar account link", () => {
  it("links the patient avatar and name to the account page", () => {
    renderSidebar("Maria Santos");
    const link = screen.getByRole("link", { name: /maria santos/i });
    expect(link).toHaveAttribute("href", "/account");
  });
});
