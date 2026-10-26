// ============================================================================
//  KELOMPOK CACHE TAMPILAN — tab mana termasuk data apa (v3.16.1).
//  Penulisan hanya menghapus cache kelompok tab yang ditulis, jadi mencatat
//  satu klik WA (tab Reachout) tidak memaksa master, data guru, dan laporan
//  lintas bulan dibaca ulang. Tab yang tidak dikenali / perubahan struktur
//  (hapus baris, tab baru) = hapus semua (aman).
//  Murni tanpa impor supaya bisa dipakai gauth tanpa lingkaran impor.
// ============================================================================

const BULAN = /januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember/;

// [env nama tab, nama bawaan (huruf kecil), kelompok]
const TAB = [
  ["TAB_PENGERJAAN", "pengerjaan", "pengerjaan"],
  ["TAB_RIWAYAT_PENGERJAAN", "riwayat pengerjaan", "pengerjaan"],
  ["TAB_ATURAN_PROYEK", "aturan proyek", "pengerjaan"],
  ["TAB_REACHOUT", "reachout", "reachout"],
  ["TAB_DATA_GURU", "data guru freelance", "guru"],
  ["", "master_project", "master"],
  ["", "panduan", "panduan"],
  ["TAB_AKUN_GURU", "akun guru", "akun"],
  ["TAB_PENGATURAN", "pengaturan", "akun"],
  ["TAB_PENANDA", "penanda guru", "akun"],
  ["TAB_PERUBAHAN", "perubahan data guru", "akun"],
  ["TAB_SELEKSI", "seleksi guru", "akun"],
  ["TAB_QC_SAMPEL", "qc sampel", "akun"],
  ["TAB_PENDAFTARAN", "form responses 1", "akun"],
  ["TAB_AKUN_TIM", "akun tim", "tim"],
];

/** Kelompok satu tab, atau null bila tidak dikenali. */
export function grupTab(nama) {
  const n = String(nama || "").trim().toLowerCase();
  if (!n) return null;
  for (const [env, bawaan, grup] of TAB) {
    const ganti = env && typeof process !== "undefined" ? String(process.env[env] || "").trim().toLowerCase() : "";
    if (n === bawaan || (ganti && n === ganti)) return grup;
  }
  return BULAN.test(n) ? "bulan" : null;
}

/** "'Tab ''A'''!A1:B2" / "Tab!A1" -> "Tab 'A'" */
export function tabDariRange(range) {
  const r = String(range || "");
  const m = r.match(/^'((?:[^']|'')*)'!/) || r.match(/^([^!]+)!/);
  return m ? m[1].replace(/''/g, "'") : r.includes("!") ? "" : r;
}

/**
 * Kelompok yang tersentuh oleh satu permintaan tulis ke Google Sheets.
 * null = tidak bisa dipastikan (perubahan struktur, tab tak dikenal) -> hapus semua.
 */
export function grupTulisan(url, opt = {}) {
  const u = String(url || "");
  let tabs = [];
  try {
    if (/\/values\/[^/?]+:append/.test(u)) tabs = [tabDariRange(decodeURIComponent(u.match(/\/values\/([^/?]+):append/)[1]))];
    else if (/values:batchUpdate/.test(u)) tabs = (JSON.parse(opt.body || "{}").data || []).map((d) => tabDariRange(d.range));
    else if (/values:batchClear/.test(u)) tabs = (JSON.parse(opt.body || "{}").ranges || []).map(tabDariRange);
    else return null;
  } catch {
    return null;
  }
  const grup = new Set();
  for (const t of tabs) {
    const g = grupTab(t);
    if (!g) return null;
    grup.add(g);
  }
  return grup.size ? [...grup] : null;
}
