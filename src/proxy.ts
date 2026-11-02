import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { authCookieOptions, withAuthCookiePolicy } from "./lib/supabase/cookie-policy";

const intl = createMiddleware(routing);

// /admin: keep the Supabase session fresh and send signed-out visitors to the login page.
// This is a convenience, NOT the security boundary: every admin page and server action calls
// requireStaff() and the database enforces RLS regardless.
async function admin(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let response = NextResponse.next({ request });
  if (url && key && !key.startsWith("sb_secret_")) {
    const supabase = createServerClient(url, key, {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, withAuthCookiePolicy(options));
        },
      },
    });
    // getClaims() checks the token signature against the project public keys (cached in memory) and its
    // expiry, and refreshes the session when it has expired. Unlike getUser() it makes no Auth-server round
    // trip, which this proxy would otherwise pay on every page view, every link prefetch and every action.
    // That is enough for a redirect convenience; the authoritative check (getUser() on the Auth server) is
    // still made by requireStaff() on every page and action, so a revoked session cannot get past it.
    const { data } = await supabase.auth.getClaims();
    const signedIn = Boolean(data?.claims?.sub);
    // /admin/auth/* is the invitation landing point: its one-time token IS the credential there.
    if (!signedIn && pathname !== "/admin/login" && !pathname.startsWith("/admin/auth/")) {
      const login = request.nextUrl.clone();
      login.pathname = "/admin/login";
      login.search = "";
      return NextResponse.redirect(login);
    }
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return admin(request);
  return intl(request);
}

export const config = {
  // Locale routing for public pages and session handling for /admin. API routes, Next internals and
  // files with an extension are excluded. (The earlier pattern lost its backslash in a plain string,
  // which silently disabled locale redirects for unprefixed paths such as /projects.)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
