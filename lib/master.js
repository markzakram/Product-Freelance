// ============================================================================
//  DATA LAYER — tab "Master_Project"
//
//  Katalog permanen semua subtes. Satu subtes = satu baris = satu ID. Awalan
//  ID mengikuti JENIS proyeknya (SOL-001, LAP-001, LIV-001, EDI-001); nomornya
//  berurutan per jenis. ID tidak berubah walau nama subtes diperbaiki atau
//  kategorinya dipindah — hanya berubah bila JENIS-nya diganti, dan saat itu
//  semua katalog bulanan yang menunjuknya ikut diperbarui (lihat gantiJenis).
//  Sheet bulanan tidak pernah membuat ID sendiri — hanya menunjuk ke ID di
//  sini lewat kolom "ID Subtes" (V).
//
//  Kolom (A..O):
//    A ID Project | B Subtes | C Kategori | D Status | E Platform | F Output
//    G Harga Lengkap | H Harga Video Pembahasan | I Harga Soal & Pembahasan
//    J Harga Liveclass | K Bulan Aktif | L Total Kebutuhan | M ID Lama
//    N Catatan | O Jenis   (O ditambahkan paling kanan agar kolom lain tak bergeser)
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite, sheetMeta, structuralUpdate } from "./gauth";
import { norm, parseNum, parseHarga } from "./format";
import { JENIS, jenisByNama, jenisDariId, nextId } from "./jenis";
import { listMonths, FIRST_ROW as BARIS_AWAL_BULAN } from "./months";

export { JENIS, jenisDariId, nextId };

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
      // kolom O; kalau kosong (baris lama) tebak dari awalan ID
      jenis: jenisByNama(row[14])?.nama || jenisDariId(id),
    });
  });
  return out;
}

export async function getMaster() {
  const ap = await authParams();
  if (!ap) return { source: "sample", rows: [] };
  try {
    const [rows] = await batchRead(ID, [q(`A${FIRST_ROW}:O${SCAN_TO}`)], ap);
    return { source: "live", rows: mapRows(rows), canWrite: ap.write };
  } catch (e) {
    console.error("getMaster:", e.message);
    return { source: "error", rows: [], error: e.message };
  }
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
  const jenis = jenisByNama(data.jenis);
  if (!jenis) throw new Error(`Pilih jenis proyek: ${JENIS.map((x) => x.nama).join(", ")}.`);
  const { rows } = await getMaster();

  if (!force) {
    const mirip = findSimilar(nama, rows);
    if (mirip.length) {
      const err = new Error("Subtes mirip sudah ada di master.");
      err.duplicate = mirip.map((m) => ({ id: m.id, subtes: m.subtes, alasan: m.alasan }));
      throw err;
    }
  }

  const id = nextId(rows, jenis.nama);
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
    jenis.nama,
  ]];
  // RAW: ID & teks disimpan apa adanya (Sheets suka menebak kode jadi tanggal);
  // harga tunggal sudah berupa angka dari cell(), jadi tetap tersimpan sebagai angka.
  await batchWrite(ID, [{ range: q(`A${r}:O${r}`), values }], "RAW");
  return { id, row: r, jenis: jenis.nama };
}

/**
 * Ubah sebagian kolom. ID tidak ikut berubah — kecuali `jenis` diganti,
 * yang ditangani gantiJenis (ID baru + semua tautan bulanan ikut pindah).
 */
export async function updateSubtes(row, patch) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const data = [];
  for (const [f, col] of Object.entries(FIELD_COL)) {
    if (!(f in patch)) continue;
    data.push({ range: q(`${col}${r}:${col}${r}`), values: [[cell(f, patch[f])]] });
  }
  if (data.length) await batchWrite(ID, data);
  const ganti = "jenis" in patch ? await gantiJenis(r, patch.jenis) : null;
  return { updated: data.length, row: r, ...(ganti || {}) };
}

/**
 * Pindahkan subtes ke jenis lain. Karena awalan ID = jenis, ID-nya ikut
 * berganti (mis. SOL-012 -> LIV-003), dan SEMUA katalog bulanan yang menunjuk
 * ID lama diperbarui dalam SATU permintaan tulis (atomik: berhasil semua atau
 * tidak sama sekali), supaya tidak ada tautan yang tertinggal menunjuk ID yang
 * sudah tidak ada. ID lama dicatat di kolom "ID Lama" agar tetap bisa dicari.
 */
export async function gantiJenis(row, jenisBaru) {
  const j = jenisByNama(jenisBaru);
  if (!j) throw new Error(`Jenis "${jenisBaru}" tidak dikenal.`);
  const { rows, source } = await getMaster();
  if (source !== "live") throw new Error("Data master tidak terbaca, perubahan jenis dibatalkan.");
  const t = rows.find((x) => x.row === Number(row));
  if (!t) throw new Error(`Baris ${row} tidak ada di master. Segarkan halaman lalu ulangi.`);
  if (t.jenis === j.nama && jenisDariId(t.id) === j.nama) return null; // tidak berubah

  const idBaru = nextId(rows, j.nama);
  const dipakai = await pemakaianSubtes(t.id);
  const idLama = [t.id, t.idLama].filter(Boolean).join(", ");
  await batchWrite(
    ID,
    [
      { range: q(`A${t.row}:A${t.row}`), values: [[idBaru]] },
      { range: q(`M${t.row}:M${t.row}`), values: [[idLama]] },
      { range: q(`O${t.row}:O${t.row}`), values: [[j.nama]] },
      ...dipakai.map((d) => ({ range: `'${d.tab}'!V${d.row}:V${d.row}`, values: [[idBaru]] })),
    ],
    "RAW"
  );
  return { id: idBaru, idSebelumnya: t.id, jenis: j.nama, tautanDipindah: dipakai.length };
}

/**
 * Arsip = subtes disembunyikan dari daftar pilihan, tapi barisnya tetap ada
 * sehingga ID dan riwayat bulan-bulan lalu tetap utuh. Ini jalur normal.
 */
export async function archiveSubtes(row, status = "Arsip") {
  return updateSubtes(row, { status });
}

/**
 * Di mana saja sebuah ID subtes dipakai? Katalog bulanan menyimpan tautannya di
 * kolom V, jadi itu yang dipindai. Dipakai dua kali: untuk memberi tahu admin
 * sebelum menghapus, dan sebagai pengaman di server saat benar-benar menghapus.
 */
export async function pemakaianSubtes(id) {
  const target = norm(id).toUpperCase();
  if (!target) return [];
  const ap = await authParams();
  if (!ap) return [];
  const months = await listMonths(ap);
  if (!months.length) return [];

  const A = BARIS_AWAL_BULAN;
  const ranges = months.flatMap((m) => [`'${m.tab}'!V${A}:V900`, `'${m.tab}'!B${A}:D900`]);
  const grids = await batchRead(SHEET_IDS.master, ranges, ap);

  const out = [];
  months.forEach((m, i) => {
    const [tautan, katalog] = grids.slice(i * 2, i * 2 + 2);
    (tautan || []).forEach((sel, j) => {
      if (norm(sel[0]).toUpperCase() !== target) return;
      const baris = katalog[j] || [];
      out.push({ bulan: m.bulan, tab: m.tab, row: A + j, kode: norm(baris[0]), subtes: norm(baris[2]) });
    });
  });
  return out;
}

/**
 * Hapus permanen satu baris master. Sengaja dibatasi ketat:
 *   - hanya baris berstatus "Arsip" (jadi menghapus selalu perlu dua langkah);
 *   - hanya bila TIDAK dipakai satu pun katalog bulanan — kalau dipakai,
 *     tautannya jadi yatim dan tarif normal/terlambat baris log itu tak bisa
 *     dibaca lagi (persis kasus P08-29 yang bikin Fee jadi 0 diam-diam);
 *   - `id` dari layar wajib cocok dengan isi barisnya. Menghapus menggeser
 *     baris di bawahnya, jadi tanpa cek ini tabel yang sudah basi bisa
 *     menghapus subtes yang salah.
 *
 * Karena syaratnya "tidak dipakai di bulan mana pun", nomor ID yang dihapus
 * aman dipakai ulang oleh nextId(): tidak ada data lama yang menunjuk ke sana.
 */
export async function deleteSubtes(row, { id } = {}) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);

  const { rows, source } = await getMaster();
  if (source !== "live") throw new Error("Data master tidak terbaca, penghapusan dibatalkan.");

  const target = rows.find((x) => x.row === r);
  if (!target) throw new Error(`Baris ${r} sudah tidak ada di master. Segarkan halaman lalu ulangi.`);
  if (norm(id) && norm(id).toUpperCase() !== target.id.toUpperCase()) {
    throw new Error(
      `Baris ${r} sekarang berisi ${target.id} (${target.subtes}), bukan ${norm(id)}. ` +
        "Tabel di layar sudah basi — segarkan halaman lalu ulangi."
    );
  }
  if (target.status !== "Arsip") {
    throw new Error(`${target.id} berstatus "${target.status}". Arsipkan dulu sebelum bisa dihapus permanen.`);
  }

  const dipakai = await pemakaianSubtes(target.id);
  if (dipakai.length) {
    const err = new Error(
      `${target.id} masih dipakai ${dipakai.length} baris katalog (${dipakai
        .map((d) => `${d.bulan} ${d.kode}`)
        .slice(0, 5)
        .join(", ")}${dipakai.length > 5 ? ", …" : ""}). Hapus baris katalog itu dulu, atau biarkan diarsipkan saja.`
    );
    err.dipakai = dipakai;
    throw err;
  }

  const meta = await sheetMeta(SHEET_IDS.master, await authParams());
  const tab = meta.find((s) => s.title === TAB_MASTER);
  if (!tab) throw new Error(`Tab "${TAB_MASTER}" tidak ditemukan.`);

  await structuralUpdate(SHEET_IDS.master, [
    { deleteDimension: { range: { sheetId: tab.sheetId, dimension: "ROWS", startIndex: r - 1, endIndex: r } } },
  ]);
  return { deleted: 1, id: target.id, subtes: target.subtes, row: r };
}
