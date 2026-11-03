"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import type { UserAdminActionState } from "@/server/users/actions";

const IDLE_STATE: UserAdminActionState = { status: "idle" };

/** Wires a user admin form to its action and toasts on success. */
export function useUserAdminForm(
  action: (state: UserAdminActionState, formData: FormData) => Promise<UserAdminActionState>,
) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return { state, formAction, pending };
}
