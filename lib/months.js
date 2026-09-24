// ============================================================================
//  DATA LAYER — sheet proyek per bulan ("<Bulan>_Proyek ASN & Bappenas_...")
//
//  Tiap sheet bulanan memuat DUA tabel berdampingan:
//    KATALOG (anggaran bulan itu)  B..H  + V = ID Subtes -> Master_Project
//    LOG (pengambilan & fee)       J..U  + W = ID Subtes (formula turunan)
//
//  Satu baris katalog = satu BARIS ANGGARAN, bukan satu subtes. Subtes yang
//  sama boleh muncul dua kali dalam sebulan (beda output / beda platform /
//  batch tambahan), karena itu kolom B memakai kode baris per bulan
//  (mis. SEP-01) yang dijamin unik — inilah yang dipakai formula Sisa & Fee.
//  Tautan ke katalog master ada di kolom V.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite, getAccessToken, API } from "./gauth";
import { norm, parseNum, cekHargaBulanan } from "./format";
import { serialToISO, listMonthTabs, lupakanDaftarTab, rumusSisa, bulanTampil } from "./juli";

const ID = SHEET_IDS.master;
export const FIRST_ROW = 10;
const SCAN_TO = 900;

export const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export const monthIndex = (title) => {
  const t = String(title).toLowerCase();
  for (let i = MONTHS.length - 1; i >= 0; i--) if (t.includes(MONTHS[i].toLowerCase())) return i;
  return -1;
};
export const monthName = (title) => {
  const i = monthIndex(title);
  return i === -1 ? String(title) : MONTHS[i];
};

/**
 * Semua tab proyek bulanan, urut bulan (terlama -> terbaru). Dikenali dari
 * header baris 9, bukan nama tab — satu sumber dengan dashboard, lihat
 * listMonthTabs di juli.js.
 */
export async function listMonths(ap) {
  return listMonthTabs(ap);
}

// Juni memakai layout lama (tanpa ID Guru, PIC QC tunggal) -> kolom bergeser.
const layoutOf = (tab) =>
  /juni/i.test(tab)
    ? { logEnd: "S", idGuru: false, cJml: 4, cFee: 5, cStatus: 6, cPic1: 7, cPic2: -1, cBulan: 9, colJml: "N" }
    : { logEnd: "U", idGuru: true, cJml: 5, cFee: 6, cStatus: 7, cPic1: 8, cPic2: 9, cBulan: 10, colJml: "O" };

function mapCatalog(rows, subIds, tab, bulan) {
  const out = [];
  rows.forEach((row, i) => {
    const kode = norm(row[0]);
    if (!kode) return;
    out.push({
      tab, bulan,
      row: FIRST_ROW + i,
      kode,                                   // B — kode baris, unik dalam bulan
      idSubtes: norm((subIds[i] || [])[0]),   // V — tautan ke Master_Project
      platform: norm(row[1]),
      subtes: norm(row[2]),
      output: norm(row[3]),
      harga: parseNum(row[4]),
      kebutuhan: parseNum(row[5]),
      sisa: parseNum(row[6]),
    });
  });
  return out;
}

function mapLog(rows, subIds, tab, bulan, L) {
  const out = [];
  rows.forEach((row, i) => {
    const kode = norm(row[1]);
    const guru = norm(row[2]);
    const subtes = norm(row[L.idGuru ? 4 : 3]);
    if (!kode && !guru && !subtes) return;
    out.push({
      tab, bulan,
      row: FIRST_ROW + i,
      tanggal: serialToISO(row[0]),
      kode,
      idSubtes: norm((subIds[i] || [])[0]),
      guru,
      idGuru: L.idGuru ? norm(row[3]) : "",
      subtes,
      jumlah: parseNum(row[L.cJml]),
      fee: parseNum(row[L.cFee]),
      status: norm(row[L.cStatus]),
      picSoal: norm(row[L.cPic1]),
      picVideo: L.cPic2 >= 0 ? norm(row[L.cPic2]) : "",
      bulanLabel: norm(row[L.cBulan]),
    });
  });
  return out;
}

/**
 * Baca semua bulan yang TAMPIL sekaligus (satu round-trip) — untuk Analisis,
 * saran PIC, dan fee per guru. Bulan tersembunyi (BULAN_DISEMBUNYIKAN) tidak
 * dibaca; `semuaBulan` tetap memuat semua nama supaya "Proyek bulan baru"
 * tidak menawarkan membuat bulan yang sheet-nya sebenarnya sudah ada.
 */
export async function getAllMonths() {
  const ap = await authParams();
  if (!ap) return { source: "sample", months: [], catalog: [], log: [], semuaBulan: [] };
  const semua = await listMonths(ap);
  const months = bulanTampil(semua);
  const semuaBulan = semua.map((m) => m.bulan);
  if (!months.length) return { source: "sample", months: [], catalog: [], log: [], semuaBulan };

  const ranges = [];
  for (const m of months) {
    const L = layoutOf(m.tab);
    ranges.push(
      `'${m.tab}'!B${FIRST_ROW}:H${SCAN_TO}`,
      `'${m.tab}'!V${FIRST_ROW}:V${SCAN_TO}`,
      `'${m.tab}'!J${FIRST_ROW}:${L.logEnd}${SCAN_TO}`,
      `'${m.tab}'!W${FIRST_ROW}:W${SCAN_TO}`
    );
  }
  const grids = await batchRead(ID, ranges, ap);

  const catalog = [], log = [];
  months.forEach((m, i) => {
    const L = layoutOf(m.tab);
    const [cat, catSub, lg, logSub] = grids.slice(i * 4, i * 4 + 4);
    catalog.push(...mapCatalog(cat || [], catSub || [], m.tab, m.bulan));
    log.push(...mapLog(lg || [], logSub || [], m.tab, m.bulan, L));
  });
  return { source: "live", months, catalog, log, canWrite: ap.write, semuaBulan };
}

// ---------------------------------------------------------------------------
//  Buat bulan baru
// ---------------------------------------------------------------------------
const HEADER_BARU = [
  "ID Project","Platform","Subtes","Output","Harga","Kebutuhan","Sisa","",
  "Tanggal","ID Project","Guru","ID Guru","Subtes","Jumlah","Fee","Status",
  "PIC QC SOAL TEXT","PIC QC VIDEO","Note","Bulan","ID Subtes","ID Subtes (Log)",
  "Kode Lama","Tarif","Ket. Tarif",
];

/**
 * Prefix kode baris: "P" + nomor bulan, mis. September -> "P09".
 *
 * JANGAN memakai singkatan nama bulan ("SEP-01", "AGU-01", bahkan "SEP01"):
 * Google Sheets menafsirkannya sebagai TANGGAL, sehingga SUMIF/XLOOKUP tidak
 * pernah cocok dan Sisa/Fee diam-diam salah. Ini terjadi juga saat admin
 * mengetik manual di spreadsheet, bukan cuma lewat API. Skema "P09-01" sudah
 * diuji aman untuk keduabelas bulan.
 */
export const kodeBulan = (bulan) => {
  const i = MONTHS.indexOf(String(bulan));
  return "P" + String((i === -1 ? 0 : i) + 1).padStart(2, "0");
};

async function addSheet(title) {
  const token = await getAccessToken();
  if (!token) throw new Error("Butuh service account untuk membuat tab baru.");
  const res = await fetch(`${API}/${ID}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 500, columnCount: 26, frozenRowCount: 9 } } } }],
    }),
  });
  if (!res.ok) throw new Error("Gagal membuat tab: " + (await res.text()).slice(0, 200));
  const j = await res.json();
  return j.replies[0].addSheet.properties;
}

/**
 * Buat sheet bulan baru lengkap dengan header, sel ringkasan, dan baris
 * anggaran awal. `lines` = [{ idSubtes, subtes, platform, output, harga, kebutuhan }]
 */
function pastikanBarisValid(lines) {
  lines.forEach((ln, i) => {
    if (norm(ln.harga) === "") return;
    const c = cekHargaBulanan(ln.harga);
    if (!c.ok) throw new Error(`Baris ${i + 1} (${norm(ln.subtes) || "tanpa nama"}): ${c.pesan}`);
  });
}

export async function createMonth(bulan, lines = []) {
  pastikanBarisValid(lines);
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google Sheets belum diset.");
  const nama = norm(bulan);
  if (!MONTHS.includes(nama)) throw new Error("Nama bulan tidak dikenal: " + bulan);

  const existing = await listMonths(ap);
  if (existing.some((m) => m.bulan === nama)) throw new Error(`Sheet bulan ${nama} sudah ada.`);

  // Ikut gaya nama yang dipakai admin sejak Agustus ("Agustus_Freelance").
  // Namanya bebas diganti nanti — deteksi tab tidak bergantung pada nama.
  const title = `${nama}_Freelance`;
  await addSheet(title);
  lupakanDaftarTab();

  const data = [
    // ringkasan atas — rentangnya sengaja penuh, bukan dibatasi seperti sheet lama
    { range: `'${title}'!B2:C5`, values: [
      ["Total Project", "=COUNTA(B10:B)"],
      ["Kebutuhan", "=SUM(G10:G)"],
      ["Sisa", "=SUM(H10:H)"],
      ["Total Fee", "=SUMPRODUCT(F10:F500;G10:G500)"],
    ] },
    { range: `'${title}'!B9:Z9`, values: [HEADER_BARU] },
  ];

  await batchWrite(ID, data);

  if (lines.length) {
    const kode = kodeBulan(nama);
    const end = FIRST_ROW + lines.length - 1;
    const cat = [], sub = [], sisa = [];
    lines.forEach((ln, i) => {
      const r = FIRST_ROW + i;
      cat.push([
        `${kode}-${String(i + 1).padStart(2, "0")}`,
        norm(ln.platform),
        norm(ln.subtes),
        norm(ln.output),
        ln.harga === "" || ln.harga == null ? "" : parseNum(ln.harga),
        ln.kebutuhan === "" || ln.kebutuhan == null ? "" : parseNum(ln.kebutuhan),
      ]);
      sub.push([norm(ln.idSubtes)]);
      sisa.push([rumusSisa(title, r)]);
    });
    // RAW: supaya kode seperti "SEP-01" tidak berubah jadi tanggal.
    await batchWrite(ID, [
      { range: `'${title}'!B${FIRST_ROW}:G${end}`, values: cat },
      { range: `'${title}'!V${FIRST_ROW}:V${end}`, values: sub },
    ], "RAW");
    await batchWrite(ID, [{ range: `'${title}'!H${FIRST_ROW}:H${end}`, values: sisa }]);
  }
  return { tab: title, bulan: nama, lines: lines.length };
}

/** Tambah baris anggaran ke sheet bulan yang sudah ada. */
export async function addLines(tab, lines = []) {
  if (!lines.length) return { added: 0 };
  pastikanBarisValid(lines);
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google Sheets belum diset.");
  const [cat] = await batchRead(ID, [`'${tab}'!B${FIRST_ROW}:B${SCAN_TO}`], ap);
  const last = (cat || []).reduce((m, r, i) => (norm(r[0]) ? FIRST_ROW + i : m), FIRST_ROW - 1);
  const start = last + 1;
  const kode = kodeBulan(monthName(tab));
  // lanjutkan penomoran dari kode terakhir yang sudah ada
  let maxN = 0;
  (cat || []).forEach((r) => {
    const m = new RegExp(`^${kode}-(\\d+)$`, "i").exec(norm(r[0]));
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  });

  const rowsCat = [], rowsSub = [], rowsSisa = [];
  lines.forEach((ln, i) => {
    const r = start + i;
    rowsCat.push([
      `${kode}-${String(maxN + i + 1).padStart(2, "0")}`,
      norm(ln.platform),
      norm(ln.subtes),
      norm(ln.output),
      ln.harga === "" || ln.harga == null ? "" : parseNum(ln.harga),
      ln.kebutuhan === "" || ln.kebutuhan == null ? "" : parseNum(ln.kebutuhan),
    ]);
    rowsSub.push([norm(ln.idSubtes)]);
    // rumus bersama: kolom Jumlah Juni ada di N, bukan O
    rowsSisa.push([rumusSisa(tab, r)]);
  });
  const end = start + lines.length - 1;
  // RAW dulu untuk nilai (kode baris tidak boleh berubah jadi tanggal)...
  await batchWrite(ID, [
    { range: `'${tab}'!B${start}:G${end}`, values: rowsCat },
    { range: `'${tab}'!V${start}:V${end}`, values: rowsSub },
  ], "RAW");
  // ...baru formulanya.
  await batchWrite(ID, [{ range: `'${tab}'!H${start}:H${end}`, values: rowsSisa }]);
  return { added: lines.length, startRow: start };
}
