// Tautan publik yang dipakai di beberapa halaman.
import { MODE_DEMO } from "./demo";

/** Google Form "Pendataan Guru Freelance PT.Cerebrum" — pintu pendaftaran guru baru. */
// Di mode demo tidak ditautkan: isian form asli akan masuk ke data pendaftar ASLI.
export const FORM_DAFTAR = MODE_DEMO
  ? "/demo/daftar"
  : "https://docs.google.com/forms/d/e/1FAIpQLSdESBDdyAEaQfk7WllFk57qVb5_Kslm1zoi04wwL3OOLN1BJg/viewform";

/** Nomor WhatsApp Admin Akademik (format 62…). */
export const WA_ADMIN = process.env.NEXT_PUBLIC_WA_NUMBER || "6285117248323";

/**
 * Satu nomor dari isian yang kadang berisi beberapa nomor sekaligus, mis.
 * "+66935396803/+6285867…" — diambil nomor PERTAMA (minimal 8 digit).
 * Tanpa ini semua digit tergabung jadi satu nomor yang tidak ada.
 */
export function nomorPertama(isian) {
  const bagian = String(isian || "").split(/[/,;|\n]|\s+(?:atau|or|dan)\s+/i);
  return (bagian.find((b) => b.replace(/\D/g, "").length >= 8) || bagian[0] || "").trim();
}

/** Tautan wa.me dengan pesan siap kirim. `nomor` boleh 08…/+62…/62…/nomor luar negeri. */
export function tautanWa(nomor, pesan = "") {
  let n = nomorPertama(nomor).replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  // mode demo: pesan hanya dipratinjau, tidak pernah benar-benar terkirim
  if (MODE_DEMO) return `/demo/wa?ke=${n}${pesan ? "&pesan=" + encodeURIComponent(pesan) : ""}`;
  return `https://wa.me/${n}${pesan ? "?text=" + encodeURIComponent(pesan) : ""}`;
}
