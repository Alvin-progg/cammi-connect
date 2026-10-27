import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/config.public";

const PROTECTED_PREFIXES = ["/account", "/doctor"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withPrivateCacheHeaders<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Refreshes and verifies Supabase session cookies, then performs an optimistic
 * redirect of unauthenticated visitors away from protected routes. Authorization
 * is re-checked in the DAL; this proxy is never the enforcement point.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = isProtectedPath(pathname);

  let response = NextResponse.next({ request });
  if (isProtected) {
    response = withPrivateCacheHeaders(response);
  }

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

  if (isProtected) {
    // A-CACHE-01: never cache user-specific responses, including redirects.
    response = withPrivateCacheHeaders(response);
  }

  if (!isProtected || data) {
    return response;
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return withPrivateCacheHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: ["/account/:path*", "/doctor/:path*"],
};
