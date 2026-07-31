// ============================================================================
//  DATA LAYER — tab "Master_Project"
//
//  Katalog permanen semua subtes. Satu subtes = satu baris = satu ID (SUB-xxx)
//  yang TIDAK PERNAH berubah, walau nama subtes diperbaiki atau kategorinya
//  dipindah. Sheet bulanan tidak pernah membuat ID sendiri — hanya menunjuk
//  ke ID di sini lewat kolom "ID Subtes".
//
//  Kolom (A..N):
//    A ID Project | B Subtes | C Kategori | D Status | E Platform | F Output
//    G Harga Lengkap | H Harga Video Pembahasan | I Harga Soal & Pembahasan
//    J Harga Liveclass | K Bulan Aktif | L Total Kebutuhan | M ID Lama
//    N Catatan
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite } from "./gauth";
import { norm, parseNum, parseHarga } from "./format";

export const TAB_MASTER = "Master_Project";
const ID = SHEET_IDS.master;
const FIRST_ROW = 2; // baris 1 = header
const SCAN_TO = 1000;

const q = (a1) => `'${TAB_MASTER}'!${a1}`;

// Normalisasi untuk membandingkan nama subtes: abaikan besar/kecil, spasi
// ganda, dan tanda baca. Dipakai oleh pengaman duplikat.
export function normSubtes(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9() ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Jarak edit — dipakai untuk menangkap typo seperti "Analogii" vs "Analogi".
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Cari subtes yang mirip — untuk mencegah master kotor lagi oleh typo. */
export function findSimilar(nama, list) {
  const t = normSubtes(nama);
  if (!t) return [];
  const out = [];
  for (const m of list) {
    const s = normSubtes(m.subtes);
    if (!s) continue;
    if (s === t) {
      out.push({ ...m, alasan: "sama persis", skor: 0 });
      continue;
    }
    const d = levenshtein(t, s);
    // toleransi mengikuti panjang nama: makin panjang, makin longgar sedikit
    const batas = t.length <= 12 ? 1 : t.length <= 30 ? 2 : 3;
    if (d <= batas) out.push({ ...m, alasan: `beda ${d} huruf`, skor: d });
    else if (s.includes(t) || t.includes(s)) out.push({ ...m, alasan: "salah satu memuat yang lain", skor: 90 });
  }
  return out.sort((a, b) => a.skor - b.skor).slice(0, 5);
}

function mapRows(rows) {
  const out = [];
  rows.forEach((row, i) => {
    const id = norm(row[0]);
    const subtes = norm(row[1]);
    if (!id && !subtes) return;
    out.push({
      row: FIRST_ROW + i,
      id,
      subtes,
      kategori: norm(row[2]),
      status: norm(row[3]) || "Aktif",
      platform: norm(row[4]),
      output: norm(row[5]),
      // Disimpan apa adanya: bisa "13000" atau rentang tentatif "10000-13000".
      // Nilai terurai ikut dikirim supaya UI tak perlu mem-parse ulang.
      hargaLengkap: norm(row[6]),
      hargaVideo: norm(row[7]),
      hargaSoal: norm(row[8]),
      hargaLive: norm(row[9]),
      harga: {
        Lengkap: parseHarga(row[6]),
        "Video Pembahasan": parseHarga(row[7]),
        "Soal & Pembahasan": parseHarga(row[8]),
        Liveclass: parseHarga(row[9]),
      },
      bulanAktif: norm(row[10]),
      totalKebutuhan: parseNum(row[11]),
      idLama: norm(row[12]),
      catatan: norm(row[13]),
    });
  });
  return out;
}

export async function getMaster() {
  const ap = await authParams();
  if (!ap) return { source: "sample", rows: [] };
  try {
    const [rows] = await batchRead(ID, [q(`A${FIRST_ROW}:N${SCAN_TO}`)], ap);
    return { source: "live", rows: mapRows(rows), canWrite: ap.write };
  } catch (e) {
    console.error("getMaster:", e.message);
    return { source: "error", rows: [], error: e.message };
  }
}

/** ID berikutnya = nomor tertinggi + 1. Nomor tidak pernah dipakai ulang. */
export function nextId(rows) {
  let max = 0;
  for (const r of rows) {
    const m = /^SUB-(\d+)$/i.exec(r.id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SUB-${String(max + 1).padStart(3, "0")}`;
}

const FIELD_COL = {
  subtes: "B",
  kategori: "C",
  status: "D",
  platform: "E",
  output: "F",
  hargaLengkap: "G",
  hargaVideo: "H",
  hargaSoal: "I",
  hargaLive: "J",
  catatan: "N",
};
const HARGA = new Set(["hargaLengkap", "hargaVideo", "hargaSoal", "hargaLive"]);

const cell = (f, v) => {
  if (v === null || v === undefined || v === "") return "";
  if (!HARGA.has(f)) return String(v);
  // Angka tunggal disimpan sebagai bilangan; rentang ("10000-13000") sebagai
  // teks apa adanya supaya batas bawah & atasnya tidak hilang.
  const h = parseHarga(v);
  return h.ada && !h.tentatif ? h.min : norm(v);
};

/**
 * Tambah subtes baru. ID ditentukan sistem, bukan pemanggil.
 * `force` melewati pengaman duplikat (dipakai kalau admin sudah menegaskan).
 */
export async function createSubtes(data, { force = false } = {}) {
  const nama = norm(data.subtes);
  if (!nama) throw new Error("Nama subtes wajib diisi.");
  const { rows } = await getMaster();

  if (!force) {
    const mirip = findSimilar(nama, rows);
    if (mirip.length) {
      const err = new Error("Subtes mirip sudah ada di master.");
      err.duplicate = mirip.map((m) => ({ id: m.id, subtes: m.subtes, alasan: m.alasan }));
      throw err;
    }
  }

  const id = nextId(rows);
  const lastRow = rows.length ? Math.max(...rows.map((r) => r.row)) : FIRST_ROW - 1;
  const r = lastRow + 1;
  const values = [[
    id,
    nama,
    norm(data.kategori), // boleh kosong -> muncul di daftar "Perlu dikategorikan"
    norm(data.status) || "Aktif",
    norm(data.platform),
    norm(data.output),
    cell("hargaLengkap", data.hargaLengkap),
    cell("hargaVideo", data.hargaVideo),
    cell("hargaSoal", data.hargaSoal),
    cell("hargaLive", data.hargaLive),
    "", // Bulan Aktif diisi otomatis saat dipakai di bulan tertentu
    "",
    "",
    norm(data.catatan),
  ]];
  await batchWrite(ID, [{ range: q(`A${r}:N${r}`), values }]);
  return { id, row: r };
}

/** Ubah sebagian kolom. ID tidak pernah ikut berubah. */
export async function updateSubtes(row, patch) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const data = [];
  for (const [f, col] of Object.entries(FIELD_COL)) {
    if (!(f in patch)) continue;
    data.push({ range: q(`${col}${r}:${col}${r}`), values: [[cell(f, patch[f])]] });
  }
  if (!data.length) return { updated: 0 };
  await batchWrite(ID, data);
  return { updated: data.length, row: r };
}

/**
 * Subtes tidak pernah dihapus — hanya diarsipkan, supaya ID-nya tidak pernah
 * dipakai ulang dan riwayat bulan-bulan lalu tetap valid.
 */
export async function archiveSubtes(row, status = "Arsip") {
  return updateSubtes(row, { status });
}
