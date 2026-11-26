import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, requireUser } from "@/lib/supabase/server";

// Öffnet eine Datei: prüft per RLS, dass sie dem Nutzer gehört, und leitet auf einen kurzlebigen Link um.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: m } = await supabase.from("materials").select("storage_path, dateiname").eq("id", id).maybeSingle();
  if (!m) return new NextResponse("Nicht gefunden", { status: 404 });
  const download = req.nextUrl.searchParams.has("download") ? m.dateiname : undefined;
  const { data } = await createAdminClient().storage.from("materialien").createSignedUrl(m.storage_path, 300, download ? { download } : undefined);
  if (!data) return new NextResponse("Fehler", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
