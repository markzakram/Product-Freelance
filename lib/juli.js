// ============================================================================
//  DATA LAYER — tab "Juli_Proyek ASN & Bappenas" (di spreadsheet MASTER)
//
//  Tab ini memuat DUA tabel berdampingan yang saling lepas (baris ke-N tabel
//  kiri TIDAK berhubungan dengan baris ke-N tabel kanan):
//
//   TABEL ORANGE — katalog proyek           kolom B..H, data mulai baris 10
//     B ID Project | C Platform | D Subtes | E Output | F Harga
//     G Kebutuhan  | H Sisa  <- FORMULA
//
//   TABEL HIJAU — log pengambilan/fee       kolom J..U, data mulai baris 10
//     J Tanggal | K ID Project | L Guru | M ID Guru | N Subtes | O Jumlah
//     P Fee <- FORMULA | Q Status | R PIC QC Soal | S PIC QC Video
//     T <- FORMULA bulan (header-nya tertulis "Note", lihat catatan di bawah)
//
//  KOLOM TURUNAN (JANGAN PERNAH DITIMPA NILAI STATIS — akan merusak sheet):
//     H Sisa  = Kebutuhan - SUM(Jumlah proyek tsb)
//     P Fee   = Jumlah x Harga (XLOOKUP by ID Project)
//     T Bulan = TEXT(Tanggal; "yyyy-mm")
//  Semuanya dihitung oleh spreadsheet; di sini hanya dibaca, dan saat menambah
//  baris formulanya ditulis ulang (bukan hasilnya) agar sheet tetap konsisten.
//
//  CATATAN header T: label di sheet tertulis "Note", tetapi isinya formula
//  bulan. Kolom U ("Bulan") justru kosong. Kode ini mengikuti ISI, bukan label.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite } from "./gauth";
import { norm, parseNum } from "./format";
import sample from "./sampleData.json";

export const TAB = "Juli_Proyek ASN & Bappenas";
export const TAB_GURU = "Data guru freelance";

const ID = SHEET_IDS.master;
export const FIRST_ROW = 10; // baris pertama data (baris 9 = header)
const SCAN_TO = 900; // batas pemindaian; grid tab ini 975 baris

const q = (a1) => `'${TAB}'!${a1}`;

// --- Tanggal ----------------------------------------------------------------
// Sheets menyimpan tanggal sebagai serial (hari sejak 1899-12-30).
// Locale spreadsheet = in_ID, format kolom J = dd/mm/yyyy.
export function serialToISO(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  }
  const s = norm(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

// ISO (yyyy-mm-dd) -> "dd/mm/yyyy" agar diparse Sheets sesuai locale in_ID.
export function isoToSheetDate(iso) {
  const s = norm(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

// --- Formula turunan (separator ";" karena locale in_ID) ---------------------
const feeFormula = (r) => `=O${r}*XLOOKUP(K${r};$B:$B;$F:$F;"")`;
const bulanFormula = (r) => `=IF(J${r}="";"";TEXT(J${r};"yyyy-mm"))`;
const sisaFormula = (r) => `=G${r}-SUMIF($K:$K;B${r};$O:$O)`;

// ============================================================================
//  BACA
// ============================================================================
function mapProjects(rows) {
  const out = [];
  rows.forEach((row, i) => {
    const r = FIRST_ROW + i;
    const id = norm(row[0]); // B
    if (!id) return;
    out.push({
      row: r,
      id,
      platform: norm(row[1]), // C
      subtes: norm(row[2]), // D
      output: norm(row[3]), // E
      harga: parseNum(row[4]), // F
      kebutuhan: parseNum(row[5]), // G
      sisa: parseNum(row[6]), // H (formula)
    });
  });
  return out;
}

function mapAssignments(rows) {
  const out = [];
  rows.forEach((row, i) => {
    const r = FIRST_ROW + i;
    const idProject = norm(row[1]); // K
    const guru = norm(row[2]); // L
    const subtes = norm(row[4]); // N
    if (!idProject && !guru && !subtes) return; // baris benar-benar kosong
    out.push({
      row: r,
      tanggal: serialToISO(row[0]), // J
      idProject,
      guru, // L
      idGuru: row[3] === "" || row[3] === undefined ? "" : String(row[3]).trim(), // M
      subtes, // N
      jumlah: parseNum(row[5]), // O
      fee: parseNum(row[6]), // P (formula)
      status: norm(row[7]), // Q
      picSoal: norm(row[8]), // R
      picVideo: norm(row[9]), // S
      bulan: norm(row[10]), // T (formula)
    });
  });
  return out;
}

// Kolom "Nomor rekening BSI" tidak selalu berisi nomor: sebagian guru diisi "-"
// sebagai penanda "belum ada". Tanpa ini, "-" akan lolos sebagai rekening sah
// dan ikut tercetak di kwitansi.
const REK_KOSONG = /^([-–—.]+|n\/?a|belum(\s+ada)?|tidak\s+ada)$/i;
function cleanRek(v) {
  const s = norm(v);
  return REK_KOSONG.test(s) ? "" : s;
}

function mapTeachers(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => norm(h).toLowerCase());
  const find = (needle) => head.findIndex((h) => h.includes(needle));
  const cId = find("id guru");
  const cNama = find("nama lengkap");
  const cRek = find("nomor rekening bsi");
  const cOwner = find("nama pemilik rekening");
  const cWa = find("nomor whatsapp");
  const cEmail = find("email");
  const cStatus = head.findIndex((h) => h === "status");
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const id = cId !== -1 ? norm(row[cId]) : "";
    const nama = cNama !== -1 ? norm(row[cNama]) : "";
    if (!id && !nama) continue;
    out.push({
      idGuru: id,
      nama,
      rekening: cRek !== -1 ? cleanRek(row[cRek]) : "",
      pemilikRekening: cOwner !== -1 ? norm(row[cOwner]) : "",
      wa: cWa !== -1 ? norm(row[cWa]) : "",
      email: cEmail !== -1 ? norm(row[cEmail]) : "",
      status: cStatus !== -1 ? norm(row[cStatus]) : "",
    });
  }
  return out;
}

function sampleBoard() {
  const projects = (sample.openProjects || []).map((p, i) => ({ ...p, row: FIRST_ROW + i, sisa: parseNum(p.sisa) }));
  const assignments = (sample.feeLog || []).map((f, i) => ({
    row: FIRST_ROW + i,
    tanggal: f.tanggal || "",
    idProject: f.idProject || "",
    guru: f.guru || "",
    idGuru: "",
    subtes: f.subtes || "",
    jumlah: parseNum(f.jumlah),
    fee: parseNum(f.fee),
    status: f.status || "",
    picSoal: f.pic || "",
    picVideo: "",
    bulan: f.bulan || "",
  }));
  const teachers = (sample.teachers || []).map((t) => ({
    idGuru: String(t.id ?? ""),
    nama: t.nama || "",
    rekening: "",
    pemilikRekening: "",
    wa: t.wa || "",
    email: t.email || "",
    status: t.status || "",
  }));
  return { source: "sample", projects, assignments, teachers };
}

// Satu round-trip untuk ketiga rentang. Selalu no-store => selalu realtime.
export async function getBoard() {
  try {
    const ap = await authParams();
    if (!ap) return sampleBoard();
    const [oRows, gRows, tRows] = await batchRead(
      ID,
      [q(`B${FIRST_ROW}:H${SCAN_TO}`), q(`J${FIRST_ROW}:T${SCAN_TO}`), `'${TAB_GURU}'!A1:AD200`],
      ap
    );
    const projects = mapProjects(oRows);
    const assignments = mapAssignments(gRows);
    const teachers = mapTeachers(tRows);
    if (!projects.length) return sampleBoard();
    return { source: "live", projects, assignments, teachers, canWrite: ap.write };
  } catch (e) {
    console.error("getBoard fallback:", e.message);
    return sampleBoard();
  }
}

// ============================================================================
//  TULIS — hanya kolom input. Kolom formula (H, P, T) tidak pernah ditimpa
//  pada operasi edit; hanya ditulis ulang saat baris baru dibuat/digeser.
// ============================================================================

// Kolom hijau yang boleh diedit langsung -> huruf kolomnya.
const GREEN_EDITABLE = {
  tanggal: "J",
  idProject: "K",
  guru: "L",
  idGuru: "M",
  subtes: "N",
  jumlah: "O",
  status: "Q",
  picSoal: "R",
  picVideo: "S",
};

const ORANGE_EDITABLE = {
  id: "B",
  platform: "C",
  subtes: "D",
  output: "E",
  harga: "F",
  kebutuhan: "G",
};

function cellValue(field, v) {
  if (v === null || v === undefined) return "";
  if (field === "tanggal") return v === "" ? "" : isoToSheetDate(v);
  if (field === "jumlah" || field === "harga" || field === "kebutuhan") {
    return v === "" ? "" : parseNum(v);
  }
  return String(v);
}

/** Edit sebagian kolom pada satu baris log (tabel hijau). */
export async function updateAssignment(row, patch) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const data = [];
  for (const [field, col] of Object.entries(GREEN_EDITABLE)) {
    if (!(field in patch)) continue;
    data.push({ range: q(`${col}${r}:${col}${r}`), values: [[cellValue(field, patch[field])]] });
  }
  if (!data.length) return { updated: 0 };
  await batchWrite(ID, data);
  return { updated: data.length, row: r };
}

/** Edit sebagian kolom pada satu baris katalog (tabel orange). */
export async function updateProject(row, patch) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const data = [];
  for (const [field, col] of Object.entries(ORANGE_EDITABLE)) {
    if (!(field in patch)) continue;
    data.push({ range: q(`${col}${r}:${col}${r}`), values: [[cellValue(field, patch[field])]] });
  }
  if (!data.length) return { updated: 0 };
  await batchWrite(ID, data);
  return { updated: data.length, row: r };
}

// Baris hijau lengkap J..T untuk ditulis (formula P & T diregenerasi).
function greenRowValues(a, r) {
  const hasId = Boolean(norm(a.idProject));
  return [
    cellValue("tanggal", a.tanggal),
    norm(a.idProject),
    norm(a.guru),
    a.idGuru === "" || a.idGuru === undefined || a.idGuru === null ? "" : String(a.idGuru),
    norm(a.subtes),
    a.jumlah === "" || a.jumlah === undefined || a.jumlah === null ? "" : parseNum(a.jumlah),
    hasId ? feeFormula(r) : "",
    norm(a.status),
    norm(a.picSoal),
    norm(a.picVideo),
    hasId || a.tanggal ? bulanFormula(r) : "",
  ];
}

function orangeRowValues(p, r) {
  const hasId = Boolean(norm(p.id));
  return [
    norm(p.id),
    norm(p.platform),
    norm(p.subtes),
    norm(p.output),
    p.harga === "" || p.harga === undefined || p.harga === null ? "" : parseNum(p.harga),
    p.kebutuhan === "" || p.kebutuhan === undefined || p.kebutuhan === null ? "" : parseNum(p.kebutuhan),
    hasId ? sisaFormula(r) : "",
  ];
}

async function readGreen(ap) {
  const [rows] = await batchRead(ID, [q(`J${FIRST_ROW}:T${SCAN_TO}`)], ap);
  return rows;
}
async function readOrange(ap) {
  const [rows] = await batchRead(ID, [q(`B${FIRST_ROW}:H${SCAN_TO}`)], ap);
  return rows;
}

// Baris terakhir yang terisi pada sebuah grid (0 kalau kosong semua).
function lastFilledRow(rows) {
  let last = FIRST_ROW - 1;
  rows.forEach((row, i) => {
    if ((row || []).some((c) => norm(c) !== "")) last = FIRST_ROW + i;
  });
  return last;
}

/** Tambah baris log baru tepat di bawah baris hijau terakhir. */
export async function createAssignment(a) {
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google Sheets belum diset.");
  const rows = await readGreen(ap);
  const r = lastFilledRow(rows) + 1;
  await batchWrite(ID, [{ range: q(`J${r}:T${r}`), values: [greenRowValues(a, r)] }]);
  return { row: r };
}

/** Tambah proyek baru tepat di bawah baris orange terakhir. */
export async function createProject(p) {
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google Sheets belum diset.");
  const rows = await readOrange(ap);
  const r = lastFilledRow(rows) + 1;
  await batchWrite(ID, [{ range: q(`B${r}:H${r}`), values: [orangeRowValues(p, r)] }]);
  return { row: r };
}

// Hapus = geser blok ke atas, HANYA pada kolom tabel yang bersangkutan.
// deleteDimension tidak dipakai: menghapus baris sheet akan ikut menghapus
// baris tabel di sebelahnya (orange & hijau berbagi nomor baris yang sama).
export async function deleteAssignment(row) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const ap = await authParams();
  const rows = await readGreen(ap);
  const last = lastFilledRow(rows);
  if (r > last) return { deleted: 0 };
  const list = mapAssignments(rows).filter((a) => a.row !== r);
  const keep = list.filter((a) => a.row > r).sort((x, y) => x.row - y.row);
  const out = [];
  let cur = r;
  for (const a of keep) out.push(greenRowValues(a, cur++));
  out.push(new Array(11).fill("")); // bersihkan baris terakhir yang kini duplikat
  await batchWrite(ID, [{ range: q(`J${r}:T${r + out.length - 1}`), values: out }]);
  return { deleted: 1, shifted: keep.length };
}

export async function deleteProject(row) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const ap = await authParams();
  const rows = await readOrange(ap);
  const last = lastFilledRow(rows);
  if (r > last) return { deleted: 0 };
  const list = mapProjects(rows).filter((p) => p.row !== r);
  const keep = list.filter((p) => p.row > r).sort((x, y) => x.row - y.row);
  const out = [];
  let cur = r;
  for (const p of keep) out.push(orangeRowValues(p, cur++));
  out.push(new Array(7).fill(""));
  await batchWrite(ID, [{ range: q(`B${r}:H${r + out.length - 1}`), values: out }]);
  return { deleted: 1, shifted: keep.length };
}
