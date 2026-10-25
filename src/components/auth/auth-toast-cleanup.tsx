"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  LOGIN_ERROR_TOAST_ID,
  REGISTER_ERROR_TOAST_ID,
} from "@/lib/auth/toast-ids";

const AUTH_ERROR_TOAST_ID_BY_PATH: Record<string, string> = {
  "/login": LOGIN_ERROR_TOAST_ID,
  "/register": REGISTER_ERROR_TOAST_ID,
};

/**
 * Form error toasts belong to the screen that produced them. Dismiss the
 * previous screen's toast when the user navigates between auth pages so it
 * does not follow them onto the next form.
 */
export function AuthToastCleanup() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const previous = previousPathname.current;
    if (previous === pathname) return;

    const toastId = AUTH_ERROR_TOAST_ID_BY_PATH[previous];
    if (toastId) {
      toast.dismiss(toastId);
    }
    previousPathname.current = pathname;
  }, [pathname]);

  return null;
}
