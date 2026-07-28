// API lintas bulan: data untuk Analisis + pembuatan proyek bulan baru.
import { NextResponse } from "next/server";
import { getAllMonths, createMonth, addLines } from "@/lib/months";
import { canWrite } from "@/lib/gauth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const d = await getAllMonths();
  return NextResponse.json(
    { ...d, canWrite: d.source === "live" && canWrite() },
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
    if (body.action === "createMonth") {
      return NextResponse.json({ ok: true, ...(await createMonth(body.bulan, body.lines || [])) });
    }
    if (body.action === "addLines") {
      return NextResponse.json({ ok: true, ...(await addLines(body.tab, body.lines || [])) });
    }
    return NextResponse.json({ error: "Aksi tidak dikenal: " + body.action }, { status: 400 });
  } catch (e) {
    console.error("months write:", e);
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 500 });
  }
}
