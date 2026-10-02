import { NextResponse } from "next/server";
import { COOKIE, COOKIE_TIM, tokenFor, passwordConfigured, bolehTanpaPassword, buatTokenTim, opsiCookieTim, loginTimSiap } from "@/lib/auth";
import { cariAkunTim, ubahAkunTim, STATUS_TIM } from "@/lib/akunTim";
import { waktuWib, MAKS_GAGAL, LAMA_KUNCI_MENIT } from "@/lib/akun";
import { cocokPassword } from "@/lib/sandi";

export const dynamic = "force-dynamic";

// Hanya jalur di dalam /admin yang boleh jadi tujuan setelah login.
const tujuanAman = (n) => (/^\/admin(\/|$|\?)/.test(n) && !n.startsWith("//") ? n : "/admin");

export async function POST(req) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const pw = String(form.get("password") || "");
  const next = tujuanAman(String(form.get("next") || "/admin"));
  const origin = req.nextUrl.origin;
  const ke = (path) => NextResponse.redirect(new URL(path, origin), { status: 303 });
  const gagal = (kode) => ke(`/admin/login?error=${kode}${email ? "&email=" + encodeURIComponent(email) : ""}`);

  if (!passwordConfigured()) {
    // Di produksi jangan pernah "meloloskan" — dulu ini langsung ke /admin.
    return ke(bolehTanpaPassword() ? next : "/admin/login?error=belum-diset");
  }

  // ---- Pemilik: tanpa email, password internal (cara masuk lama).
  if (!email) {
    if (pw && pw === process.env.INTERNAL_PASSWORD) {
      const res = ke(next);
      res.cookies.set(COOKIE, await tokenFor(pw), { ...opsiCookieTim() });
      res.cookies.set(COOKIE_TIM, "", { path: "/", maxAge: 0 });
      return res;
    }
    return gagal("1");
  }

  // ---- Anggota tim: email + password dari tab "Akun tim".
  if (!loginTimSiap()) return gagal("tim-belum-aktif");
  let akun;
  try {
    akun = await cariAkunTim(email, { segar: true });
  } catch (e) {
    console.error("login tim:", e.message);
    return gagal("server");
  }
  const bisa = akun && akun.hash && akun.status === STATUS_TIM.aktif && akun.peran.length;
  const kunci = bisa && akun.terkunciSampai ? Date.parse(akun.terkunciSampai) : 0;
  if (kunci && kunci > Date.now()) return gagal("terkunci");

  // Hash tetap dihitung walau email tak dikenal: lama respons tidak boleh
  // membedakan email terdaftar dan tidak.
  const benar = await cocokPassword(pw, bisa ? akun.hash : null);
  if (!benar) {
    if (bisa) {
      const n = akun.gagal + 1;
      await ubahAkunTim(
        akun.row,
        n >= MAKS_GAGAL ? { gagal: "0", terkunciSampai: new Date(Date.now() + LAMA_KUNCI_MENIT * 60000).toISOString() } : { gagal: String(n), terkunciSampai: "" }
      ).catch(() => {});
      if (n >= MAKS_GAGAL) return gagal("terkunci");
    }
    return gagal("salah");
  }

  await ubahAkunTim(akun.row, { loginTerakhir: waktuWib(), gagal: "0", terkunciSampai: "" }).catch(() => {});
  const res = ke(akun.wajibGanti ? "/admin/ganti-password" : next);
  res.cookies.set(COOKIE_TIM, await buatTokenTim(akun), opsiCookieTim());
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
