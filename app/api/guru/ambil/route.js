// Guru mengajukan pengambilan proyek dari halaman proyek (wajib login).
import { NextResponse } from "next/server";
import { sesiGuru, asalSah } from "@/lib/sesiGuru";
import { getBoard } from "@/lib/juli";
import { getTeachers } from "@/lib/teachers";
import { canWrite } from "@/lib/gauth";
import { ajukan } from "@/lib/pengerjaan";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal permintaan tidak sah." }, { status: 403 });
  const sesi = await sesiGuru();
  if (!sesi) return NextResponse.json({ error: "Masuk dulu dengan akun guru untuk mengambil proyek." }, { status: 401 });
  if (sesi.wajibGanti) return NextResponse.json({ error: "Ganti password sementara dulu." }, { status: 403 });
  if (!canWrite()) return NextResponse.json({ error: "Pengambilan sedang tidak bisa disimpan. Hubungi admin." }, { status: 503 });
  try {
    const body = await req.json();
    const [board, guruDb] = await Promise.all([getBoard(), getTeachers()]);
    if (board.source !== "live") return NextResponse.json({ error: "Data proyek belum tersambung. Coba lagi nanti." }, { status: 503 });
    const g = (guruDb.rows || []).find((x) => x.idGuru && x.idGuru === sesi.akun.idGuru);
    const guru = { idGuru: sesi.akun.idGuru || g?.idGuru || "", nama: g?.nama || sesi.akun.nama || sesi.akun.email, email: sesi.akun.email };
    return NextResponse.json({ ok: true, ...(await ajukan(guru, body.items, board)) });
  } catch (e) {
    if (!e.status) console.error("ambil proyek:", e);
    return NextResponse.json({ error: e.message || "Gagal mengajukan." }, { status: e.status || 500 });
  }
}
