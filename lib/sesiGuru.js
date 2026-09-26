// ============================================================================
//  Sesi login guru — cookie bertanda tangan HMAC (runtime Node).
//
//  Isi cookie: email, "versi" password, dan kedaluwarsa. Versi = potongan
//  hash dari hash password, jadi begitu password diganti atau DI-RESET admin,
//  semua sesi lama otomatis tidak berlaku. Status akun (Nonaktif) diperiksa
//  langsung ke spreadsheet tiap halaman dibuka — bukan hanya di middleware.
// ============================================================================

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cariAkun, STATUS } from "./akun";

export const COOKIE_GURU = "gf_guru";
const UMUR_DETIK = 60 * 60 * 24 * 30; // 30 hari — aplikasi di HP jarang perlu login ulang

/** Rahasia penanda tangan. Wajib di produksi; di komputer pengembang ada cadangan. */
export function rahasiaSesi() {
  const r = (process.env.GURU_SESSION_SECRET || "").trim();
  if (r.length >= 32) return r;
  return process.env.NODE_ENV === "production" ? null : "rahasia-lokal-khusus-pengembangan-jangan-dipakai";
}
export const loginGuruSiap = () => Boolean(rahasiaSesi());

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const tanda = (isi, r) => crypto.createHmac("sha256", r).update(isi).digest();
export const versiDari = (hash) => crypto.createHash("sha256").update(String(hash)).digest("base64url").slice(0, 16);

export function buatToken(akun) {
  const r = rahasiaSesi();
  if (!r) throw new Error("GURU_SESSION_SECRET belum diset.");
  const isi = b64(JSON.stringify({ e: akun.email, v: versiDari(akun.hash), x: Date.now() + UMUR_DETIK * 1000 }));
  return `${isi}.${b64(tanda(isi, r))}`;
}

export function bacaToken(token) {
  const r = rahasiaSesi();
  if (!r || !token || typeof token !== "string") return null;
  const [isi, sig] = token.split(".");
  if (!isi || !sig) return null;
  const harap = tanda(isi, r);
  const dapat = Buffer.from(sig, "base64url");
  if (dapat.length !== harap.length || !crypto.timingSafeEqual(dapat, harap)) return null;
  try {
    const p = JSON.parse(Buffer.from(isi, "base64url").toString("utf8"));
    return p.x > Date.now() ? p : null;
  } catch (_) {
    return null;
  }
}

export const opsiCookie = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: UMUR_DETIK,
});

/**
 * Guru yang sedang login (untuk server component / route), atau null.
 * Sesi dianggap tidak sah bila akunnya sudah tidak Aktif atau passwordnya
 * sudah berganti sejak sesi dibuat.
 */
export async function sesiGuru() {
  const p = bacaToken(cookies().get(COOKIE_GURU)?.value);
  if (!p) return null;
  let akun = null;
  try {
    akun = await cariAkun(p.e);
  } catch (e) {
    console.error("sesi guru:", e.message);
    return null;
  }
  if (!akun || akun.status !== STATUS.aktif || !akun.hash || versiDari(akun.hash) !== p.v) return null;
  return { akun, wajibGanti: akun.wajibGanti };
}

/** Tolak POST dari situs lain (lapisan tambahan di atas cookie SameSite=Lax). */
export function asalSah(req) {
  const asal = req.headers.get("origin");
  return !asal || asal === req.nextUrl.origin;
}
