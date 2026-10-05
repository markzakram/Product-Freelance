// Guru mengumpulkan hasil pekerjaan (link Google Docs/Drive) — pertama kali atau revisi.
import { NextResponse } from "next/server";
import { sesiGuru, asalSah } from "@/lib/sesiGuru";
import { canWrite } from "@/lib/gauth";
import { kumpulkan } from "@/lib/pengerjaan";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal permintaan tidak sah." }, { status: 403 });
  const sesi = await sesiGuru();
  if (!sesi) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  if (sesi.wajibGanti) return NextResponse.json({ error: "Ganti password sementara dulu." }, { status: 403 });
  if (!canWrite()) return NextResponse.json({ error: "Pengumpulan sedang tidak bisa disimpan. Hubungi admin." }, { status: 503 });
  try {
    const body = await req.json();
    return NextResponse.json({ ok: true, ...(await kumpulkan({ idGuru: sesi.akun.idGuru, email: sesi.akun.email }, body.id, { link: body.link, catatan: body.catatan })) });
  } catch (e) {
    if (!e.status) console.error("kumpul:", e);
    return NextResponse.json({ error: e.message || "Gagal mengumpulkan." }, { status: e.status || 500 });
  }
}
