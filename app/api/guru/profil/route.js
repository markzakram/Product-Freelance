// "Profil saya": guru mengubah datanya sendiri. Hanya baris miliknya
// (akun.idGuru); kolom sensitif masuk antrean persetujuan admin.
import { NextResponse } from "next/server";
import { sesiGuru, asalSah } from "@/lib/sesiGuru";
import { getTeachers } from "@/lib/teachers";
import { ajukanPerubahan } from "@/lib/perubahanGuru";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!asalSah(req)) return NextResponse.json({ error: "Asal permintaan tidak sah." }, { status: 403 });
  const sesi = await sesiGuru();
  if (!sesi || sesi.wajibGanti) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  const g = ((await getTeachers()).rows || []).find((x) => x.idGuru && x.idGuru === sesi.akun.idGuru);
  if (!g) return NextResponse.json({ error: "Data Anda tidak ditemukan di Database guru. Hubungi admin." }, { status: 404 });
  try {
    const body = await req.json();
    return NextResponse.json({ ok: true, ...(await ajukanPerubahan(g, body.isian || {})) });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 400 });
  }
}
