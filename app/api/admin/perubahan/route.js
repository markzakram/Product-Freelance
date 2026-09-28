// Keputusan admin atas ajuan perubahan data dari "Profil saya".
import { NextResponse } from "next/server";
import { tolakBukanAdmin } from "@/lib/authServer";
import { canWrite } from "@/lib/gauth";
import { putuskanPerubahan } from "@/lib/perubahanGuru";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  if (!canWrite()) return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  try {
    const body = await req.json();
    return NextResponse.json({ ok: true, ajuan: await putuskanPerubahan(body.row, Boolean(body.setuju)) });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 400 });
  }
}
