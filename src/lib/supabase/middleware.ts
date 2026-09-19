import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const PUBLIC_PATHS = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/** Refreshes the Supabase session cookie on every match and enforces the
 *  auth gate: protected routes redirect to /login, auth pages bounce an
 *  already-signed-in user to the dashboard. */
export async function updateSession(request: NextRequest) {
  // Legacy paths from Phase 1 still resolve; no gate needed for assets.
  if (request.nextUrl.pathname.startsWith("/_next") || request.nextUrl.pathname.includes(".")) {
    return NextResponse.next();
  }

  // Backend not wired yet (missing env vars): fail closed but friendly —
  // protected routes land on /login where forms explain the setup state.
  if (!isSupabaseConfigured()) {
    if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() (not getSession()) — validates the JWT with the
  // Supabase server instead of trusting the cookie payload.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = isPublicPath(path);

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
