// ============================================================================
//  LAPORAN PENGAMBILAN (Excel) — per guru: proyek yang diambil, jumlah paket,
//  soal per paket, total soal tiap proyek, dan total semua.
//
//  Sumber: baris Log pengambilan yang sedang tampil (ikut saringan di halaman
//  Log). Baris "Cancel" (soal ditolak) tidak dihitung. Satu proyek yang
//  tercatat di beberapa baris (mis. baris Approved + baris tarif telat) dijumlah
//  jadi satu. Isi paket: salinan saat guru mengajukan (tab Pengerjaan) bila
//  ada, selain itu aturan proyek saat ini; proyek per soal tanpa paket.
//  Dipakai browser — ExcelJS baru dimuat saat tombol diklik.
// ============================================================================

import { norm } from "./format";
import { paketDariSoal } from "./paket";

export const KOLOM_LAPORAN = ["NO", "NAMA", "YANG DIAMBIL", "JUMLAH PAKET", "SOAL PER PAKET", "TOTAL SOAL", "TOTAL SEMUA"];
const LEBAR = [6, 30, 44, 15, 17, 13, 15];
const WARNA = { judul: "3F3F3F", kepala: "595959", putih: "FFFFFF", garis: "BFBFBF", zebra: "F2F2F2" };
const BATAL = /cancel/i;
const kecil = (s) => norm(s).toLowerCase();

/**
 * Kelompokkan baris log per guru:
 * [{ nama, idGuru, item: [{ kode, subtes, soal, isi, paket }], total, paket }], urut nama.
 */
export function susunLaporan(rows = [], { projects = [], aturan = {}, pengerjaan = [] } = {}) {
  const proyek = new Map(projects.map((p) => [norm(p.id).toUpperCase(), p]));
  const isiSaatAju = new Map(); // "id:<idGuru>|KODE" / "nama:<nama>|KODE" -> isi paket saat diajukan
  pengerjaan.forEach((p) => {
    if (!p.isiPaket) return;
    if (p.idGuru) isiSaatAju.set(`id:${p.idGuru}|${p.idProyek}`, p.isiPaket);
    if (p.nama) isiSaatAju.set(`nama:${kecil(p.nama)}|${p.idProyek}`, p.isiPaket);
  });

  const perGuru = new Map();
  for (const a of rows) {
    if (BATAL.test(a.status || "") || !(a.jumlah > 0)) continue;
    const kode = norm(a.idProject).toUpperCase();
    const nama = norm(a.guru) || "(tanpa nama)";
    const kunci = a.idGuru ? `id:${a.idGuru}` : `nama:${kecil(nama)}`;
    const g = perGuru.get(kunci) || { nama, idGuru: a.idGuru || "", item: new Map() };
    const it = g.item.get(kode) || { kode, subtes: norm(a.subtes) || proyek.get(kode)?.subtes || kode, soal: 0, isi: 0 };
    it.soal += a.jumlah;
    it.isi = it.isi || isiSaatAju.get(`${kunci}|${kode}`) || isiSaatAju.get(`nama:${kecil(nama)}|${kode}`) || aturan[kode]?.isiPaket || 0;
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

/** "10" atau "10 (terakhir 5)" bila soal tidak pas kelipatan isi paket; "-" untuk proyek per soal. */
export const teksIsiPaket = (it) => (!it.isi ? "-" : it.soal % it.isi ? `${it.isi} (terakhir ${it.soal % it.isi})` : it.isi);

/** Isi file .xlsx (ArrayBuffer). `ExcelJS` bisa diberikan dari luar (uji di Node). */
export async function bukuLaporan(grup, { judul, namaTab }, ExcelJSLuar) {
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

  return wb.xlsx.writeBuffer();
}

export async function unduhLaporan(grup, { judul, namaTab, namaFile }) {
  const buf = await bukuLaporan(grup, { judul, namaTab });
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
