"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  AUTH_NOTICE_PARAM,
  AUTH_NOTICE_SIGNED_IN,
} from "@/lib/auth/notice";

const AUTH_NOTICE_MESSAGES = {
  [AUTH_NOTICE_SIGNED_IN]: {
    title: "Signed in",
    description: "You are now signed in.",
  },
} as const;

type AuthNoticeValue = keyof typeof AUTH_NOTICE_MESSAGES;

function isAuthNotice(value: string | null): value is AuthNoticeValue {
  return value !== null && value in AUTH_NOTICE_MESSAGES;
}

export function AuthNotice() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledNotice = useRef<AuthNoticeValue | null>(null);
  const notice = searchParams.get(AUTH_NOTICE_PARAM);

  useEffect(() => {
    if (!isAuthNotice(notice)) {
      handledNotice.current = null;
      return;
    }
    if (handledNotice.current === notice) return;
    handledNotice.current = notice;

    const message = AUTH_NOTICE_MESSAGES[notice];
    toast.success(message.title, {
      id: "auth-notice",
      description: message.description,
    });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(AUTH_NOTICE_PARAM);
    const query = nextParams.toString();
    const hash = window.location.hash;
    router.replace(query ? `${pathname}?${query}${hash}` : `${pathname}${hash}`, {
      scroll: false,
    });
  }, [notice, pathname, router, searchParams]);

  return null;
}
