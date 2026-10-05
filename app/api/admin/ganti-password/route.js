// Ganti password anggota tim. Saat wajib ganti (baru masuk dengan password
// sementara) password lama tidak ditanya — ia baru saja dibuktikan saat login.
import { NextResponse } from "next/server";
import { sesiAdmin } from "@/lib/authServer";
import { COOKIE_TIM, buatTokenTim, opsiCookieTim } from "@/lib/auth";
import { cariAkunTim, ubahAkunTim } from "@/lib/akunTim";
import { waktuWib } from "@/lib/akun";
import { cocokPassword, hashPassword, cekPasswordBaru } from "@/lib/sandi";
import { MODE_DEMO, EMAIL_DEMO } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const ke = (path) => NextResponse.redirect(new URL(path, req.nextUrl.origin), { status: 303 });
  const asal = req.headers.get("origin");
  if (asal && asal !== req.nextUrl.origin) return new NextResponse("Asal permintaan tidak sah.", { status: 403 });
  const sesi = await sesiAdmin().catch(() => null);
  if (!sesi) return ke("/admin/login?error=sesi");
  if (!sesi.akunTim) return ke("/admin");
  if (MODE_DEMO && EMAIL_DEMO.has(sesi.email)) return ke("/admin/ganti-password?error=" + encodeURIComponent("Mode demo: password akun contoh tidak bisa diganti (dipakai bersama)."));
  const akun = await cariAkunTim(sesi.email, { segar: true }).catch(() => null);
  if (!akun) return ke("/admin/ganti-password?error=" + encodeURIComponent("Server sedang bermasalah. Coba lagi sebentar lagi."));

  const form = await req.formData();
  const lama = String(form.get("lama") || "");
  const baru = String(form.get("baru") || "");
  const ulang = String(form.get("ulang") || "");
  const salah = (pesan) => ke("/admin/ganti-password?error=" + encodeURIComponent(pesan));

  if (!akun.wajibGanti && !(await cocokPassword(lama, akun.hash))) return salah("Password lama salah.");
  const cek = cekPasswordBaru(baru, { ulang, email: akun.email });
  if (cek) return salah(cek);
  if (await cocokPassword(baru, akun.hash)) return salah("Password baru harus berbeda dari password sebelumnya.");

  const hash = await hashPassword(baru);
  try {
    await ubahAkunTim(akun.row, { hash, wajibGanti: false, diubah: waktuWib() });
  } catch (e) {
    console.error("ganti password tim:", e.message);
    return salah("Server sedang bermasalah, password belum tersimpan. Coba lagi sebentar lagi.");
  }
  const res = ke("/admin");
  // versi password berubah -> sesi lama tidak berlaku; beri sesi baru
  res.cookies.set(COOKIE_TIM, await buatTokenTim({ ...akun, hash }), opsiCookieTim());
  return res;
}
