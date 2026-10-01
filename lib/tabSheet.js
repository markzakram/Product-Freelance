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

let siap = new Set();
export async function pastikanTab(judul, header) {
  if (siap.has(judul)) return;
  const ap = await authParams();
  const ada = (await sheetMeta(ID, ap)).some((t) => t.title === judul);
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
  await pastikanTab(judul, header);
  await appendRows(ID, `'${judul}'!A1:${kolomAkhir(header)}1`, baris.map((b) => b.map((x) => (x == null ? "" : String(x)))), "RAW");
}

/** Ubah sel-sel satu baris: `isi` = { indeksKolom: nilai }. */
export async function ubahBaris(judul, row, isi) {
  const data = Object.entries(isi).map(([i, v]) => ({ range: `'${judul}'!${huruf(Number(i))}${row}`, values: [[v == null ? "" : String(v)]] }));
  if (data.length) await batchWrite(ID, data, "RAW");
}
