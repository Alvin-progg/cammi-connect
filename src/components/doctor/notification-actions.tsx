"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationActionState,
} from "@/server/notifications/actions";

const IDLE_STATE: NotificationActionState = { status: "idle" };

function useNotificationToast(state: NotificationActionState) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);
}

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [state, formAction, pending] = useActionState(
    markNotificationReadAction,
    IDLE_STATE,
  );
  useNotificationToast(state);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="notificationId" value={notificationId} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "Updating…" : "Mark read"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function MarkAllReadButton() {
  const [state, formAction, pending] = useActionState(
    markAllNotificationsReadAction,
    IDLE_STATE,
  );
  useNotificationToast(state);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "Updating…" : "Mark all as read"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
