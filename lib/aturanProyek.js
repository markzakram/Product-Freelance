// ============================================================================
//  ATURAN PROYEK — pengaturan per baris katalog yang tidak punya kolom di
//  sheet bulanan: deadline dan tanggal lapor progres 30% / 50% (tanggal tetap,
//  sama untuk semua guru yang mengambil proyek itu).
//  Tab "Aturan proyek": satu baris per (bulan, ID proyek). Sheet bulanan
//  tidak diubah. Diisi tim akademik dari halaman Katalog.
// ============================================================================

import { namaTab, bacaBaris, tambahBaris, ubahBaris, pastikanTab } from "./tabSheet";
import { norm } from "./format";
import { waktuWib } from "./akun";

export const TAB_ATURAN = namaTab("Aturan proyek", "TAB_ATURAN_PROYEK");
// "Lapor progres (%)" = model v3.4.0 (persen tanpa tanggal) — tidak dipakai lagi sejak v3.6.0.
export const H = ["Bulan", "ID proyek", "Deadline", "Lapor progres (%)", "Diubah", "Oleh", "Lapor 30%", "Lapor 50%"];
const KOLOM_LAPOR = { 30: 6, 50: 7 };
export const kunciAturan = (bulan, id) => `${norm(bulan)}|${norm(id).toUpperCase()}`;
const kunci = kunciAturan;
const tglSah = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(norm(v)) ? norm(v) : "");

/** Titik lapor sebuah aturan: [{ persen: 30, tanggal: "2026-10-10" }, …] (yang bertanggal saja). */
export const titikDari = (a) => [30, 50].filter((n) => a?.[`lapor${n}`]).map((persen) => ({ persen, tanggal: a[`lapor${persen}`] }));

let cache = null;
const lupakan = () => (cache = null);
export const lupakanAturan = lupakan;

/** Map "bulan|ID PROYEK" -> { row, deadline, lapor30, lapor50 (yyyy-mm-dd), diubah, oleh }. */
export async function bacaAturan() {
  if (cache && Date.now() - cache.at < 15000) return cache.janji;
  const janji = bacaBaris(TAB_ATURAN, H, 3000).then((rows) => {
    const m = new Map();
    rows.forEach(({ row, v }) => {
      if (!norm(v[0]) || !norm(v[1])) return;
      m.set(kunci(v[0], v[1]), { row, deadline: tglSah(v[2]), lapor30: tglSah(v[6]), lapor50: tglSah(v[7]), diubah: norm(v[4]), oleh: norm(v[5]) });
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

/** Aturan satu bulan sebagai objek polos { "P10-03": { deadline, titik } } untuk browser. */
export async function aturanBulan(bulan) {
  const m = await bacaAturan();
  const awal = norm(bulan) + "|";
  const out = {};
  m.forEach((v, k) => k.startsWith(awal) && (out[k.slice(awal.length)] = { deadline: v.deadline, titik: titikDari(v) }));
  return out;
}

export async function deadlineProyek(bulan, idProyek) {
  return (await bacaAturan()).get(kunci(bulan, idProyek))?.deadline || "";
}

const galat = (pesan) => Object.assign(new Error(pesan), { status: 400 });

/**
 * Tanggal wajib lapor progres `persen` (30 / 50) untuk satu proyek, atau ""
 * untuk menghapus titik itu. Harus ≤ deadline, dan lapor 30% ≤ lapor 50%.
 */
export async function aturLapor(bulan, idProyek, persen, tanggal, oleh) {
  const n = parseInt(persen, 10);
  if (!KOLOM_LAPOR[n]) throw galat("Titik lapor progres hanya 30% atau 50%.");
  const tgl = norm(tanggal);
  if (tgl && !tglSah(tgl)) throw galat("Format tanggal lapor harus yyyy-mm-dd.");
  if (!norm(bulan) || !norm(idProyek)) throw galat("Bulan dan ID proyek wajib.");
  await pastikanTab(TAB_ATURAN, H, { cekJudul: true });
  lupakan();
  const ada = (await bacaAturan()).get(kunci(bulan, idProyek));
  if (tgl) {
    if (ada?.deadline && tgl > ada.deadline) throw galat(`Tanggal lapor ${n}% tidak boleh setelah deadline (${ada.deadline}).`);
    const lain = n === 30 ? ada?.lapor50 : ada?.lapor30;
    if (lain && (n === 30 ? tgl > lain : tgl < lain)) throw galat("Tanggal lapor 30% harus sebelum (atau sama dengan) tanggal lapor 50%.");
  }
  const isi = { [KOLOM_LAPOR[n]]: tgl, 4: waktuWib(), 5: norm(oleh).slice(0, 80) };
  if (ada) await ubahBaris(TAB_ATURAN, ada.row, isi);
  else {
    const baris = [norm(bulan), norm(idProyek).toUpperCase(), "", "", "", "", "", ""];
    Object.entries(isi).forEach(([i, v]) => (baris[i] = v));
    await tambahBaris(TAB_ATURAN, H, [baris]);
  }
  lupakan();
  return { idProyek: norm(idProyek).toUpperCase(), persen: n, tanggal: tgl };
}

/** Simpan deadline (yyyy-mm-dd, atau "" untuk menghapus). */
export async function aturDeadline(bulan, idProyek, deadline, oleh) {
  const dl = norm(deadline);
  if (dl && !tglSah(dl)) throw galat("Format deadline harus yyyy-mm-dd.");
  if (!norm(bulan) || !norm(idProyek)) throw galat("Bulan dan ID proyek wajib.");
  await pastikanTab(TAB_ATURAN, H, { cekJudul: true });
  lupakan();
  const ada = (await bacaAturan()).get(kunci(bulan, idProyek));
  const lapor = [ada?.lapor50, ada?.lapor30].find((t) => t && dl && t > dl);
  if (lapor) throw galat(`Deadline baru lebih awal dari tanggal lapor progres (${lapor}). Geser tanggal lapornya dulu.`);
  if (ada) await ubahBaris(TAB_ATURAN, ada.row, { 2: dl, 4: waktuWib(), 5: norm(oleh).slice(0, 80) });
  else await tambahBaris(TAB_ATURAN, H, [[norm(bulan), norm(idProyek).toUpperCase(), dl, "", waktuWib(), norm(oleh).slice(0, 80), "", ""]]);
  lupakan();
  return { idProyek: norm(idProyek).toUpperCase(), deadline: dl };
}
