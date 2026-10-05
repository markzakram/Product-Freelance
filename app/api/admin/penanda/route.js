// Penanda guru yang dipasang tim (mis. "Bisa liveclass") — tim Seleksi & Akademik.
import { NextResponse } from "next/server";
import { izinAdmin } from "@/lib/authServer";
import { canWrite } from "@/lib/gauth";
import { getTeachers } from "@/lib/teachers";
import { aturLiveclass } from "@/lib/penandaGuru";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { sesi, tolak } = await izinAdmin(["Seleksi", "Akademik"]);
  if (tolak) return tolak;
  if (!canWrite()) return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  try {
    const body = await req.json();
    // hanya guru yang ada di Data guru freelance (daftar "Akun guru")
    const g = ((await getTeachers()).rows || []).find((x) => String(x.idGuru) === String(body.idGuru || "").trim());
    if (!g) return NextResponse.json({ error: "Guru dengan ID itu tidak ada di Data guru freelance." }, { status: 400 });
    return NextResponse.json({ ok: true, penanda: await aturLiveclass(g.idGuru, { nama: g.nama, liveclass: Boolean(body.liveclass) }, sesi.nama) });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 400 });
  }
}
