// Tautan publik yang dipakai di beberapa halaman.

/** Google Form "Pendataan Guru Freelance PT.Cerebrum" — pintu pendaftaran guru baru. */
export const FORM_DAFTAR =
  "https://docs.google.com/forms/d/e/1FAIpQLSdESBDdyAEaQfk7WllFk57qVb5_Kslm1zoi04wwL3OOLN1BJg/viewform";

/** Nomor WhatsApp Admin Akademik (format 62…). */
export const WA_ADMIN = process.env.NEXT_PUBLIC_WA_NUMBER || "6285117248323";

/** Tautan wa.me dengan pesan siap kirim. `nomor` boleh 08…/+62…/62…. */
export function tautanWa(nomor, pesan = "") {
  let n = String(nomor || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  return `https://wa.me/${n}${pesan ? "?text=" + encodeURIComponent(pesan) : ""}`;
}
