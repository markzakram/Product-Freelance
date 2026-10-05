// ============================================================================
//  ATURAN PROYEK — pengaturan per baris katalog yang tidak punya kolom di
//  sheet bulanan: deadline (tanggal tetap) dan, nanti, titik lapor progres.
//  Tab "Aturan proyek": satu baris per (bulan, ID proyek). Sheet bulanan
//  tidak diubah. Diisi tim akademik dari halaman Katalog.
// ============================================================================

import { namaTab, bacaBaris, tambahBaris, ubahBaris, pastikanTab } from "./tabSheet";
import { norm } from "./format";
import { waktuWib } from "./akun";

export const TAB_ATURAN = namaTab("Aturan proyek", "TAB_ATURAN_PROYEK");
const H = ["Bulan", "ID proyek", "Deadline", "Lapor progres (%)", "Diubah", "Oleh"];
const kunci = (bulan, id) => `${norm(bulan)}|${norm(id).toUpperCase()}`;

let cache = null;
const lupakan = () => (cache = null);

/** Map "bulan|ID PROYEK" -> { row, deadline (yyyy-mm-dd), lapor, diubah, oleh }. */
export async function bacaAturan() {
  if (cache && Date.now() - cache.at < 15000) return cache.janji;
  const janji = bacaBaris(TAB_ATURAN, H, 3000).then((rows) => {
    const m = new Map();
    rows.forEach(({ row, v }) => {
      if (!norm(v[0]) || !norm(v[1])) return;
      const dl = norm(v[2]);
      m.set(kunci(v[0], v[1]), { row, deadline: /^\d{4}-\d{2}-\d{2}$/.test(dl) ? dl : "", lapor: parseInt(norm(v[3]), 10) || 0, diubah: norm(v[4]), oleh: norm(v[5]) });
    });
    return m;
  });
  cache = { at: Date.now(), janji };
  try {
    return await janji;
  } catch (e) {
    if (cache?.janji === janji) cache = null;
    throw e;
  }
}

/** Aturan satu bulan sebagai objek polos { "P10-03": { deadline, lapor } } untuk browser. */
export async function aturanBulan(bulan) {
  const m = await bacaAturan();
  const awal = norm(bulan) + "|";
  const out = {};
  m.forEach((v, k) => k.startsWith(awal) && (out[k.slice(awal.length)] = { deadline: v.deadline, lapor: v.lapor }));
  return out;
}

export async function deadlineProyek(bulan, idProyek) {
  return (await bacaAturan()).get(kunci(bulan, idProyek))?.deadline || "";
}

/** Simpan deadline (yyyy-mm-dd, atau "" untuk menghapus). */
export async function aturDeadline(bulan, idProyek, deadline, oleh) {
  const dl = norm(deadline);
  if (dl && !/^\d{4}-\d{2}-\d{2}$/.test(dl)) throw new Error("Format deadline harus yyyy-mm-dd.");
  if (!norm(bulan) || !norm(idProyek)) throw new Error("Bulan dan ID proyek wajib.");
  await pastikanTab(TAB_ATURAN, H, { cekJudul: true });
  lupakan();
  const ada = (await bacaAturan()).get(kunci(bulan, idProyek));
  if (ada) await ubahBaris(TAB_ATURAN, ada.row, { 2: dl, 4: waktuWib(), 5: norm(oleh).slice(0, 80) });
  else await tambahBaris(TAB_ATURAN, H, [[norm(bulan), norm(idProyek).toUpperCase(), dl, "", waktuWib(), norm(oleh).slice(0, 80)]]);
  lupakan();
  return { idProyek: norm(idProyek).toUpperCase(), deadline: dl };
}
