// Supabase client for Server Components and Server Actions, authenticated as the SIGNED-IN STAFF
// MEMBER through cookies. It only ever uses the publishable key, so everything it can do is bounded
// by RLS and column grants. No secret or service-role key exists in the browser or in this file.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { authCookieOptions, withAuthCookiePolicy } from "./cookie-policy";

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || key.startsWith("sb_secret_")) throw new Error("Supabase is not configured");
  return { url, key };
}

export async function createSupabaseServerClient() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          // The library ignores a custom maxAge for cookies it sets, so the policy is applied here too.
          for (const { name, value, options } of list) store.set(name, value, withAuthCookiePolicy(options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes the
          // session on every /admin request, so this is safe to ignore.
        }
      },
    },
  });
}
