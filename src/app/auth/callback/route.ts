import { NextResponse, type NextRequest } from "next/server";

import { sanitizeReturnPath } from "@/lib/auth/return-path";
import { createSupabaseServerClient } from "@/server/auth/client";

const NO_STORE = "private, no-store";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeReturnPath(searchParams.get("next")) || "/account";

  if (!code) {
    const response = NextResponse.redirect(`${origin}/login?error=callback`);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const response = NextResponse.redirect(`${origin}/login?error=callback`);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}
