"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
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

/**
 * `onOptimistic` runs inside the submit transition, so a `useOptimistic`
 * update made there reverts by itself if the action fails.
 */
export function MarkAllReadButton({
  disabled = false,
  onOptimistic,
}: {
  disabled?: boolean;
  onOptimistic?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    markAllNotificationsReadAction,
    IDLE_STATE,
  );
  useNotificationToast(state);

  return (
    <form
      action={() => {
        onOptimistic?.();
        formAction();
      }}
      className="flex items-center gap-2"
    >
      <button
        type="submit"
        disabled={disabled || pending}
        aria-busy={pending}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
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

/**
 * Marks one notification read in the background (opening its details does
 * this). Success is silent; `/doctor` revalidates and the badge updates.
 */
export function useMarkNotificationRead(
  onOptimistic?: (notificationId: string) => void,
): (notificationId: string) => void {
  const [, startTransition] = useTransition();
  return (notificationId) => {
    const formData = new FormData();
    formData.set("notificationId", notificationId);
    startTransition(async () => {
      onOptimistic?.(notificationId);
      const state = await markNotificationReadAction(IDLE_STATE, formData);
      if (state.status === "error") {
        toast.error(state.message);
      }
    });
  };
}
