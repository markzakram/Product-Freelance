// ============================================================================
//  SELEKSI PENDAFTAR — tahap & QC sampel (Panduan Proyek: guru baru wajib
//  membuat sampel dan baru boleh produksi penuh setelah sampelnya lolos).
//
//  Tab "Seleksi guru": satu baris per email — tahap + rubrik tinjauan.
//    (tanpa baris) Menunggu -> Tinjau -> Sampel -> Lolos sampel -> [verifikasi]
//    Ditolak bisa dari tahap mana pun.
//  Tab "QC sampel": satu baris per SESI QC — sampel bisa direvisi berkali-kali,
//  tiap sesi punya checklist, hasil, PIC, dan catatan sendiri.
// ============================================================================

import { namaTab, bacaBaris, tambahBaris, ubahBaris } from "./tabSheet";
import { norm } from "./format";
import { TAHAP, HASIL_QC, CHECKLIST } from "./seleksiOpsi";
export { TAHAP, HASIL_QC, RUBRIK, CHECKLIST } from "./seleksiOpsi";

export const TAB_SELEKSI = namaTab("Seleksi guru", "TAB_SELEKSI");
export const TAB_QC = namaTab("QC sampel", "TAB_QC_SAMPEL");
const H_SELEKSI = ["Email", "Nama", "Tahap", "Skor bidang", "Skor pengalaman", "Skor berkas", "Catatan tinjau", "Diubah"];
const H_QC = ["Waktu", "Email", "Nama", "Sesi", "Subtes sampel", "Tautan sampel", "PIC QC", "Checklist", "Hasil", "Catatan"];

const low = (s) => norm(s).toLowerCase();
const waktu = () =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date())
    .replace(/\./g, ":")
    .replace(",", "");
const skor = (v) => {
  const n = parseInt(v, 10);
  return n >= 1 && n <= 5 ? n : 0;
};

// "Kesesuaian materi: ✓; Bentuk soal: ✗" <-> { "Kesesuaian materi": true, … }
const tulisChecklist = (c) => CHECKLIST.filter((k) => k in (c || {})).map((k) => `${k}: ${c[k] ? "✓" : "✗"}`).join("; ");
function bacaChecklist(s) {
  const out = {};
  norm(s)
    .split(";")
    .forEach((b) => {
      const m = b.match(/^\s*(.+?)\s*:\s*(✓|✗)\s*$/);
      if (m && CHECKLIST.includes(m[1])) out[m[1]] = m[2] === "✓";
    });
  return out;
}

let cache = null; // 10 detik — lihat getTeachers
const lupakan = () => (cache = null);

/** Map email -> { tahap, skor, catatan, diubah, qc: [sesi…] }. */
export async function bacaSeleksi() {
  if (cache && Date.now() - cache.at < 10000) return cache.janji;
  const janji = bacaSemua();
  cache = { at: Date.now(), janji };
  try {
    return await janji;
  } catch (e) {
    if (cache?.janji === janji) cache = null;
    throw e;
  }
}

async function bacaSemua() {
  const [sel, qc] = await Promise.all([bacaBaris(TAB_SELEKSI, H_SELEKSI), bacaBaris(TAB_QC, H_QC)]);
  const out = new Map();
  sel.forEach(({ row, v }) => {
    const email = low(v[0]);
    if (!email) return;
    out.set(email, {
      row,
      tahap: TAHAP.includes(norm(v[2])) ? norm(v[2]) : "",
      skor: { bidang: skor(v[3]), pengalaman: skor(v[4]), berkas: skor(v[5]) },
      catatan: norm(v[6]),
      diubah: norm(v[7]),
      qc: [],
    });
  });
  qc.forEach(({ v }) => {
    const email = low(v[1]);
    if (!email) return;
    if (!out.has(email)) out.set(email, { row: 0, tahap: "", skor: {}, catatan: "", diubah: "", qc: [] });
    out.get(email).qc.push({
      waktu: norm(v[0]),
      sesi: parseInt(v[3], 10) || 0,
      subtes: norm(v[4]),
      tautan: norm(v[5]),
      pic: norm(v[6]),
      checklist: bacaChecklist(v[7]),
      hasil: HASIL_QC.includes(norm(v[8])) ? norm(v[8]) : "",
      catatan: norm(v[9]),
    });
  });
  out.forEach((s) => s.qc.sort((a, b) => a.sesi - b.sesi));
  return out;
}

/** Simpan tahap dan/atau rubrik tinjauan (baris dibuat bila belum ada). */
export async function simpanSeleksi(email, { nama, tahap, skor: sk, catatan }) {
  const e = low(email);
  if (!e) throw new Error("Email kosong.");
  if (tahap !== undefined && tahap !== "" && !TAHAP.includes(tahap)) throw new Error("Tahap tidak dikenal: " + tahap);
  const semua = await bacaSeleksi();
  const ada = semua.get(e);
  const isi = {};
  if (nama !== undefined) isi[1] = norm(nama).slice(0, 150);
  if (tahap !== undefined) isi[2] = tahap;
  if (sk) {
    if ("bidang" in sk) isi[3] = skor(sk.bidang) || "";
    if ("pengalaman" in sk) isi[4] = skor(sk.pengalaman) || "";
    if ("berkas" in sk) isi[5] = skor(sk.berkas) || "";
  }
  if (catatan !== undefined) isi[6] = norm(catatan).slice(0, 1000);
  isi[7] = waktu();
  lupakan();
  if (ada?.row) await ubahBaris(TAB_SELEKSI, ada.row, isi);
  else {
    const baris = [e, "", "", "", "", "", "", ""];
    Object.entries(isi).forEach(([i, v]) => (baris[i] = v));
    await tambahBaris(TAB_SELEKSI, H_SELEKSI, [baris]);
  }
  lupakan();
}

/**
 * Catat satu sesi QC sampel. Sesi = urutan berikutnya untuk email itu.
 * Hasil "Lolos" memindahkan pendaftar ke tahap "Lolos sampel"; hasil lain
 * membuatnya tetap di tahap "Sampel" (menunggu revisi / keputusan admin).
 */
export async function catatQc(email, { nama, subtes, tautan, pic, checklist, hasil, catatan }) {
  const e = low(email);
  if (!HASIL_QC.includes(hasil)) throw new Error("Pilih hasil QC: Lolos, Perlu revisi, atau Tidak lolos.");
  if (tautan && !/^https?:\/\//i.test(norm(tautan))) throw new Error("Tautan sampel harus diawali http:// atau https://");
  lupakan(); // nomor sesi harus dari data terbaru
  const semua = await bacaSeleksi();
  const sesi = (semua.get(e)?.qc || []).reduce((m, q) => Math.max(m, q.sesi), 0) + 1;
  await tambahBaris(TAB_QC, H_QC, [
    [waktu(), e, norm(nama).slice(0, 150), sesi, norm(subtes).slice(0, 150), norm(tautan).slice(0, 500), norm(pic).slice(0, 80), tulisChecklist(checklist), hasil, norm(catatan).slice(0, 1500)],
  ]);
  lupakan();
  await simpanSeleksi(e, { nama, tahap: hasil === "Lolos" ? "Lolos sampel" : "Sampel" });
  return { sesi };
}
