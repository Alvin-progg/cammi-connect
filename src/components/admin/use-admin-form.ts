"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

type FormState = { status: "idle" } | { status: "error" | "success"; message: string };

/** Wires an admin form to its Server Action and toasts on success. */
export function useAdminForm<State extends FormState>(
  action: (state: Awaited<State>, formData: FormData) => Promise<State>,
  idleState: Awaited<State>,
) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, idleState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return { state, formAction, pending };
}
