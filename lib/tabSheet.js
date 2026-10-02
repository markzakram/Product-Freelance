// ============================================================================
//  Tab kecil milik dashboard di spreadsheet PROYEK GURU FREELANCE ("Akun
//  guru", "Seleksi guru", "QC sampel", "Perubahan data guru", …): dibuat
//  otomatis saat pertama dipakai, baris 1 = judul kolom. Semua ditulis RAW
//  supaya Sheets tidak mengubah isinya jadi angka/tanggal/rumus.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite, appendRows, sheetMeta, structuralUpdate } from "./gauth";

const ID = SHEET_IDS.master;

/** Nama tab; bisa ditimpa lewat env HANYA di luar produksi (tab uji terpisah). */
export const namaTab = (bawaan, env) => (process.env.NODE_ENV !== "production" && env && process.env[env]) || bawaan;

const huruf = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
export const kolomAkhir = (header) => huruf(header.length - 1);

// Hemat kuota (60 baca/menit, dipakai bersama produksi): daftar tab dibaca
// SEKALI untuk semua tab kecil, bukan sekali per tab per instans server.
let siap = new Set();
let judulOk = new Set();
let daftarTab = null; // { at, janji }
function tabYangAda(ap) {
  if (!daftarTab || Date.now() - daftarTab.at > 600000) {
    const janji = sheetMeta(ID, ap).then((t) => new Set(t.map((x) => x.title)));
    daftarTab = { at: Date.now(), janji };
    janji.catch(() => daftarTab?.janji === janji && (daftarTab = null));
  }
  return daftarTab.janji;
}

/**
 * Buat tab bila belum ada. `cekJudul` (dipakai jalur TULIS): bila tab lama
 * punya lebih sedikit kolom daripada versi sekarang, judul kolom barunya
 * ditambahkan — sekali per instans server.
 */
export async function pastikanTab(judul, header, { cekJudul = false } = {}) {
  if (siap.has(judul) && (!cekJudul || judulOk.has(judul))) return;
  const ap = await authParams();
  const ada = siap.has(judul) || (await tabYangAda(ap)).has(judul);
  if (!ada) {
    try {
      await structuralUpdate(ID, [
        { addSheet: { properties: { title: judul, gridProperties: { rowCount: 500, columnCount: header.length, frozenRowCount: 1 } } } },
      ]);
    } catch (e) {
      // dua permintaan bersamaan sama-sama membuat tab: yang kalah cukup lanjut
      if (!/already exists|sudah ada/i.test(e.message)) throw e;
    }
    await batchWrite(ID, [{ range: `'${judul}'!A1`, values: [header] }], "RAW");
    daftarTab = null;
    judulOk.add(judul);
  } else if (cekJudul && !judulOk.has(judul)) {
    // Kolom baru di versi berikutnya (mis. "Oleh"): tambahkan judulnya bila
    // baris judul lama persis awalan judul baru — judul buatan admin tidak ditimpa.
    const [[lama = []] = []] = await batchRead(ID, [`'${judul}'!A1:${kolomAkhir(header)}1`], ap);
    const awalan = lama.length < header.length && lama.every((h, i) => String(h).trim() === header[i]);
    if (awalan) await batchWrite(ID, [{ range: `'${judul}'!A1`, values: [header] }], "RAW");
    judulOk.add(judul);
  }
  siap.add(judul);
}

/** Semua baris data (mulai baris 2) sebagai array nilai + nomor barisnya. */
export async function bacaBaris(judul, header, sampai = 3000) {
  const ap = await authParams();
  if (!ap) return [];
  await pastikanTab(judul, header);
  const [rows] = await batchRead(ID, [`'${judul}'!A2:${kolomAkhir(header)}${sampai}`], ap);
  return (rows || []).map((r, i) => ({ row: i + 2, v: r }));
}

export async function tambahBaris(judul, header, baris) {
  await pastikanTab(judul, header, { cekJudul: true });
  await appendRows(ID, `'${judul}'!A1:${kolomAkhir(header)}1`, baris.map((b) => b.map((x) => (x == null ? "" : String(x)))), "RAW");
}

/** Ubah sel-sel satu baris: `isi` = { indeksKolom: nilai }. */
export async function ubahBaris(judul, row, isi) {
  const data = Object.entries(isi).map(([i, v]) => ({ range: `'${judul}'!${huruf(Number(i))}${row}`, values: [[v == null ? "" : String(v)]] }));
  if (data.length) await batchWrite(ID, data, "RAW");
}
