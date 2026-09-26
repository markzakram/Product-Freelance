// ============================================================================
//  Password guru — hanya dipakai di server (runtime Node).
//
//  Disimpan sebagai HASH scrypt bergaram, tidak pernah teks asli: siapa pun
//  yang bisa membuka spreadsheet tetap tidak bisa membaca password guru.
//  Format: scrypt$N$r$p$<garam base64>$<hash base64> — parameter ikut
//  disimpan supaya bisa dinaikkan kelak tanpa membuat hash lama tak terbaca.
// ============================================================================

import crypto from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const PANJANG = 32;

function scrypt(pw, garam, n = N, r = R, p = P) {
  return new Promise((ok, gagal) =>
    crypto.scrypt(pw.normalize("NFKC"), garam, PANJANG, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? gagal(e) : ok(k)))
  );
}

export async function hashPassword(pw) {
  const garam = crypto.randomBytes(16);
  const k = await scrypt(String(pw), garam);
  return `scrypt$${N}$${R}$${P}$${garam.toString("base64")}$${k.toString("base64")}`;
}

// Dipakai saat email tidak dikenal, supaya waktu respons sama dengan email
// yang ada — kalau tidak, lamanya respons membocorkan email mana yang terdaftar.
const HASH_PALSU = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export async function cocokPassword(pw, tersimpan) {
  const bagian = String(tersimpan || HASH_PALSU).split("$");
  if (bagian.length !== 6 || bagian[0] !== "scrypt") return false;
  const [, n, r, p, g, h] = bagian;
  const harap = Buffer.from(h, "base64");
  const k = await scrypt(String(pw), Buffer.from(g, "base64"), Number(n), Number(r), Number(p));
  return tersimpan ? harap.length === k.length && crypto.timingSafeEqual(harap, k) : false;
}

// Tanpa huruf/angka yang mudah tertukar saat dibaca dari WhatsApp (0/O, 1/l/I).
const ABJAD = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Password sementara acak dari admin — wajib diganti guru saat pertama masuk. */
export function passwordAcak(panjang = 10) {
  let s = "";
  // pastikan ada huruf besar, huruf kecil, dan angka
  while (!(/[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s))) {
    s = Array.from({ length: panjang }, () => ABJAD[crypto.randomInt(ABJAD.length)]).join("");
  }
  return s;
}

/** Aturan password baru buatan guru. Mengembalikan pesan salah, atau "" bila sah. */
export function cekPasswordBaru(baru, { ulang, email } = {}) {
  const pw = String(baru || "");
  if (pw.length < 8) return "Password minimal 8 karakter.";
  if (pw.length > 72) return "Password maksimal 72 karakter.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password harus berisi huruf dan angka.";
  const namaEmail = String(email || "").split("@")[0].toLowerCase();
  if (namaEmail.length >= 4 && pw.toLowerCase().includes(namaEmail)) return "Password jangan memuat nama email Anda.";
  if (ulang !== undefined && pw !== ulang) return "Ulangi password tidak sama.";
  return "";
}
