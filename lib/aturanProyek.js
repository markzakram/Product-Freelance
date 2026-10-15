// ============================================================================
//  ATURAN PROYEK — pengaturan per baris katalog yang tidak punya kolom di
//  sheet bulanan: deadline, tanggal lapor progres 30% / 50% (tanggal tetap,
//  sama untuk semua guru yang mengambil proyek itu), dan satuan pengambilan
//  (per soal / per paket — lib/paket.js).
//  Tab "Aturan proyek": satu baris per (bulan, ID proyek). Sheet bulanan
//  tidak diubah. Diisi tim akademik dari halaman Katalog.
// ============================================================================

import { namaTab, bacaBaris, tambahBaris, ubahBaris, pastikanTab } from "./tabSheet";
import { norm } from "./format";
import { waktuWib } from "./akun";
import { isiPaket, ISI_MIN, ISI_MAKS, rapikanTipe, TIPE_PROYEK } from "./paket";

export const TAB_ATURAN = namaTab("Aturan proyek", "TAB_ATURAN_PROYEK");
// "Lapor progres (%)" = model v3.4.0 (persen tanpa tanggal) — tidak dipakai lagi sejak v3.6.0.
export const H = ["Bulan", "ID proyek", "Deadline", "Lapor progres (%)", "Diubah", "Oleh", "Lapor 30%", "Lapor 50%", "Soal per paket", "Tipe"];
const barisKosong = (bulan, idProyek) => [norm(bulan), norm(idProyek).toUpperCase(), ...new Array(H.length - 2).fill("")];
const KOLOM_LAPOR = { 30: 6, 50: 7 };
export const kunciAturan = (bulan, id) => `${norm(bulan)}|${norm(id).toUpperCase()}`;
const kunci = kunciAturan;
const tglSah = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(norm(v)) ? norm(v) : "");

/** Titik lapor sebuah aturan: [{ persen: 30, tanggal: "2026-10-10" }, …] (yang bertanggal saja). */
export const titikDari = (a) => [30, 50].filter((n) => a?.[`lapor${n}`]).map((persen) => ({ persen, tanggal: a[`lapor${persen}`] }));

let cache = null;
const lupakan = () => (cache = null);
export const lupakanAturan = lupakan;

/** Map "bulan|ID PROYEK" -> { row, deadline, lapor30, lapor50 (yyyy-mm-dd), isiPaket (0 = per soal), tipe (Latsol/TO/""), diubah, oleh }. */
export async function bacaAturan() {
  if (cache && Date.now() - cache.at < 15000) return cache.janji;
  const janji = bacaBaris(TAB_ATURAN, H, 3000).then((rows) => {
    const m = new Map();
    rows.forEach(({ row, v }) => {
      if (!norm(v[0]) || !norm(v[1])) return;
      m.set(kunci(v[0], v[1]), { row, deadline: tglSah(v[2]), lapor30: tglSah(v[6]), lapor50: tglSah(v[7]), isiPaket: isiPaket(v[8]), tipe: rapikanTipe(v[9]), diubah: norm(v[4]), oleh: norm(v[5]) });
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

/** Aturan satu bulan sebagai objek polos { "P10-03": { deadline, titik, isiPaket, tipe } } untuk browser. */
export async function aturanBulan(bulan) {
  const m = await bacaAturan();
  const awal = norm(bulan) + "|";
  const out = {};
  m.forEach((v, k) => k.startsWith(awal) && (out[k.slice(awal.length)] = { deadline: v.deadline, titik: titikDari(v), isiPaket: v.isiPaket, tipe: v.tipe }));
  return out;
}

export async function deadlineProyek(bulan, idProyek) {
  return (await bacaAturan()).get(kunci(bulan, idProyek))?.deadline || "";
}

/**
 * Satuan pengambilan: `isi` = jumlah soal per paket (2–500), atau 0 / "" =
 * kembali per soal. Pengambilan yang sudah ada tidak berubah (jumlahnya soal).
 */
export async function aturPaket(bulan, idProyek, isi, oleh) {
  const kosong = isi === 0 || isi === "0" || isi === "" || isi == null;
  const n = kosong ? 0 : isiPaket(isi);
  if (!kosong && !n) throw galat(`Isi paket harus angka ${ISI_MIN}–${ISI_MAKS} soal.`);
  if (!norm(bulan) || !norm(idProyek)) throw galat("Bulan dan ID proyek wajib.");
  await pastikanTab(TAB_ATURAN, H, { cekJudul: true });
  lupakan();
  const ada = (await bacaAturan()).get(kunci(bulan, idProyek));
  const isiBaris = { 8: n || "", 4: waktuWib(), 5: norm(oleh).slice(0, 80) };
  if (ada) await ubahBaris(TAB_ATURAN, ada.row, isiBaris);
  else {
    const baris = barisKosong(bulan, idProyek);
    Object.entries(isiBaris).forEach(([i, v]) => (baris[i] = v));
    await tambahBaris(TAB_ATURAN, H, [baris]);
  }
  lupakan();
  return { idProyek: norm(idProyek).toUpperCase(), isiPaket: n };
}

/**
 * Simpan SEMUA aturan satu proyek sekaligus (panel "Atur" di Katalog):
 * { deadline, lapor30, lapor50 (yyyy-mm-dd / ""), tipe ("Latsol"/"TO"/""),
 *   isi (soal per paket; 0 = per soal) }. Divalidasi bersama, satu kali tulis:
 * lapor 30% ≤ lapor 50% ≤ deadline.
 */
export async function aturSemua(bulan, idProyek, a = {}, oleh) {
  if (!norm(bulan) || !norm(idProyek)) throw galat("Bulan dan ID proyek wajib.");
  const tgl = (v, nama) => {
    const s = norm(v);
    if (s && !tglSah(s)) throw galat(`Format ${nama} harus yyyy-mm-dd.`);
    return s;
  };
  const dl = tgl(a.deadline, "deadline");
  const l30 = tgl(a.lapor30, "tanggal lapor 30%");
  const l50 = tgl(a.lapor50, "tanggal lapor 50%");
  if (l30 && l50 && l30 > l50) throw galat("Tanggal lapor 30% harus sebelum (atau sama dengan) tanggal lapor 50%.");
  const lewat = [[l30, "30%"], [l50, "50%"]].find(([t]) => t && dl && t > dl);
  if (lewat) throw galat(`Tanggal lapor ${lewat[1]} tidak boleh setelah deadline (${dl}).`);
  const t = rapikanTipe(a.tipe);
  if (norm(a.tipe) && !t) throw galat(`Tipe hanya ${TIPE_PROYEK.join(" atau ")}.`);
  const tanpaPaket = a.isi === 0 || a.isi === "0" || a.isi === "" || a.isi == null;
  const n = tanpaPaket ? 0 : isiPaket(a.isi);
  if (!tanpaPaket && !n) throw galat(`Isi paket harus angka ${ISI_MIN}–${ISI_MAKS} soal.`);
  await pastikanTab(TAB_ATURAN, H, { cekJudul: true });
  lupakan();
  const ada = (await bacaAturan()).get(kunci(bulan, idProyek));
  const isiBaris = { 2: dl, 6: l30, 7: l50, 8: n || "", 9: t, 4: waktuWib(), 5: norm(oleh).slice(0, 80) };
  if (ada) await ubahBaris(TAB_ATURAN, ada.row, isiBaris);
  else {
    const baris = barisKosong(bulan, idProyek);
    Object.entries(isiBaris).forEach(([i, v]) => (baris[i] = v));
    await tambahBaris(TAB_ATURAN, H, [baris]);
  }
  lupakan();
  return { idProyek: norm(idProyek).toUpperCase(), deadline: dl, titik: titikDari({ lapor30: l30, lapor50: l50 }), isiPaket: n, tipe: t };
}

/** Tipe pembuatan: "Latsol" / "TO", atau "" untuk mengosongkan. */
export async function aturTipe(bulan, idProyek, tipe, oleh) {
  const t = rapikanTipe(tipe);
  if (norm(tipe) && !t) throw galat(`Tipe hanya ${TIPE_PROYEK.join(" atau ")}.`);
  if (!norm(bulan) || !norm(idProyek)) throw galat("Bulan dan ID proyek wajib.");
  await pastikanTab(TAB_ATURAN, H, { cekJudul: true });
  lupakan();
  const ada = (await bacaAturan()).get(kunci(bulan, idProyek));
  const isiBaris = { 9: t, 4: waktuWib(), 5: norm(oleh).slice(0, 80) };
  if (ada) await ubahBaris(TAB_ATURAN, ada.row, isiBaris);
  else {
    const baris = barisKosong(bulan, idProyek);
    Object.entries(isiBaris).forEach(([i, v]) => (baris[i] = v));
    await tambahBaris(TAB_ATURAN, H, [baris]);
  }
  lupakan();
  return { idProyek: norm(idProyek).toUpperCase(), tipe: t };
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
    const baris = barisKosong(bulan, idProyek);
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
  else {
    const baris = barisKosong(bulan, idProyek);
    Object.assign(baris, { 2: dl, 4: waktuWib(), 5: norm(oleh).slice(0, 80) });
    await tambahBaris(TAB_ATURAN, H, [baris]);
  }
  lupakan();
  return { idProyek: norm(idProyek).toUpperCase(), deadline: dl };
}
