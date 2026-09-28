// ============================================================================
//  REKAP FEE — format "Rekapitulasi Fee Freelance Produk" (tab "Freelance Juli"
//  dst.): NO · NAMA GURU · FEE · NO TELEPON · NIK · FOTO KTP · NO REKENING ·
//  BANK · NPWP, dengan judul di atas dan baris JUMLAH di bawah.
//
//  Dua keluaran: unduh .xlsx, atau salin untuk ditempel ke Google Sheets.
//  NIK, telepon, rekening, NPWP SELALU teks: sebagai angka, "0856…" kehilangan
//  nol di depannya dan NIK 16 digit bisa berubah digit terakhirnya.
// ============================================================================

import { nomorPertama } from "./tautan";

const WARNA = { judul: "3F3F3F", kepala: "595959", putih: "FFFFFF", garis: "BFBFBF", tautan: "1155CC" };
export const KOLOM_REKAP = ["NO", "NAMA GURU", "FEE", "NO TELEPON", "NIK", "FOTO KTP", "NO REKENING", "BANK", "NPWP"];
const LEBAR = [6, 32, 14, 17, 21, 24, 20, 13, 22];

// Nama bank yang dikenali di isian rekening ("BCA 2332…", "Seabank 9011…").
// Form pendaftaran hanya menanyakan rekening BSI, jadi angka tanpa nama bank = BSI.
const BANK = [
  ["BSI", /\bbsi\b|syariah\s+indonesia/i],
  ["BCA", /\bbca\b/i],
  ["BRI", /\bbri\b/i],
  ["BNI", /\bbni\b/i],
  ["Mandiri", /mandiri/i],
  ["Muamalat", /muamalat/i],
  ["Seabank", /sea\s?bank/i],
  ["Bank Jago", /\bjago\b/i],
  ["Permata", /permata/i],
  ["CIMB Niaga", /cimb/i],
  ["BTN", /\bbtn\b/i],
  ["Danamon", /danamon/i],
  ["BJB", /\bbjb\b/i],
  ["OCBC", /ocbc/i],
  ["Jenius", /jenius/i],
  ["blu", /\bblu\b/i],
];

/** Nama bank yang bisa dipilih guru di "Profil saya". */
export const NAMA_BANK = BANK.map(([n]) => n);

/** "BCA 2332597583" -> { bank: "BCA", nomor: "2332597583" }; "7302222821" -> BSI. */
export function bankDanRekening(rekening) {
  const s = String(rekening || "").trim();
  if (!s) return { bank: "", nomor: "" };
  const nomor = s.replace(/\D/g, "");
  const kenal = BANK.find(([, re]) => re.test(s));
  if (kenal) return { bank: kenal[0], nomor };
  // hanya angka (boleh spasi/titik/strip) -> rekening BSI sesuai pertanyaan form
  return { bank: /[a-z]/i.test(s) ? "" : "BSI", nomor };
}

/** Nomor WA ke format 08… seperti di rekap; nomor luar negeri tetap dengan "+". */
export function teleponLokal(wa) {
  let n = nomorPertama(wa).replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("62")) return "0" + n.slice(2);
  if (n.startsWith("8")) return "0" + n;
  return n.startsWith("0") ? n : "+" + n;
}

const kosongJadiStrip = (v) => {
  const s = String(v ?? "").trim();
  return !s || /^[-–—.]+$/.test(s) ? "-" : s;
};

/** Baris rekap dari kelompok pembayaran (satu kelompok = satu guru). */
export function barisRekap(groups) {
  return groups.map((g, i) => {
    const t = g.teacher || {};
    const { bank, nomor } = bankDanRekening(t.rekening);
    return {
      no: i + 1,
      nama: t.nama || g.guru,
      fee: g.total,
      telepon: teleponLokal(t.wa) || "-",
      nik: String(t.nik || "").replace(/\s/g, "") || "-",
      ktp: String(t.fotoKtp || "").split(/[\s,]+/).find((u) => /^https?:/i.test(u)) || "",
      rekening: nomor || "-",
      bank: bank || (nomor ? "?" : "-"),
      npwp: kosongJadiStrip(t.npwp),
      cocok: Boolean(g.teacher),
    };
  });
}

export function judulRekap(bulan, tahun, periode) {
  return `REKAP FEE PROYEK BULAN ${String(bulan || "").toUpperCase()} ${tahun}` + (periode ? ` (${periode})` : "");
}

// --------------------------------------------------------------- unduh .xlsx
/** Isi file .xlsx (ArrayBuffer). `ExcelJS` bisa diberikan dari luar (uji di Node). */
export async function bukuExcel(rows, { judul, namaTab }, ExcelJSLuar) {
  // ExcelJS (~1 MB) baru dimuat saat tombol diklik, bukan saat dashboard dibuka.
  const ExcelJS = ExcelJSLuar || (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Product Freelance";
  const ws = wb.addWorksheet(String(namaTab || "Rekap").slice(0, 31), { views: [{ state: "frozen", ySplit: 2 }] });
  ws.columns = LEBAR.map((width) => ({ width }));

  const garis = { style: "thin", color: { argb: "FF" + WARNA.garis } };
  const kotak = { top: garis, left: garis, bottom: garis, right: garis };
  const gelap = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + argb } });
  const huruf = { name: "Arial", size: 10 };
  const RP = '"Rp"#,##0';

  ws.mergeCells("A1:I1");
  const j = ws.getCell("A1");
  j.value = judul;
  j.font = { ...huruf, size: 14, bold: true, color: { argb: "FF" + WARNA.putih } };
  j.fill = gelap(WARNA.judul);
  j.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 42;

  const kepala = ws.getRow(2);
  kepala.values = KOLOM_REKAP;
  kepala.height = 24;
  kepala.eachCell((c) => {
    c.font = { ...huruf, size: 11, bold: true, color: { argb: "FF" + WARNA.putih } };
    c.fill = gelap(WARNA.kepala);
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = kotak;
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(3 + i);
    row.values = [r.no, r.nama, r.fee, r.telepon, r.nik, r.ktp ? { text: r.ktp, hyperlink: r.ktp } : "-", r.rekening, r.bank, r.npwp];
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (c, k) => {
      c.font = huruf;
      c.border = kotak;
      c.alignment = { vertical: "middle", horizontal: k === 1 || k >= 7 ? "center" : k === 3 ? "right" : "left" };
    });
    row.getCell(3).numFmt = RP;
    if (r.ktp) row.getCell(6).font = { ...huruf, color: { argb: "FF" + WARNA.tautan }, underline: true };
  });

  const akhir = 3 + rows.length;
  ws.mergeCells(`A${akhir}:B${akhir}`);
  ws.mergeCells(`C${akhir}:I${akhir}`);
  const total = rows.reduce((a, r) => a + r.fee, 0);
  ws.getCell(`A${akhir}`).value = "JUMLAH";
  ws.getCell(`C${akhir}`).value = total;
  ws.getCell(`C${akhir}`).numFmt = RP;
  ws.getRow(akhir).height = 28;
  ["A", "C"].forEach((k) => {
    const c = ws.getCell(`${k}${akhir}`);
    c.font = { ...huruf, size: 12, bold: true, color: { argb: "FF" + WARNA.putih } };
    c.fill = gelap(WARNA.judul);
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  return wb.xlsx.writeBuffer();
}

export async function unduhExcel(rows, { judul, namaTab, namaFile }) {
  const buf = await bukuExcel(rows, { judul, namaTab });
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // dicabut belakangan: mencabut terlalu cepat bisa memutus unduhan di browser yang lambat
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ------------------------------------------------------------------- salin
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rupiahTeks = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");

/**
 * Tabel HTML untuk papan klip. Google Sheets membaca `data-sheets-value`
 * (tipe per sel: 2 = teks, 3 = angka) dan `data-sheets-numberformat` bila ada
 * penanda <google-sheets-html-origin>, jadi NIK/telepon tetap teks dan FEE
 * tetap berformat Rp saat ditempel; `mso-number-format` melakukan hal yang
 * sama untuk Excel. Format Rp HANYA untuk FEE & JUMLAH — kolom NO angka biasa.
 */
export function htmlRekap(rows, judul) {
  const dasar = "border:1px solid #bfbfbf;padding:2px 6px;font-family:Arial;font-size:10pt;vertical-align:middle;";
  const gelap = (w) => `background:#${w};color:#ffffff;font-weight:bold;text-align:center;`;
  const attr = (o) => esc(JSON.stringify(o));
  const FORMAT_RP = attr({ 1: 4, 2: '"Rp"#,##0', 3: 1 });

  const teks = (v, gaya = "") => `<td style="${dasar}mso-number-format:'\@';${gaya}" data-sheets-value="${attr({ 1: 2, 2: String(v) })}">${esc(v)}</td>`;
  const angka = (n, gaya = "") => `<td style="${dasar}${gaya}" data-sheets-value="${attr({ 1: 3, 3: n })}">${n}</td>`;
  const rupiah = (n, gaya = "", colspan = 1) =>
    `<td${colspan > 1 ? ` colspan="${colspan}"` : ""} style="${dasar}${gaya}" data-sheets-value="${attr({ 1: 3, 3: n })}" data-sheets-numberformat="${FORMAT_RP}">${esc(rupiahTeks(n))}</td>`;

  const total = rows.reduce((a, r) => a + r.fee, 0);
  const isi = rows
    .map(
      (r) =>
        "<tr>" +
        angka(r.no, "text-align:center") +
        teks(r.nama) +
        rupiah(r.fee, "text-align:right") +
        teks(r.telepon) +
        teks(r.nik) +
        (r.ktp ? `<td style="${dasar}"><a href="${esc(r.ktp)}">${esc(r.ktp)}</a></td>` : teks("-")) +
        teks(r.rekening, "text-align:center") +
        teks(r.bank, "text-align:center") +
        teks(r.npwp, "text-align:center") +
        "</tr>"
    )
    .join("");
  return (
    `<meta charset="utf-8"><google-sheets-html-origin><table cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed">` +
    `<colgroup>${LEBAR.map((w) => `<col width="${Math.round(w * 7.5)}">`).join("")}</colgroup>` +
    `<tr style="height:42px"><td colspan="9" style="${dasar}${gelap(WARNA.judul)}font-size:14pt">${esc(judul)}</td></tr>` +
    `<tr style="height:24px">${KOLOM_REKAP.map((k) => `<td style="${dasar}${gelap(WARNA.kepala)}">${k}</td>`).join("")}</tr>` +
    isi +
    `<tr style="height:28px"><td colspan="2" style="${dasar}${gelap(WARNA.judul)}">JUMLAH</td>` +
    rupiah(total, gelap(WARNA.judul), 7) +
    `</tr></table></google-sheets-html-origin>`
  );
}

export function tsvRekap(rows, judul) {
  const bersih = (v) => String(v ?? "").replace(/[\t\n\r]+/g, " ");
  const total = rows.reduce((a, r) => a + r.fee, 0);
  return [
    judul,
    KOLOM_REKAP.join("\t"),
    ...rows.map((r) => [r.no, r.nama, r.fee, r.telepon, r.nik, r.ktp || "-", r.rekening, r.bank, r.npwp].map(bersih).join("\t")),
    ["JUMLAH", "", total].join("\t"),
  ].join("\n");
}

export async function salinRekap(rows, judul) {
  const html = htmlRekap(rows, judul);
  const tsv = tsvRekap(rows, judul);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([tsv], { type: "text/plain" }) }),
    ]);
    return "html";
  }
  await navigator.clipboard.writeText(tsv);
  return "teks";
}
