// Lightweight auth shared by middleware (edge) and API routes (node).
// crypto.subtle is available in both the Edge runtime and Node 18+.
export const COOKIE = "gf_auth";

export async function tokenFor(pw) {
  const data = new TextEncoder().encode("guru-freelance:" + pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function passwordConfigured() {
  return Boolean(process.env.INTERNAL_PASSWORD && process.env.INTERNAL_PASSWORD.length);
}

// Tanpa password, area internal HANYA boleh terbuka di komputer pengembang.
// Di produksi, password yang kosong/tak terbaca berarti TOLAK — bukan buka.
// Aturan lama ("tanpa password = pratinjau terbuka") dua kali membuka /admin
// ke publik saat env var di Vercel belum/terisi salah, termasuk sekali ketika
// kredensial Google sudah aktif: 59 guru beserta rekeningnya terbaca siapa saja.
export function bolehTanpaPassword() {
  return process.env.NODE_ENV !== "production";
}

// ============================================================================
//  SESI TIM (v3.0.0) — anggota tim Seleksi / Akademik / Pemilik masuk dengan
//  email + password masing-masing (tab "Akun tim", lib/akunTim.js). Cookie
//  bertanda tangan HMAC lewat Web Crypto supaya bisa diperiksa di middleware
//  (edge) maupun di route (node). Password internal lama tetap berlaku
//  sebagai login Pemilik (cookie COOKIE di atas).
// ============================================================================
export const COOKIE_TIM = "gf_tim";
export const UMUR_TIM_DETIK = 60 * 60 * 12; // 12 jam, sama dengan login pemilik
export const PERAN = ["Pemilik", "Seleksi", "Akademik"];

/** Kunci tanda tangan: rahasia sesi + password internal (ganti salah satunya = semua sesi tim batal). */
export function rahasiaTim() {
  const r = (process.env.GURU_SESSION_SECRET || "").trim();
  const dasar = r.length >= 32 ? r : process.env.NODE_ENV === "production" ? "" : "rahasia-lokal-khusus-pengembangan-jangan-dipakai";
  return dasar ? `${dasar}|tim|${process.env.INTERNAL_PASSWORD || ""}` : null;
}
export const loginTimSiap = () => Boolean(rahasiaTim());

const enc = new TextEncoder();
const keB64 = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const dariB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const kunciHmac = (r) => crypto.subtle.importKey("raw", enc.encode(r), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** Potongan hash dari hash password: berubah saat password diganti/di-reset -> sesi lama batal. */
export async function versiHash(hash) {
  return keB64(await crypto.subtle.digest("SHA-256", enc.encode(String(hash)))).slice(0, 16);
}

export async function buatTokenTim({ email, hash }) {
  const r = rahasiaTim();
  if (!r) throw new Error("GURU_SESSION_SECRET belum diset.");
  const isi = keB64(enc.encode(JSON.stringify({ e: email, v: await versiHash(hash), x: Date.now() + UMUR_TIM_DETIK * 1000 })));
  const sig = await crypto.subtle.sign("HMAC", await kunciHmac(r), enc.encode(isi));
  return `${isi}.${keB64(sig)}`;
}

/** Isi token bila tanda tangan sah & belum kedaluwarsa; null bila tidak. */
export async function bacaTokenTim(token) {
  const r = rahasiaTim();
  if (!r || !token || typeof token !== "string") return null;
  const [isi, sig] = token.split(".");
  if (!isi || !sig) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await kunciHmac(r), dariB64(sig), enc.encode(isi)))) return null;
    const p = JSON.parse(new TextDecoder().decode(dariB64(isi)));
    return p && p.e && p.x > Date.now() ? p : null;
  } catch (_) {
    return null;
  }
}

export const opsiCookieTim = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: UMUR_TIM_DETIK,
});
