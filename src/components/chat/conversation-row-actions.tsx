"use client";

import { PinIcon, PinOffIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useTransition } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import type { ConversationSummary } from "@/lib/chat/schemas";
import {
  deleteConversationAction,
  setConversationPinnedAction,
  type ConversationActionState,
} from "@/server/chat/conversation-actions";

const IDLE_STATE: ConversationActionState = { status: "idle" };

const ICON_BUTTON =
  "focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50";

type ConversationChange =
  | { type: "pin"; id: string; pinned: boolean }
  | { type: "delete"; id: string };

/**
 * Mirrors the repository's order (pinned first, newest pin on top, then by
 * activity) so a pin or unpin lands where the refreshed list will put it.
 */
function applyChange(
  conversations: ConversationSummary[],
  change: ConversationChange,
): ConversationSummary[] {
  const target = conversations.find((conversation) => conversation.id === change.id);
  const others = conversations.filter((conversation) => conversation.id !== change.id);
  if (change.type === "delete" || !target) return others;

  const updated = { ...target, pinned: change.pinned };
  if (change.pinned) return [updated, ...others];

  const pinned = others.filter((conversation) => conversation.pinned);
  const unpinned = [...others.filter((conversation) => !conversation.pinned), updated].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
  return [...pinned, ...unpinned];
}

/**
 * Pin and delete show at once. Each change runs in a transition, so it reverts
 * by itself if the action fails, and the revalidated list replaces it on success.
 */
export function useConversationActions(
  savedConversations: ConversationSummary[],
  activeConversationId: string | null,
) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [conversations, applyOptimistic] = useOptimistic(savedConversations, applyChange);

  function setPinned(conversationId: string, pinned: boolean) {
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("pinned", pinned ? "true" : "false");
    startTransition(async () => {
      applyOptimistic({ type: "pin", id: conversationId, pinned });
      const state = await setConversationPinnedAction(IDLE_STATE, formData);
      if (state.status === "error") toast.error(state.message);
    });
  }

  function remove(conversationId: string) {
    // Its messages are going away, so leave the open chat without waiting.
    if (conversationId === activeConversationId) router.push("/chat");
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: conversationId });
      const state = await deleteConversationAction(IDLE_STATE, formData);
      if (state.status === "error") toast.error(state.message);
      else if (state.status === "success") toast.success(state.message);
    });
  }

  return { conversations, setPinned, remove };
}

export function PinConversationButton({
  title,
  pinned,
  onToggle,
}: {
  title: string;
  pinned: boolean;
  onToggle: () => void;
}) {
  const verb = pinned ? "Unpin" : "Pin";
  const Icon = pinned ? PinOffIcon : PinIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${verb} conversation ${title}`}
      title={`${verb} conversation`}
      className={ICON_BUTTON}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}

/** Asks before deleting; confirming closes the dialog and removes the row at once. */
export function DeleteConversationButton({
  conversationId,
  title,
  onConfirm,
}: {
  conversationId: string;
  title: string;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `delete-conversation-${conversationId}`;

  return (
    <>
      <button
        type="button"
        aria-label={`Delete conversation ${title}`}
        title="Delete conversation"
        onClick={() => dialogRef.current?.showModal()}
        className={`${ICON_BUTTON} hover:text-danger-soft-ink`}
      >
        <Trash2Icon aria-hidden="true" className="size-4" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="dialog-motion m-auto w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-overlay backdrop:bg-overlay"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          Delete this conversation?
        </h2>
        <p className="mt-2 text-sm text-ink-secondary">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">
          Its messages are deleted permanently and cannot be recovered.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={buttonVariants({ variant: "ghost" })}
          >
            Keep conversation
          </button>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onConfirm();
            }}
            className={buttonVariants({ variant: "danger" })}
          >
            Yes, delete it
          </button>
        </div>
      </dialog>
    </>
  );
}
