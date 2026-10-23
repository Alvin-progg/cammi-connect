import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/config.public";

/**
 * Refreshes and verifies Supabase session cookies, then performs an optimistic
 * redirect of unauthenticated visitors away from /account. Authorization is
 * re-checked in the DAL; this proxy is never the enforcement point.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  let env;
  try {
    env = getPublicEnv();
  } catch {
    // Public Supabase env is not configured (e.g. local dev without
    // .env.local). Skip proxy checks; routes render with their own handling.
    return response;
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cache headers required when auth cookies are written.
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Refresh and verify tokens with verified JWT claims.
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/account")) {
    if (!data) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
    // A-CACHE-01: never cache user-specific responses.
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}

export const config = {
  matcher: ["/account/:path*"],
};
