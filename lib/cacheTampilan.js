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
export function hapusCacheTampilan() {
  // Kegagalan invalidasi tidak boleh mengubah tulisan sukses menjadi gagal.
  try { revalidateTag(TAG); } catch { console.warn("[sheets-cache] invalidasi belum tersedia"); }
}
export async function bacaTampilan(kunci, baca, { segar = false } = {}) {
  const ambil = async () => {
    const at = Date.now();
    const data = await baca();
    if (data?.error || data?.source === "error") throw new Error(data.error || "Data spreadsheet belum dapat dibaca.");
    return { ...data, at };
  };
  if (segar) { hapusCacheTampilan(); return ambil(); }
  const data = await unstable_cache(ambil, ["tampilan-sheets-v1", lingkup, kunci], { revalidate: 15, tags: [TAG] })();
  return { ...data, tertunda: Date.now() - data.at > 45000 };
}
