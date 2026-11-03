import { NextResponse, type NextRequest } from "next/server";

import { emailLinkSchema } from "@/lib/auth/schemas";
import { verifyEmailLink } from "@/server/auth/service";

const NO_STORE = "private, no-store";
const SET_PASSWORD_PATH = "/account/password";

function redirectTo(url: string): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

/**
 * Landing for admin-triggered invite and password-reset emails. The token is
 * verified on the server (no PKCE verifier is needed, unlike /auth/callback),
 * which signs the user in on this browser so they can set their password.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const link = emailLinkSchema.safeParse({
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
  });

  if (!link.success || !(await verifyEmailLink(link.data))) {
    return redirectTo(`${origin}/login?error=callback`);
  }
  return redirectTo(`${origin}${SET_PASSWORD_PATH}`);
}
