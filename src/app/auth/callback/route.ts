import { NextResponse } from "next/server";
import { createClient, configured } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/domain";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.APP_URL ?? url.origin;
  const code = url.searchParams.get("code");
  if (code && configured()) {
    const c = await createClient();
    const { error } = await c.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeReturnPath(url.searchParams.get("next")), origin),
      );
  }
  return NextResponse.redirect(new URL("/login?error=oauth", origin));
}
