// Login guru: email + password -> cookie sesi bertanda tangan.
import { NextResponse } from "next/server";
import { cariAkun, ubahAkun, waktuWib, STATUS, MAKS_GAGAL, LAMA_KUNCI_MENIT } from "@/lib/akun";
import { cocokPassword } from "@/lib/sandi";
import { buatToken, COOKIE_GURU, opsiCookie, loginGuruSiap, asalSah } from "@/lib/sesiGuru";

export const dynamic = "force-dynamic";

const ke = (req, path) => NextResponse.redirect(new URL(path, req.nextUrl.origin), { status: 303 });
const gagal = (req, kode, email) => ke(req, `/open/masuk?error=${kode}${email ? "&email=" + encodeURIComponent(email) : ""}`);

export async function POST(req) {
  if (!asalSah(req)) return new NextResponse("Asal permintaan tidak sah.", { status: 403 });
  if (!loginGuruSiap()) return gagal(req, "belum-aktif");

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const pw = String(form.get("password") || "");
  if (!email || !pw) return gagal(req, "kosong", email);

  let akun;
  try {
    akun = await cariAkun(email, { segar: true });
  } catch (e) {
    console.error("login guru:", e.message);
    return gagal(req, "server", email);
  }
  const bisa = akun && akun.hash && akun.status === STATUS.aktif;

  // Dikunci sementara setelah terlalu banyak salah — mencegah tebak password.
  const kunci = bisa && akun.terkunciSampai ? Date.parse(akun.terkunciSampai) : 0;
  if (kunci && kunci > Date.now()) return gagal(req, "terkunci", email);

  // Tetap menghitung hash walau email tak dikenal: lama respons tidak boleh
  // membedakan email terdaftar dan tidak.
  const benar = await cocokPassword(pw, bisa ? akun.hash : null);
  if (!benar) {
    if (bisa) {
      const n = akun.gagal + 1;
      await ubahAkun(akun.row, n >= MAKS_GAGAL
        ? { gagal: 0, terkunciSampai: new Date(Date.now() + LAMA_KUNCI_MENIT * 60000).toISOString() }
        : { gagal: n, terkunciSampai: "" }).catch(() => {});
      if (n >= MAKS_GAGAL) return gagal(req, "terkunci", email);
    }
    return gagal(req, "salah", email);
  }

  await ubahAkun(akun.row, { loginTerakhir: waktuWib(), gagal: 0, terkunciSampai: "" }).catch(() => {});
  const res = ke(req, akun.wajibGanti ? "/open/ganti-password" : "/open");
  res.cookies.set(COOKIE_GURU, buatToken(akun), opsiCookie());
  return res;
}
