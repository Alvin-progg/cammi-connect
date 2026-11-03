"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import type { DepartmentActionState } from "@/server/departments/actions";

const IDLE_STATE: DepartmentActionState = { status: "idle" };

/** Wires a department form to its action and toasts on success. */
export function useDepartmentForm(
  action: (state: DepartmentActionState, formData: FormData) => Promise<DepartmentActionState>,
) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return { state, formAction, pending };
}
