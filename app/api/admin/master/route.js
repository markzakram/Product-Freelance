// API katalog Master_Project — dilindungi middleware (cookie internal).
import { NextResponse } from "next/server";
import { getMaster, createSubtes, updateSubtes, archiveSubtes, findSimilar } from "@/lib/master";
import { canWrite } from "@/lib/gauth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const m = await getMaster();
  return NextResponse.json(
    { ...m, canWrite: m.source === "live" && canWrite() },
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
    switch (body.action) {
      case "check": {
        // pengaman duplikat sebelum benar-benar menyimpan
        const { rows } = await getMaster();
        return NextResponse.json({ mirip: findSimilar(body.subtes || "", rows) });
      }
      case "create": {
        const res = await createSubtes(body.data || {}, { force: Boolean(body.force) });
        return NextResponse.json({ ok: true, ...res });
      }
      case "update":
        return NextResponse.json({ ok: true, ...(await updateSubtes(body.row, body.data || {})) });
      case "archive":
        return NextResponse.json({ ok: true, ...(await archiveSubtes(body.row, body.status || "Arsip")) });
      default:
        return NextResponse.json({ error: "Aksi tidak dikenal: " + body.action }, { status: 400 });
    }
  } catch (e) {
    if (e.duplicate) {
      return NextResponse.json({ error: e.message, duplicate: e.duplicate }, { status: 409 });
    }
    console.error("master write:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 500 });
  }
}
