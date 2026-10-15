// ============================================================================
//  SATUAN PENGAMBILAN — per soal (bawaan) atau per paket — dan TIPE pembuatan
//  (Latsol / TO). Diatur tim akademik per proyek di Katalog (tab "Aturan
//  proyek", kolom "Soal per paket" & "Tipe").
//  Dipakai server (validasi pengajuan) DAN browser (stepper guru), jadi
//  sengaja tanpa impor apa pun.
//
//  Harga tetap per soal (rumus Fee di sheet tidak berubah); harga paket hanya
//  tampilan = harga × isi paket. Review tetap per soal. Bila sisa kuota bukan
//  kelipatan isi paket, paket terakhir boleh lebih kecil (mis. sisa 25, isi 10
//  -> 2 paket @10 + 1 paket 5 soal).
// ============================================================================

// Tipe pembuatan per proyek (v3.8.0): untuk latihan soal atau tryout. Hanya
// label & saringan — tidak mengubah aturan lain (satuan, harga, review).
export const TIPE_PROYEK = ["Latsol", "TO"];
/** "latsol" / "to" / "Tryout" -> "Latsol" / "TO"; selain itu "". */
export function rapikanTipe(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "latsol" || s === "latihan soal") return "Latsol";
  if (s === "to" || s === "tryout" || s === "try out") return "TO";
  return "";
}

export const ISI_MIN = 2;
export const ISI_MAKS = 500;

/** Isi paket yang sah (2–500), atau 0 = per soal. */
export function isiPaket(v) {
  const n = parseInt(v, 10);
  return n >= ISI_MIN && n <= ISI_MAKS ? n : 0;
}

/** Banyak paket yang bisa diambil dari `sisa` soal (paket terakhir boleh lebih kecil). */
export const paketTersedia = (sisa, isi) => (isi && sisa > 0 ? Math.ceil(sisa / isi) : 0);

/** Jumlah soal untuk `k` paket dari `sisa` soal — paket terakhir berisi sisanya. */
export const soalDariPaket = (k, sisa, isi) => Math.max(0, Math.min(k * isi, sisa));

/** Banyak paket yang diwakili `jumlah` soal. */
export const paketDariSoal = (jumlah, isi) => (isi && jumlah > 0 ? Math.ceil(jumlah / isi) : 0);

/** Pesan galat bila `jumlah` tidak sah untuk proyek per paket; "" bila sah. */
export function cekJumlahPaket(jumlah, tersedia, isi) {
  if (!isi || jumlah % isi === 0 || jumlah === tersedia) return "";
  return `Proyek ini diambil per paket (${isi} soal/paket) — jumlahnya harus kelipatan ${isi} soal${tersedia % isi ? ` atau seluruh sisa ${tersedia} soal` : ""}.`;
}

/** "2 paket (20 soal)" untuk proyek per paket, "20 soal" untuk per soal. */
export const teksJumlah = (jumlah, isi) => (isi ? `${paketDariSoal(jumlah, isi)} paket (${jumlah} soal)` : `${jumlah} soal`);

/** Rincian paket dari sisa: "2 paket @10 soal + 1 paket 5 soal". */
export function rincianPaket(sisa, isi) {
  if (!isi || sisa <= 0) return "";
  const penuh = Math.floor(sisa / isi);
  const kurang = sisa % isi;
  return [penuh ? `${penuh} paket @${isi} soal` : "", kurang ? `1 paket ${kurang} soal` : ""].filter(Boolean).join(" + ");
}
