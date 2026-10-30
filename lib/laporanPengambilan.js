// ============================================================================
//  LAPORAN PENGAMBILAN (Excel) — per guru: proyek yang diambil, jumlah paket,
//  soal per paket, total soal tiap proyek, dan total semua.
//
//  Sumber: baris Log pengambilan yang sedang tampil (ikut saringan di halaman
//  Log). Baris "Cancel" (soal ditolak) tidak dihitung. Satu proyek yang
//  tercatat di beberapa baris (mis. baris Approved + baris tarif telat) dijumlah
//  jadi satu. Isi paket: salinan saat guru mengajukan (tab Pengerjaan) bila
//  ada, selain itu aturan proyek saat ini; proyek per soal tanpa paket.
//  Sheet ke-2 "Rekap fee" (v3.19.0, untuk tim CLO): per guru paket yang
//  diambil, soal diterima (baris Approved/Paid), soal ditolak (Cancel), dan
//  fee yang dibayarkan (fee baris Approved/Paid).
//  Dipakai browser — ExcelJS baru dimuat saat tombol diklik.
// ============================================================================

import { norm } from "./format";
import { paketDariSoal } from "./paket";

export const KOLOM_LAPORAN = ["NO", "NAMA", "YANG DIAMBIL", "JUMLAH PAKET", "SOAL PER PAKET", "TOTAL SOAL", "TOTAL SEMUA"];
export const KOLOM_REKAP_FEE = ["NO", "NAMA GURU", "PAKET YANG DIAMBIL", "SOAL DITERIMA", "SOAL DITOLAK", "FEE DIBAYARKAN"];
const LEBAR_REKAP = [6, 30, 48, 15, 15, 20];
const DITERIMA = /approved|paid/i;
const LEBAR = [6, 30, 44, 15, 17, 13, 15];
const WARNA = { judul: "3F3F3F", kepala: "595959", putih: "FFFFFF", garis: "BFBFBF", zebra: "F2F2F2" };
const BATAL = /cancel/i;
const kecil = (s) => norm(s).toLowerCase();

/**
 * Kelompokkan baris log per guru:
 * [{ nama, idGuru, item: [{ kode, subtes, soal, isi, paket }], total, paket }], urut nama.
 */
/** Isi paket satu proyek untuk seorang guru: salinan saat mengajukan (tab Pengerjaan) bila ada, selain itu aturan proyek. */
function pencariIsi(aturan, pengerjaan) {
  const isiSaatAju = new Map(); // "id:<idGuru>|KODE" / "nama:<nama>|KODE" -> isi paket saat diajukan
  pengerjaan.forEach((p) => {
    if (!p.isiPaket) return;
    if (p.idGuru) isiSaatAju.set(`id:${p.idGuru}|${p.idProyek}`, p.isiPaket);
    if (p.nama) isiSaatAju.set(`nama:${kecil(p.nama)}|${p.idProyek}`, p.isiPaket);
  });
  return (kunci, nama, kode) => isiSaatAju.get(`${kunci}|${kode}`) || isiSaatAju.get(`nama:${kecil(nama)}|${kode}`) || aturan[kode]?.isiPaket || 0;
}

export function susunLaporan(rows = [], { projects = [], aturan = {}, pengerjaan = [] } = {}) {
  const proyek = new Map(projects.map((p) => [norm(p.id).toUpperCase(), p]));
  const isiDari = pencariIsi(aturan, pengerjaan);

  const perGuru = new Map();
  for (const a of rows) {
    if (BATAL.test(a.status || "") || !(a.jumlah > 0)) continue;
    const kode = norm(a.idProject).toUpperCase();
    const nama = norm(a.guru) || "(tanpa nama)";
    const kunci = a.idGuru ? `id:${a.idGuru}` : `nama:${kecil(nama)}`;
    const g = perGuru.get(kunci) || { nama, idGuru: a.idGuru || "", item: new Map() };
    const it = g.item.get(kode) || { kode, subtes: norm(a.subtes) || proyek.get(kode)?.subtes || kode, soal: 0, isi: 0 };
    it.soal += a.jumlah;
    it.isi = it.isi || isiDari(kunci, nama, kode);
    g.item.set(kode, it);
    perGuru.set(kunci, g);
  }

  return [...perGuru.values()]
    .map((g) => {
      const item = [...g.item.values()]
        .sort((x, y) => x.kode.localeCompare(y.kode, "id", { numeric: true }))
        .map((it) => ({ ...it, paket: it.isi ? paketDariSoal(it.soal, it.isi) : 0 }));
      return { nama: g.nama, idGuru: g.idGuru, item, total: item.reduce((n, it) => n + it.soal, 0), paket: item.reduce((n, it) => n + it.paket, 0) };
    })
    .sort((x, y) => x.nama.localeCompare(y.nama, "id"));
}

/**
 * Rekap fee per guru (sheet ke-2, untuk tim CLO), urut nama:
 * [{ nama, paket: "KODE · Subtes: 2 paket (40 soal)\n…", diterima, ditolak, fee }].
 * Paket yang diambil = semua baris proyek itu (termasuk yang kemudian ditolak);
 * diterima & fee = baris Approved/Paid; ditolak = baris Cancel. Baris yang masih
 * Running/QC/Revisi belum dihitung sebagai diterima.
 */
export function susunRekapFee(rows = [], { projects = [], aturan = {}, pengerjaan = [] } = {}) {
  const proyek = new Map(projects.map((p) => [norm(p.id).toUpperCase(), p]));
  const isiDari = pencariIsi(aturan, pengerjaan);
  const perGuru = new Map();
  for (const a of rows) {
    const nama = norm(a.guru);
    if (!nama) continue;
    const kunci = a.idGuru ? `id:${a.idGuru}` : `nama:${kecil(nama)}`;
    const g = perGuru.get(kunci) || { nama, diambil: new Map(), diterima: 0, ditolak: 0, fee: 0 };
    const jumlah = Math.max(0, Number(a.jumlah) || 0);
    const kode = norm(a.idProject).toUpperCase();
    const it = g.diambil.get(kode) || { kode, subtes: norm(a.subtes) || proyek.get(kode)?.subtes || kode, soal: 0, isi: 0 };
    it.soal += jumlah;
    it.isi = it.isi || isiDari(kunci, nama, kode);
    g.diambil.set(kode, it);
    if (BATAL.test(a.status || "")) g.ditolak += jumlah;
    else if (DITERIMA.test(a.status || "")) {
      g.diterima += jumlah;
      g.fee += Number(a.fee) || 0;
    }
    perGuru.set(kunci, g);
  }
  return [...perGuru.values()]
    .map((g) => ({
      nama: g.nama,
      paket: [...g.diambil.values()]
        .filter((it) => it.soal > 0)
        .sort((x, y) => x.kode.localeCompare(y.kode, "id", { numeric: true }))
        .map((it) => `${it.kode} · ${it.subtes}: ${it.isi ? `${paketDariSoal(it.soal, it.isi)} paket (${it.soal} soal)` : `${it.soal} soal`}`)
        .join("\n"),
      diterima: g.diterima,
      ditolak: g.ditolak,
      fee: g.fee,
    }))
    .filter((g) => g.paket || g.fee)
    .sort((x, y) => x.nama.localeCompare(y.nama, "id"));
}

/** "10" atau "10 (terakhir 5)" bila soal tidak pas kelipatan isi paket; "-" untuk proyek per soal. */
export const teksIsiPaket = (it) => (!it.isi ? "-" : it.soal % it.isi ? `${it.isi} (terakhir ${it.soal % it.isi})` : it.isi);

/** Isi file .xlsx (ArrayBuffer). `ExcelJS` bisa diberikan dari luar (uji di Node). */
export async function bukuLaporan(grup, { judul, namaTab, rekap = null, judulRekap = "" }, ExcelJSLuar) {
  const ExcelJS = ExcelJSLuar || (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Product Freelance";
  const ws = wb.addWorksheet(String(namaTab || "Laporan").slice(0, 31), { views: [{ state: "frozen", ySplit: 2 }] });
  ws.columns = LEBAR.map((width) => ({ width }));

  const garis = { style: "thin", color: { argb: "FF" + WARNA.garis } };
  const kotak = { top: garis, left: garis, bottom: garis, right: garis };
  const isiWarna = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + argb } });
  const huruf = { name: "Arial", size: 10 };
  const ANGKA = "#,##0";

  ws.mergeCells("A1:G1");
  const j = ws.getCell("A1");
  j.value = judul;
  j.font = { ...huruf, size: 14, bold: true, color: { argb: "FF" + WARNA.putih } };
  j.fill = isiWarna(WARNA.judul);
  j.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 42;

  const kepala = ws.getRow(2);
  kepala.values = KOLOM_LAPORAN;
  kepala.height = 24;
  kepala.eachCell((c) => {
    c.font = { ...huruf, size: 11, bold: true, color: { argb: "FF" + WARNA.putih } };
    c.fill = isiWarna(WARNA.kepala);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = kotak;
  });

  let r = 3;
  grup.forEach((g, gi) => {
    const awal = r;
    g.item.forEach((it) => {
      const row = ws.getRow(r);
      row.values = [gi + 1, g.nama, `${it.subtes} · ${it.kode}`, it.isi ? it.paket : "-", teksIsiPaket(it), it.soal, g.total];
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (c, k) => {
        c.font = huruf;
        c.border = kotak;
        c.alignment = { vertical: "middle", horizontal: k === 2 || k === 3 ? "left" : "center", wrapText: k === 3 };
        if (gi % 2) c.fill = isiWarna(WARNA.zebra);
      });
      row.getCell(6).numFmt = ANGKA;
      row.getCell(7).numFmt = ANGKA;
      r++;
    });
    // NO, NAMA, dan TOTAL SEMUA satu sel untuk semua proyek guru itu
    if (r - 1 > awal) ["A", "B", "G"].forEach((k) => ws.mergeCells(`${k}${awal}:${k}${r - 1}`));
    ws.getCell(`G${awal}`).font = { ...huruf, bold: true };
  });

  const akhir = r;
  const soal = grup.reduce((n, g) => n + g.total, 0);
  const paket = grup.reduce((n, g) => n + g.paket, 0);
  const nProyek = grup.reduce((n, g) => n + g.item.length, 0);
  ws.mergeCells(`A${akhir}:C${akhir}`);
  ws.mergeCells(`F${akhir}:G${akhir}`);
  ws.getCell(`A${akhir}`).value = `JUMLAH · ${grup.length} guru · ${nProyek} pengambilan`;
  ws.getCell(`D${akhir}`).value = paket || "-";
  ws.getCell(`F${akhir}`).value = soal;
  ws.getCell(`F${akhir}`).numFmt = ANGKA;
  ws.getRow(akhir).height = 28;
  ["A", "D", "E", "F"].forEach((k) => {
    const c = ws.getCell(`${k}${akhir}`);
    c.font = { ...huruf, size: 12, bold: true, color: { argb: "FF" + WARNA.putih } };
    c.fill = isiWarna(WARNA.judul);
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  if (rekap) tulisRekapFee(wb, rekap, { judul: judulRekap || judul, huruf, kotak, isiWarna, ANGKA });
  return wb.xlsx.writeBuffer();
}

/** Sheet "Rekap fee": NO · NAMA GURU · PAKET YANG DIAMBIL · SOAL DITERIMA · SOAL DITOLAK · FEE DIBAYARKAN. */
function tulisRekapFee(wb, rekap, { judul, huruf, kotak, isiWarna, ANGKA }) {
  const ws = wb.addWorksheet("Rekap fee", { views: [{ state: "frozen", ySplit: 2 }] });
  ws.columns = LEBAR_REKAP.map((width) => ({ width }));
  const RUPIAH = '"Rp" #,##0';
  ws.mergeCells("A1:F1");
  const j = ws.getCell("A1");
  j.value = judul;
  j.font = { ...huruf, size: 14, bold: true, color: { argb: "FF" + WARNA.putih } };
  j.fill = isiWarna(WARNA.judul);
  j.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(1).height = 42;

  const kepala = ws.getRow(2);
  kepala.values = KOLOM_REKAP_FEE;
  kepala.height = 24;
  kepala.eachCell((c) => {
    c.font = { ...huruf, size: 11, bold: true, color: { argb: "FF" + WARNA.putih } };
    c.fill = isiWarna(WARNA.kepala);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = kotak;
  });

  rekap.forEach((g, i) => {
    const row = ws.getRow(i + 3);
    row.values = [i + 1, g.nama, g.paket || "-", g.diterima, g.ditolak, g.fee];
    row.height = Math.max(18, 15 * (String(g.paket || "").split("\n").length || 1));
    row.eachCell({ includeEmpty: true }, (c, k) => {
      c.font = huruf;
      c.border = kotak;
      c.alignment = { vertical: "middle", horizontal: k === 2 || k === 3 ? "left" : k === 6 ? "right" : "center", wrapText: k === 3 };
      if (i % 2) c.fill = isiWarna(WARNA.zebra);
    });
    row.getCell(4).numFmt = ANGKA;
    row.getCell(5).numFmt = ANGKA;
    row.getCell(6).numFmt = RUPIAH;
  });

  const akhir = rekap.length + 3;
  ws.mergeCells(`A${akhir}:C${akhir}`);
  ws.getCell(`A${akhir}`).value = `TOTAL · ${rekap.length} guru`;
  ws.getCell(`D${akhir}`).value = rekap.reduce((n, g) => n + g.diterima, 0);
  ws.getCell(`E${akhir}`).value = rekap.reduce((n, g) => n + g.ditolak, 0);
  ws.getCell(`F${akhir}`).value = rekap.reduce((n, g) => n + g.fee, 0);
  ws.getRow(akhir).height = 28;
  ["A", "D", "E", "F"].forEach((k) => {
    const c = ws.getCell(`${k}${akhir}`);
    c.font = { ...huruf, size: 12, bold: true, color: { argb: "FF" + WARNA.putih } };
    c.fill = isiWarna(WARNA.judul);
    c.alignment = { horizontal: k === "F" ? "right" : "center", vertical: "middle" };
    c.numFmt = k === "F" ? RUPIAH : ANGKA;
  });

  ws.mergeCells(`A${akhir + 1}:F${akhir + 1}`);
  const ket = ws.getCell(`A${akhir + 1}`);
  ket.value = "Soal diterima & fee = baris Approved/Paid. Soal ditolak = baris Cancel. Soal yang masih dikerjakan / QC / revisi belum dihitung.";
  ket.font = { ...huruf, size: 9, italic: true, color: { argb: "FF595959" } };
  ket.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(akhir + 1).height = 26;
}

export async function unduhLaporan(grup, { namaFile, ...opsi }) {
  const buf = await bukuLaporan(grup, opsi);
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
