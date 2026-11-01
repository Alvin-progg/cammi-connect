import "server-only";

import {
  chatRequestSchema,
  type ChatMessage,
  type ChatMessagePayload,
  type ChatRole,
  type ConversationSummary,
} from "@/lib/chat/schemas";
import { IDLE_STATE, type BookingState, type BookingStep } from "@/lib/chat/state";
import { ProviderError } from "@/server/ai/http";
import type { PatientApiAccess } from "@/server/auth/dal";

import { handleTurn, type TurnDeps } from "./orchestrator";

/** ADR-0008: user messages per patient per minute, across all conversations. */
export const CHAT_RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const TITLE_MAX_LENGTH = 60;

export type NewChatMessage = {
  role: ChatRole;
  content: string;
  payload?: ChatMessagePayload | null;
  createdAt: Date;
};

export type ChatStore = {
  /** Returns null when the conversation does not exist or is not the patient's. */
  getConversation(patientId: string, conversationId: string): Promise<ConversationSummary | null>;
  /** Callers must check ownership with getConversation first. */
  listMessages(conversationId: string): Promise<ChatMessage[]>;
  countRecentUserMessages(patientId: string, since: Date): Promise<number>;
  /** Stored state that fails validation comes back as idle. */
  getBookingState(patientId: string, conversationId: string): Promise<BookingState>;
  saveBookingState(patientId: string, conversationId: string, state: BookingState): Promise<void>;
  /**
   * Writes `next` only if the stored step is still `from`; false when another
   * request changed it first. This is the double-Confirm guard.
   */
  claimBookingState(
    patientId: string,
    conversationId: string,
    from: BookingStep,
    next: BookingState,
  ): Promise<boolean>;
  createConversation(input: {
    id: string;
    patientId: string;
    title: string;
    bookingState: BookingState;
  }): Promise<void>;
  appendMessages(conversationId: string, messages: NewChatMessage[]): Promise<ChatMessage[]>;
};

export type ChatOutcome =
  | "ok"
  | "unauthenticated"
  | "forbidden"
  | "invalid_json"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "unavailable";

/** Log entries hold IDs and outcomes only, never message text (SPEC §7.3). */
export type ChatLogEntry = {
  requestId: string;
  outcome: ChatOutcome;
  status: number;
  /** For 503s: the provider and failure kind, or "internal". */
  cause?: string;
};

export type ChatHandlerDeps = {
  resolvePatient: () => Promise<PatientApiAccess>;
  store: ChatStore;
  generate: TurnDeps["generate"];
  searchKnowledge: TurnDeps["searchKnowledge"];
  tools: TurnDeps["tools"];
  now: () => Date;
  newId: () => string;
  log: (entry: ChatLogEntry) => void;
};

const ERROR_MESSAGES: Record<Exclude<ChatOutcome, "ok">, string> = {
  unauthenticated: "Please sign in to use the chat.",
  forbidden: "The chat is only available to patient accounts.",
  invalid_json: "The request could not be read.",
  invalid_request: "Please enter a message of up to 1000 characters.",
  not_found: "This conversation could not be found.",
  rate_limited: "You're sending messages too quickly. Please wait a moment and try again.",
  unavailable: "The assistant is unavailable right now. Please try again in a moment.",
};

const ERROR_STATUS: Record<Exclude<ChatOutcome, "ok">, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_json: 400,
  invalid_request: 422,
  not_found: 404,
  rate_limited: 429,
  unavailable: 503,
};

const NO_STORE = { "cache-control": "private, no-store" };

function conversationTitle(text: string): string {
  return text.length <= TITLE_MAX_LENGTH ? text : `${text.slice(0, TITLE_MAX_LENGTH - 1)}…`;
}

/**
 * POST /api/v1/chat. Authentication and validation run before any provider
 * call, and messages are saved only after the assistant reply exists, so a
 * failed turn leaves nothing behind and the client can retry its draft.
 */
export async function handleChatRequest(
  request: Request,
  deps: ChatHandlerDeps,
): Promise<Response> {
  const requestId = deps.newId();

  function fail(outcome: Exclude<ChatOutcome, "ok">, cause?: string): Response {
    const status = ERROR_STATUS[outcome];
    deps.log({ requestId, outcome, status, ...(cause ? { cause } : {}) });
    return Response.json(
      { error: { code: outcome, message: ERROR_MESSAGES[outcome] }, requestId },
      { status, headers: NO_STORE },
    );
  }

  try {
    const access = await deps.resolvePatient();
    if (access.status !== "ok") {
      return fail(access.status);
    }
    const patientId = access.patient.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("invalid_json");
    }
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return fail("invalid_request");
    }
    const { conversationId: requestedId, event } = parsed.data;

    if (requestedId && !(await deps.store.getConversation(patientId, requestedId))) {
      return fail("not_found");
    }

    const now = deps.now();
    const recentCount = await deps.store.countRecentUserMessages(
      patientId,
      new Date(now.getTime() - RATE_LIMIT_WINDOW_MS),
    );
    if (recentCount >= CHAT_RATE_LIMIT_PER_MINUTE) {
      return fail("rate_limited");
    }

    const conversationId = requestedId ?? deps.newId();
    const [history, bookingState] = requestedId
      ? await Promise.all([
          deps.store.listMessages(requestedId),
          deps.store.getBookingState(patientId, requestedId),
        ])
      : [[], IDLE_STATE];
    const turn = await handleTurn(
      {
        conversationId,
        patientId,
        history: history.map(({ role, content }) => ({ role, content })),
        event,
        state: bookingState,
        now,
      },
      {
        generate: deps.generate,
        searchKnowledge: deps.searchKnowledge,
        tools: deps.tools,
        claimBooking: (next) =>
          deps.store.claimBookingState(patientId, conversationId, "awaiting_confirmation", next),
      },
    );

    if (!requestedId) {
      await deps.store.createConversation({
        id: conversationId,
        patientId,
        title: conversationTitle(turn.userContent),
        bookingState: turn.state,
      });
    } else if (turn.state !== bookingState) {
      // An unchanged state is not written back, so a turn that lost the
      // Confirm claim cannot overwrite the winner's booking state.
      await deps.store.saveBookingState(patientId, conversationId, turn.state);
    }
    // Distinct timestamps keep the pair in order when the thread is reloaded.
    const saved = await deps.store.appendMessages(conversationId, [
      { role: "user", content: turn.userContent, createdAt: now },
      {
        role: "assistant",
        content: turn.reply,
        payload: turn.payload,
        createdAt: new Date(now.getTime() + 1),
      },
    ]);

    deps.log({ requestId, outcome: "ok", status: 200 });
    return Response.json(
      { conversationId, messages: saved, state: turn.state, requestId },
      { headers: NO_STORE },
    );
  } catch (error) {
    // Provider errors, timeouts, missing AI config, and database failures all
    // become a controlled 503 with no internal details for the client.
    const cause =
      error instanceof ProviderError ? `${error.provider}:${error.kind}` : "internal";
    return fail("unavailable", cause);
  }
}
