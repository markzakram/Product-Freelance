// Profil satu guru untuk admin: data form, riwayat semua bulan, akun, seleksi, ajuan perubahan.
import { NextResponse } from "next/server";
import { tolakBukanAdmin } from "@/lib/authServer";
import { dataProfil } from "@/lib/profilGuru";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const bukan = await tolakBukanAdmin();
  if (bukan) return bukan;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID guru kosong." }, { status: 400 });
  try {
    return NextResponse.json(await dataProfil(id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
}
