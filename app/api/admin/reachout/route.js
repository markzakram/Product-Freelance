// Catatan reachout (kontak WhatsApp admin -> guru) untuk halaman Pantau reachout.
import { NextResponse } from "next/server";
import { tolakBukanAdmin } from "@/lib/authServer";
import { canWrite } from "@/lib/gauth";
import { bacaReachout, catatKontak, tandaiHasil, TAB_REACHOUT } from "@/lib/reachout";

export const dynamic = "force-dynamic";

export async function GET() {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  try {
    return NextResponse.json({ kontak: await bacaReachout(), tab: TAB_REACHOUT, canWrite: canWrite() });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal membaca tab Reachout." }, { status: 500 });
  }
}

export async function POST(req) {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  if (!canWrite()) return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  try {
    const body = await req.json();
    if (body.action === "catat") return NextResponse.json({ ok: true, ...(await catatKontak(body)) });
    if (body.action === "hasil") return NextResponse.json({ ok: true, ...(await tandaiHasil(body.kid, body.hasil)) });
    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 400 });
  }
}
