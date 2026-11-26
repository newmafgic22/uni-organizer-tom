import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && isAllowedEmail(data.user?.email)) {
      return NextResponse.redirect(new URL("/", url.origin));
    }
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login?status=fehler", url.origin));
}
