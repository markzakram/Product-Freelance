// Cek sesi admin di DALAM route/halaman (runtime Node) — lapis kedua di
// belakang middleware. Seluruh area admin dulu hanya bergantung pada
// middleware, padahal Next.js beberapa kali punya celah "middleware bypass".
//
// v3.0.0: selain password internal (= Pemilik), anggota tim masuk dengan
// akun sendiri (lib/akunTim.js). Sesi tim diperiksa ulang ke spreadsheet:
// akun Nonaktif atau password yang sudah diganti/di-reset langsung tidak sah.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, COOKIE_TIM, tokenFor, passwordConfigured, bolehTanpaPassword, bacaTokenTim, versiHash } from "./auth";
import { cariAkunTim, STATUS_TIM } from "./akunTim";

const PEMILIK = { email: "", nama: "Pemilik", peran: ["Pemilik"], pemilik: true, wajibGanti: false, akunTim: false };

/** Siapa yang sedang login: { email, nama, peran[], pemilik, wajibGanti, akunTim } atau null. */
export async function sesiAdmin() {
  if (!passwordConfigured()) return bolehTanpaPassword() ? { ...PEMILIK, nama: "Pengembang" } : null;
  const c = cookies();
  const pemilik = c.get(COOKIE)?.value;
  if (pemilik && pemilik === (await tokenFor(process.env.INTERNAL_PASSWORD))) return PEMILIK;
  const p = await bacaTokenTim(c.get(COOKIE_TIM)?.value);
  if (!p) return null;
  // Gagal membaca tab Akun tim (kuota/gangguan) DILEMPAR, bukan null: itu
  // "belum bisa diperiksa", bukan "sesi tidak sah" — jangan sampai semua orang
  // terlihat ter-logout hanya karena Google sedang sibuk.
  let a = null;
  try {
    a = await cariAkunTim(p.e);
  } catch (e) {
    console.error("sesi tim:", String(e.message).slice(0, 160));
    throw new Error("Akun tim belum bisa diperiksa: Google Sheets sedang sibuk. Coba lagi sebentar lagi.");
  }
  if (!a || a.status !== STATUS_TIM.aktif || !a.hash || !a.peran.length || (await versiHash(a.hash)) !== p.v) return null;
  return { email: a.email, nama: a.nama || a.email, peran: a.peran, pemilik: a.peran.includes("Pemilik"), wajibGanti: a.wajibGanti, akunTim: true };
}

export async function adminSah() {
  return Boolean(await sesiAdmin().catch(() => null));
}

/** Boleh mengakses bagian untuk `peran` (kosong = semua anggota tim)? Pemilik selalu boleh. */
export const bolehPeran = (sesi, peran = []) => Boolean(sesi) && (sesi.pemilik || !peran.length || peran.some((x) => sesi.peran.includes(x)));

/**
 * Untuk route API. Mengembalikan { sesi } bila boleh, atau { tolak } berisi
 * respons 401 (belum login) / 403 (peran tidak cocok / password belum diganti).
 */
export async function izinAdmin(peran = []) {
  let sesi;
  try {
    sesi = await sesiAdmin();
  } catch (e) {
    return { tolak: NextResponse.json({ error: e.message }, { status: 503 }) };
  }
  if (!sesi) return { tolak: NextResponse.json({ error: "Sesi berakhir. Silakan login ulang." }, { status: 401 }) };
  if (sesi.wajibGanti) return { tolak: NextResponse.json({ error: "Ganti password sementara Anda dulu." }, { status: 403 }) };
  if (!bolehPeran(sesi, peran)) return { tolak: NextResponse.json({ error: `Bagian ini khusus tim ${peran.join(" / ")}.` }, { status: 403 }) };
  return { sesi };
}

/** Bentuk lama: NextResponse penolakan, atau null bila boleh. */
export async function tolakBukanAdmin(peran = []) {
  return (await izinAdmin(peran)).tolak || null;
}
