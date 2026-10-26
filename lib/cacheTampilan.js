import crypto from "node:crypto";
import { unstable_cache, revalidateTag } from "next/cache";

// Data Cache Next dipakai bersama antarpembaca. Izin/sesi SELALU diperiksa
// di luar cache; hasil ini hanya untuk GET tampilan, bukan validasi penulisan.
const lingkup = crypto.createHash("sha256").update(JSON.stringify([
  process.env.SHEET_ID_MASTER, process.env.SHEET_ID_PENDAFTARAN,
  process.env.NEXT_PUBLIC_DEMO_MODE, process.env.PROYEK_BULAN,
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON, process.env.GOOGLE_SHEETS_API_KEY,
])).digest("hex").slice(0, 24);
const TAG = `tampilan-sheets-${lingkup}`;
const tagGrup = (g) => `${TAG}:grup:${g}`;
const tagKunci = (k) => `${TAG}:kunci:${k}`;

// Umur cache (detik). Simpan lewat dashboard tetap langsung terlihat karena
// kelompok tab yang ditulis diinvalidasi (lib/grupCache.js); umur hanya
// membatasi seberapa lambat perubahan yang diketik langsung di spreadsheet.
// Kuota Google: 60 pembacaan/menit untuk satu service account, dipakai bersama
// admin, halaman guru, dan pengecekan akun.
export const UMUR = { harian: 30, reachout: 60, jarang: 300 };

/** Tanpa `grup` = hapus semua cache tampilan; dengan `grup` = hanya kelompok itu. */
export function hapusCacheTampilan(grup) {
  // Kegagalan invalidasi tidak boleh mengubah tulisan sukses menjadi gagal.
  try {
    if (!grup?.length) revalidateTag(TAG);
    else grup.forEach((g) => revalidateTag(tagGrup(g)));
  } catch { console.warn("[sheets-cache] invalidasi belum tersedia"); }
}
export function hapusKunciTampilan(kunci) {
  try { revalidateTag(tagKunci(kunci)); } catch { console.warn("[sheets-cache] invalidasi belum tersedia"); }
}

// Data terakhir yang berhasil dibaca di server ini: dipakai saat Google menolak
// (kuota penuh / gangguan) supaya tampilan tetap ada, ditandai `tertunda`.
const terakhirBaik = new Map();

/**
 * `grup`: kelompok tab yang dibaca (penulisan ke kelompok itu menghapus cache ini).
 * `umur`: detik. `segar`: baca langsung (tombol Segarkan / sesudah menyimpan) —
 * hanya entri ini yang dihapus, bukan seluruh cache.
 */
export async function bacaTampilan(kunci, baca, { segar = false, grup = [], umur = UMUR.harian } = {}) {
  const ambil = async () => {
    const at = Date.now();
    const data = await baca();
    if (data?.error || data?.source === "error") throw new Error(data.error || "Data spreadsheet belum dapat dibaca.");
    return { ...data, at };
  };
  const berhasil = (data) => {
    if (!(terakhirBaik.get(kunci)?.at > data.at)) terakhirBaik.set(kunci, data);
    return { ...data, tertunda: false };
  };
  const cadangan = (e) => {
    const lama = terakhirBaik.get(kunci);
    if (!lama) throw e;
    console.warn("[sheets-cache]", JSON.stringify({ kunci, hasil: "data-terakhir", umurDetik: Math.round((Date.now() - lama.at) / 1000) }));
    return { ...lama, tertunda: true };
  };
  if (segar) {
    hapusKunciTampilan(kunci);
    try { return berhasil(await ambil()); } catch (e) { return cadangan(e); }
  }
  let data;
  try {
    data = await unstable_cache(ambil, ["tampilan-sheets-v2", lingkup, kunci], { revalidate: umur, tags: [TAG, tagKunci(kunci), ...grup.map(tagGrup)] })();
  } catch (e) {
    return cadangan(e);
  }
  // Lama tidak ada yang membuka: cache menyajikan data basi sekali sambil
  // memperbarui di belakang. Jangan tampilkan yang sudah jauh basi — baca sekarang.
  if (Date.now() - data.at > umur * 2000 + 30000) {
    try { return berhasil(await ambil()); } catch { return { ...(terakhirBaik.get(kunci)?.at > data.at ? terakhirBaik.get(kunci) : data), tertunda: true }; }
  }
  return berhasil(data);
}
