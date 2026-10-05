// Guru membatalkan pengajuan yang belum di-acc.
import { NextResponse } from "next/server";
import { sesiGuru, asalSah } from "@/lib/sesiGuru";
import { batalkanPengajuan } from "@/lib/pengerjaan";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal permintaan tidak sah." }, { status: 403 });
  const sesi = await sesiGuru();
  if (!sesi) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  try {
    const body = await req.json();
    await batalkanPengajuan({ idGuru: sesi.akun.idGuru, email: sesi.akun.email }, body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal membatalkan." }, { status: e.status || 500 });
  }
}
