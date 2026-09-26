// Ganti password guru. Saat wajib ganti (baru masuk dengan password dari
// admin) password lama tidak ditanya lagi — ia baru saja dibuktikan saat login.
import { NextResponse } from "next/server";
import { ubahAkun, waktuWib } from "@/lib/akun";
import { cocokPassword, hashPassword, cekPasswordBaru } from "@/lib/sandi";
import { sesiGuru, buatToken, COOKIE_GURU, opsiCookie, asalSah } from "@/lib/sesiGuru";

export const dynamic = "force-dynamic";

const ke = (req, path) => NextResponse.redirect(new URL(path, req.nextUrl.origin), { status: 303 });

export async function POST(req) {
  if (!asalSah(req)) return new NextResponse("Asal permintaan tidak sah.", { status: 403 });
  const sesi = await sesiGuru();
  if (!sesi) return ke(req, "/open/masuk?error=sesi");
  const { akun } = sesi;

  const form = await req.formData();
  const lama = String(form.get("lama") || "");
  const baru = String(form.get("baru") || "");
  const ulang = String(form.get("ulang") || "");
  const salah = (pesan) => ke(req, "/open/ganti-password?error=" + encodeURIComponent(pesan));

  if (!akun.wajibGanti && !(await cocokPassword(lama, akun.hash))) return salah("Password lama salah.");
  const cek = cekPasswordBaru(baru, { ulang, email: akun.email });
  if (cek) return salah(cek);
  if (await cocokPassword(baru, akun.hash)) return salah("Password baru harus berbeda dari password sebelumnya.");

  const hash = await hashPassword(baru);
  await ubahAkun(akun.row, { hash, wajibGanti: false, diubah: waktuWib() });
  const res = ke(req, "/open?password=diganti");
  // versi password berubah -> sesi lama tidak berlaku; beri sesi baru
  res.cookies.set(COOKIE_GURU, buatToken({ ...akun, hash }), opsiCookie());
  return res;
}
