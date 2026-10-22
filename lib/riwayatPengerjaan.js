// Status dan aktivitas disimpan dalam SATU batch Sheets: keduanya berhasil atau keduanya gagal.
import crypto from "node:crypto";
import { SHEET_IDS, authParams, batchRead, sheetMeta, structuralUpdate } from "./gauth";
import { namaTab, pastikanTab } from "./tabSheet";
import { riwayatPengambilan, msWaktu } from "./pengerjaanOpsi";

export const TAB_RIWAYAT = namaTab("Riwayat pengerjaan", "TAB_RIWAYAT_PENGERJAAN");
export const H_RIWAYAT = ["ID aktivitas", "ID pengerjaan", "Bulan", "Waktu", "Jenis", "Tahap (%)", "ID laporan", "Versi", "Oleh", "Soal", "Link", "Catatan", "Detail"];
let metadata = null;
async function meta(ap, segar = false) {
  if (segar || !metadata || Date.now() - metadata.at > 60000) metadata = { at: Date.now(), janji: sheetMeta(SHEET_IDS.master, ap) };
  try { return await metadata.janji; } catch (e) { metadata = null; throw e; }
}

export async function bacaRiwayat() {
  const ap = await authParams();
  if (!ap) return new Map();
  if (!(await meta(ap)).some((s) => s.title === TAB_RIWAYAT)) { metadata = null; return new Map(); }
  const [rows] = await batchRead(SHEET_IDS.master, [`'${TAB_RIWAYAT}'!A2:M`], ap);
  const hasil = new Map();
  for (const [index, v] of (rows || []).entries()) {
    if (!v[0] || !v[1]) continue;
    let detail;
    try { detail = JSON.parse(v[12] || "{}"); } catch { throw new Error(`Detail riwayat pengerjaan baris ${index + 2} tidak valid.`); }
    const e = { ...detail, row: index + 2, id: String(v[0]), waktu: String(v[3] || ""), jenis: String(v[4]), persen: Number(v[5]) || 0, laporanId: String(v[6] || ""), versi: Number(v[7]) || 1, oleh: String(v[8] || ""), soal: Number(v[9]) || 0, link: String(v[10] || ""), catatan: String(v[11] || "") };
    e.t = Number(detail.t) || msWaktu(e.waktu);
    if (!hasil.has(String(v[1]))) hasil.set(String(v[1]), []);
    hasil.get(String(v[1])).push(e);
  }
  for (const [id, events] of hasil) hasil.set(id, [...new Map(events.map((e) => [e.id, e])).values()].sort((a, b) => a.t - b.t));
  return hasil;
}

export async function simpanAktivitas(tabPengerjaan, header, p, isi, events) {
  await pastikanTab(tabPengerjaan, header, { cekJudul: true });
  await pastikanTab(TAB_RIWAYAT, H_RIWAYAT, { cekJudul: true });
  const ap = await authParams();
  let tabs = await meta(ap);
  if (!tabs.some((s) => s.title === tabPengerjaan) || !tabs.some((s) => s.title === TAB_RIWAYAT)) tabs = await meta(ap, true);
  const sheetId = tabs.find((s) => s.title === tabPengerjaan)?.sheetId;
  const historyId = tabs.find((s) => s.title === TAB_RIWAYAT)?.sheetId;
  if (sheetId == null || historyId == null) throw new Error("Tab penyimpanan riwayat tidak ditemukan.");
  const sebelumnya = p.riwayat?.length ? [] : riwayatPengambilan(p);
  const rows = [...sebelumnya, ...events.map((e) => ({ id: crypto.randomUUID(), t: Date.now(), ...e }))].map((e) => ({ values: [e.id, p.id, p.bulan, e.waktu, e.jenis, e.persen || 0, e.laporanId || "", e.versi || 1, e.oleh || "", e.soal ?? "", e.link || "", e.catatan || "", JSON.stringify({ t: e.t, noLaporan: e.noLaporan, meta: e.meta, lama: e.lama })].map((v) => ({ userEnteredValue: { stringValue: String(v ?? "") } })) }));
  await structuralUpdate(SHEET_IDS.master, [
    ...Object.entries(isi).map(([col, value]) => ({ updateCells: { start: { sheetId, rowIndex: p.row - 1, columnIndex: Number(col) }, rows: [{ values: [{ userEnteredValue: { stringValue: String(value ?? "") } }] }], fields: "userEnteredValue" } })),
    { appendCells: { sheetId: historyId, rows, fields: "userEnteredValue" } },
  ]);
}
