// ============================================================================
//  REACHOUT — catatan setiap kali admin menghubungi guru lewat WhatsApp dari
//  dashboard (tawaran proyek, sapa pendaftar, minta sampel, hasil QC, kirim
//  akun, chat langsung). Tab "Reachout" di spreadsheet PROYEK GURU FREELANCE,
//  satu baris per klik; admin menandai hasilnya (dibalas / bersedia / menolak
//  / tak ada kabar). "Mengambil" tidak ditulis di sini — dihitung dari Log.
//  Pengelompokan & persentase: lib/reachoutOpsi.js.
// ============================================================================

import { namaTab, bacaBaris, tambahBaris, ubahBaris } from "./tabSheet";
import { norm } from "./format";
import { TAWARAN, TUJUAN, HASIL, waktuKeMs, msKeWaktu } from "./reachoutOpsi";

export const TAB_REACHOUT = namaTab("Reachout", "TAB_REACHOUT");
export const H = ["ID", "Waktu", "Tujuan", "Bulan", "ID proyek", "Subtes", "ID guru", "Nama", "Email", "WA", "PIC", "Hasil", "Diubah hasil"];
const MAKS_BARIS = 20000;
const SIMPAN_HARI = 200; // kontak yang lebih tua tidak dikirim ke browser

const potong = (v, n) => norm(v).slice(0, n);

let cache = null; // 10 detik, seperti bacaSeleksi
const lupakan = () => (cache = null);

/** Semua kontak (≤ SIMPAN_HARI hari terakhir), terlama dulu. */
export async function bacaReachout({ segar = false } = {}) {
  if (!segar && cache && Date.now() - cache.at < 10000) return cache.janji;
  const janji = bacaBaris(TAB_REACHOUT, H, MAKS_BARIS).then((rows) => {
    const batas = Date.now() - SIMPAN_HARI * 86400000;
    return rows
      .map(({ row, v }) => ({
        row,
        kid: norm(v[0]),
        waktu: norm(v[1]),
        t: waktuKeMs(v[1]),
        tujuan: norm(v[2]),
        bulan: norm(v[3]),
        idProyek: norm(v[4]),
        subtes: norm(v[5]),
        idGuru: norm(v[6]),
        nama: norm(v[7]),
        email: norm(v[8]).toLowerCase(),
        wa: norm(v[9]),
        pic: norm(v[10]),
        hasil: HASIL.includes(norm(v[11])) ? norm(v[11]) : "",
        tHasil: waktuKeMs(v[12]),
      }))
      .filter((k) => k.kid && TUJUAN.includes(k.tujuan) && k.t >= batas);
  });
  cache = { at: Date.now(), janji };
  try {
    return await janji;
  } catch (e) {
    if (cache?.janji === janji) cache = null;
    throw e;
  }
}

/** Catat satu kontak. `kid` dibuat browser supaya penanda hasil bisa langsung dipakai. */
export async function catatKontak(isi) {
  const kid = norm(isi.kid);
  if (!/^[a-z0-9]{8,32}$/i.test(kid)) throw new Error("ID kontak tidak sah.");
  const tujuan = norm(isi.tujuan);
  if (!TUJUAN.includes(tujuan)) throw new Error("Tujuan kontak tidak dikenal: " + tujuan);
  if (tujuan === TAWARAN && (!norm(isi.idProyek) || !norm(isi.bulan))) throw new Error("Tawaran proyek butuh ID proyek dan bulan.");
  if (!norm(isi.idGuru) && !norm(isi.email) && !norm(isi.nama)) throw new Error("Guru yang dihubungi tidak dikenal.");
  const waktu = msKeWaktu(Date.now());
  lupakan();
  await tambahBaris(TAB_REACHOUT, H, [
    [
      kid,
      waktu,
      tujuan,
      potong(isi.bulan, 60),
      potong(isi.idProyek, 40),
      potong(isi.subtes, 150),
      potong(isi.idGuru, 20),
      potong(isi.nama, 150),
      potong(isi.email, 150).toLowerCase(),
      potong(isi.wa, 40),
      potong(isi.pic, 80),
      "",
      "",
    ],
  ]);
  lupakan();
  return { kid, waktu };
}

/** Tandai hasil satu kontak (atau kosongkan = kembali "menunggu balasan"). */
export async function tandaiHasil(kid, hasil) {
  const h = norm(hasil);
  if (h && !HASIL.includes(h)) throw new Error("Hasil tidak dikenal: " + h);
  // baca segar: baris bisa saja dihapus manual di spreadsheet sejak dimuat
  const k = (await bacaReachout({ segar: true })).find((x) => x.kid === norm(kid));
  if (!k) throw new Error("Kontak tidak ditemukan di tab Reachout — muat ulang halaman.");
  lupakan();
  await ubahBaris(TAB_REACHOUT, k.row, { 11: h, 12: h ? msKeWaktu(Date.now()) : "" });
  lupakan();
  return { kid: k.kid, hasil: h };
}
