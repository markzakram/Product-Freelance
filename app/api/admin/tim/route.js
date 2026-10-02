// Kelola akun tim (khusus Pemilik). Hash password tidak pernah dikirim ke
// browser; password sementara hanya muncul sekali di respons buat/reset.
import { NextResponse } from "next/server";
import { izinAdmin } from "@/lib/authServer";
import { canWrite } from "@/lib/gauth";
import { loginTimSiap } from "@/lib/auth";
import { bacaAkunTim, akunTimPublik, buatAkunTim, resetAkunTim, aturAkunTim, rapikanPeran, STATUS_TIM, TAB_TIM } from "@/lib/akunTim";

export const dynamic = "force-dynamic";

export async function GET() {
  const { tolak } = await izinAdmin(["Pemilik"]);
  if (tolak) return tolak;
  try {
    const anggota = (await bacaAkunTim({ segar: true })).map(akunTimPublik);
    return NextResponse.json({ anggota, tab: TAB_TIM, loginSiap: loginTimSiap(), canWrite: canWrite() });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal membaca akun tim." }, { status: 500 });
  }
}

export async function POST(req) {
  const { sesi, tolak } = await izinAdmin(["Pemilik"]);
  if (tolak) return tolak;
  if (!canWrite()) return NextResponse.json({ error: "Mode baca-saja: butuh service account dengan akses Editor." }, { status: 403 });
  try {
    const body = await req.json();
    const diriSendiri = sesi.akunTim && String(body.email || "").trim().toLowerCase() === sesi.email;
    switch (body.action) {
      case "buat":
        return NextResponse.json({ ok: true, akun: await buatAkunTim(body) });
      case "reset":
        return NextResponse.json({ ok: true, akun: await resetAkunTim(body.email) });
      case "atur":
        // jangan sampai pemilik mengunci dirinya sendiri dari halaman ini
        if (diriSendiri && (body.status === STATUS_TIM.nonaktif || (body.peran !== undefined && !rapikanPeran(body.peran).includes("Pemilik"))))
          return NextResponse.json({ error: "Tidak bisa menonaktifkan atau mencabut peran Pemilik dari akun Anda sendiri." }, { status: 400 });
        await aturAkunTim(body.email, body);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan." }, { status: 400 });
  }
}
