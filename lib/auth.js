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
