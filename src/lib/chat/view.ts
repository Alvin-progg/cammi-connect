/** `/chat?view=` contract: the chat itself or the patient's appointments. */
export type ChatPageView = "chat" | "appointments";

export function parseChatView(value: string | string[] | undefined): ChatPageView {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "appointments" ? "appointments" : "chat";
}
