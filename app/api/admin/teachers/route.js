// API data guru freelance — dilindungi middleware (cookie internal).
import { NextResponse } from "next/server";
import { getTeachers, createTeacher, updateTeacher } from "@/lib/teachers";
import { canWrite } from "@/lib/gauth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const t = await getTeachers();
  return NextResponse.json(
    { ...t, canWrite: t.source === "live" && canWrite() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req) {
  if (!canWrite()) {
    return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  }
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
  }
  try {
    if (body.action === "create") {
      return NextResponse.json({ ok: true, ...(await createTeacher({ ...(body.data || {}), force: body.force })) });
    }
    if (body.action === "update") {
      return NextResponse.json({ ok: true, ...(await updateTeacher(body.row, body.data || {})) });
    }
    return NextResponse.json({ error: "Aksi tidak dikenal: " + body.action }, { status: 400 });
  } catch (e) {
    if (e.duplicate) return NextResponse.json({ error: e.message, duplicate: e.duplicate }, { status: 409 });
    console.error("teachers write:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 500 });
  }
}
