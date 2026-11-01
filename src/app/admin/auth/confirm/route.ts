// Landing point of the invitation e-mail. The Supabase "Invite user" template must link here with
// ?token_hash={{ .TokenHash }}&type=invite (docs/overnight/TEAM-WORKFLOW.md). The one-time token is
// verified on the SERVER, which sets the session cookie; the person then chooses a password.
// Only "invite" and "recovery" are accepted; everything else is refused.
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  // Relative Location headers on purpose: request.url carries the server's bind address (for example
  // 0.0.0.0:PORT behind a proxy), which would send the browser, and its cookie, to the wrong host.
  const go = (to: string) => new NextResponse(null, { status: 307, headers: { Location: to, "Cache-Control": "no-store" } });
  const fail = () => go("/admin/login?error=invite");
  if (!tokenHash || tokenHash.length > 200 || (type !== "invite" && type !== "recovery")) return fail();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return fail();
  return go("/admin/set-password");
}
