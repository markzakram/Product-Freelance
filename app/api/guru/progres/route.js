// Guru melaporkan progres pekerjaan (jumlah soal selesai + link Google Docs).
import { NextResponse } from "next/server";
import { sesiGuru, asalSah } from "@/lib/sesiGuru";
import { canWrite } from "@/lib/gauth";
import { laporProgres } from "@/lib/pengerjaan";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal permintaan tidak sah." }, { status: 403 });
  const sesi = await sesiGuru();
  if (!sesi) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  if (sesi.wajibGanti) return NextResponse.json({ error: "Ganti password sementara dulu." }, { status: 403 });
  if (!canWrite()) return NextResponse.json({ error: "Laporan sedang tidak bisa disimpan. Hubungi admin." }, { status: 503 });
  try {
    const body = await req.json();
    return NextResponse.json({ ok: true, ...(await laporProgres({ idGuru: sesi.akun.idGuru, email: sesi.akun.email }, body.id, { soal: body.soal, link: body.link, catatan: body.catatan })) });
  } catch (e) {
    if (!e.status) console.error("progres:", e);
    return NextResponse.json({ error: e.message || "Gagal melapor progres." }, { status: e.status || 500 });
  }
}
