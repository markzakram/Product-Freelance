// ============================================================================
//  DATA LAYER — sheet proyek bulanan (Juni / Juli / Agustus / dst.)
//
//  Tiap sheet memuat DUA tabel berdampingan:
//    KATALOG (anggaran)  B..H  + V = ID Subtes -> Master_Project
//    LOG (pengambilan)   J..   + W = ID Subtes (formula turunan)
//
//  PENTING — layout tabel log TIDAK sama di semua bulan:
//    Juni   : J Tgl | K ID | L Guru | M Subtes  | N Jumlah | O Fee | P Status | Q PIC   | R Note | S Bulan
//    Lainnya: J Tgl | K ID | L Guru | M ID Guru | N Subtes | O Jml | P Fee    | Q Status| R PIC Soal | S PIC Video | T Bulan
//  Menulis Juni memakai pemetaan "lainnya" akan menaruh data di kolom yang
//  salah, karena itu semua operasi baca/tulis melewati layoutOf().
//
//  Kolom turunan (Sisa H, Fee, Bulan) dihitung formula sheet — di sini hanya
//  dibaca; saat baris baru dibuat, formulanya ditulis ulang, bukan hasilnya.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite, tabTitles } from "./gauth";
import { norm, parseNum } from "./format";
import sample from "./sampleData.json";

export const TAB_DEFAULT = "Juli_Proyek ASN & Bappenas_Freelance";
export const TAB_GURU = "Data guru freelance";
export const FIRST_ROW = 10;
const SCAN_TO = 900;
const ID = SHEET_IDS.master;

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const monthIdx = (t) => {
  const s = String(t).toLowerCase();
  for (let i = MONTHS.length - 1; i >= 0; i--) if (s.includes(MONTHS[i].toLowerCase())) return i;
  return -1;
};
const PINNED_MONTH = (process.env.PROYEK_BULAN || "").trim();

// --- layout tabel log per bulan --------------------------------------------
function layoutOf(tab) {
  if (/juni/i.test(tab)) {
    return {
      logEnd: "S",
      // indeks kolom relatif terhadap J (0 = J)
      idx: { tanggal: 0, idProject: 1, guru: 2, idGuru: -1, subtes: 3, jumlah: 4, fee: 5, status: 6, picSoal: 7, picVideo: -1, bulan: 9 },
      col: { tanggal: "J", idProject: "K", guru: "L", subtes: "M", jumlah: "N", status: "P", picSoal: "Q" },
      colFee: "O", colBulan: "S", colJml: "N", lebar: 10,
    };
  }
  return {
    logEnd: "T",
    idx: { tanggal: 0, idProject: 1, guru: 2, idGuru: 3, subtes: 4, jumlah: 5, fee: 6, status: 7, picSoal: 8, picVideo: 9, bulan: 10 },
    col: { tanggal: "J", idProject: "K", guru: "L", idGuru: "M", subtes: "N", jumlah: "O", status: "Q", picSoal: "R", picVideo: "S" },
    colFee: "P", colBulan: "T", colJml: "O", lebar: 11,
  };
}

const ORANGE_COL = { id: "B", platform: "C", subtes: "D", output: "E", harga: "F", kebutuhan: "G" };

// --- Tanggal ----------------------------------------------------------------
export function serialToISO(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  }
  const s = norm(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}
export function isoToSheetDate(iso) {
  const s = norm(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

// Paksa nilai jadi TEKS. Tanpa ini kode seperti "SEP-01"/"MEI-03" diubah Sheets
// menjadi TANGGAL sehingga SUMIF/XLOOKUP gagal diam-diam.
const asText = (v) => {
  const s = norm(v);
  return s === "" ? "" : "'" + s;
};

// --- Formula turunan (separator ";" karena locale in_ID) --------------------
const feeFormula = (L, r) => `=${L.colJml}${r}*XLOOKUP(K${r};$B:$B;$F:$F;"")`;
const bulanFormula = (r) => `=IF(J${r}="";"";TEXT(J${r};"yyyy-mm"))`;
const sisaFormula = (L, r) => `=G${r}-SUMIF($K:$K;B${r};$${L.colJml}:$${L.colJml})`;

// --- Resolusi tab -----------------------------------------------------------
let RESOLVED_TAB = null;
let _tabAt = 0;

export async function listMonthTabs(ap) {
  const params = ap || (await authParams());
  if (!params) return [];
  const titles = await tabTitles(ID, params);
  return titles
    .filter((t) => /proyek.*asn.*&?.*bappenas/i.test(t))
    .map((t) => ({ tab: t, bulan: monthIdx(t) === -1 ? t : MONTHS[monthIdx(t)], idx: monthIdx(t) }))
    .sort((a, b) => a.idx - b.idx);
}

/** Tab default = bulan terbaru, atau bulan yang dikunci lewat env PROYEK_BULAN. */
export async function resolveTab(ap) {
  const now = Date.now();
  if (RESOLVED_TAB && now - _tabAt < 60000) return RESOLVED_TAB;
  const params = ap || (await authParams());
  if (!params) return RESOLVED_TAB || TAB_DEFAULT;
  try {
    const list = await listMonthTabs(params);
    let pick = null;
    if (PINNED_MONTH) pick = list.find((m) => new RegExp(PINNED_MONTH, "i").test(m.tab))?.tab;
    if (!pick) pick = list.slice().sort((a, b) => b.idx - a.idx)[0]?.tab;
    RESOLVED_TAB = pick || TAB_DEFAULT;
    _tabAt = now;
  } catch (_) {
    RESOLVED_TAB = RESOLVED_TAB || TAB_DEFAULT;
  }
  return RESOLVED_TAB;
}

// Terima nama bulan ("Juli") atau nama tab penuh; kembalikan nama tab.
async function pickTab(wanted, ap) {
  if (!wanted) return resolveTab(ap);
  const list = await listMonthTabs(ap);
  const hit =
    list.find((m) => m.tab === wanted) ||
    list.find((m) => m.bulan.toLowerCase() === String(wanted).toLowerCase()) ||
    list.find((m) => new RegExp("^" + String(wanted), "i").test(m.tab));
  return hit ? hit.tab : resolveTab(ap);
}

const q = (tab, a1) => `'${tab}'!${a1}`;

// ============================================================================
//  BACA
// ============================================================================
function mapProjects(rows, subIds) {
  const out = [];
  rows.forEach((row, i) => {
    const id = norm(row[0]);
    if (!id) return;
    out.push({
      row: FIRST_ROW + i,
      id,
      idSubtes: norm((subIds[i] || [])[0]),
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

function mapAssignments(rows, L) {
  const g = (row, k) => (L.idx[k] < 0 ? "" : row[L.idx[k]]);
  const out = [];
  rows.forEach((row, i) => {
    const idProject = norm(g(row, "idProject"));
    const guru = norm(g(row, "guru"));
    const subtes = norm(g(row, "subtes"));
    if (!idProject && !guru && !subtes) return;
    out.push({
      row: FIRST_ROW + i,
      tanggal: serialToISO(g(row, "tanggal")),
      idProject,
      guru,
      idGuru: L.idx.idGuru < 0 ? "" : norm(g(row, "idGuru")),
      subtes,
      jumlah: parseNum(g(row, "jumlah")),
      fee: parseNum(g(row, "fee")),
      status: norm(g(row, "status")),
      picSoal: norm(g(row, "picSoal")),
      picVideo: L.idx.picVideo < 0 ? "" : norm(g(row, "picVideo")),
      bulan: norm(g(row, "bulan")),
    });
  });
  return out;
}

function mapTeachers(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => norm(h).toLowerCase());
  const find = (n) => head.findIndex((h) => h.includes(n));
  const cId = find("id guru"), cNama = find("nama lengkap"), cRek = find("nomor rekening bsi");
  const cOwner = find("nama pemilik rekening"), cWa = find("nomor whatsapp"), cEmail = find("email");
  const cStatus = head.findIndex((h) => h === "status");
  const REK_KOSONG = /^([-–—.]+|n\/?a|belum(\s+ada)?|tidak\s+ada)$/i;
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const id = cId !== -1 ? norm(row[cId]) : "";
    const nama = cNama !== -1 ? norm(row[cNama]) : "";
    if (!id && !nama) continue;
    const rek = cRek !== -1 ? norm(row[cRek]) : "";
    out.push({
      idGuru: id, nama,
      rekening: REK_KOSONG.test(rek) ? "" : rek,
      pemilikRekening: cOwner !== -1 ? norm(row[cOwner]) : "",
      wa: cWa !== -1 ? norm(row[cWa]) : "",
      email: cEmail !== -1 ? norm(row[cEmail]) : "",
      status: cStatus !== -1 ? norm(row[cStatus]) : "",
    });
  }
  return out;
}

function sampleBoard() {
  const projects = (sample.openProjects || []).map((p, i) => ({ ...p, row: FIRST_ROW + i, sisa: parseNum(p.sisa), idSubtes: "" }));
  const assignments = (sample.feeLog || []).map((f, i) => ({
    row: FIRST_ROW + i, tanggal: f.tanggal || "", idProject: f.idProject || "", guru: f.guru || "",
    idGuru: "", subtes: f.subtes || "", jumlah: parseNum(f.jumlah), fee: parseNum(f.fee),
    status: f.status || "", picSoal: f.pic || "", picVideo: "", bulan: f.bulan || "",
  }));
  const teachers = (sample.teachers || []).map((t) => ({
    idGuru: String(t.id ?? ""), nama: t.nama || "", rekening: "", pemilikRekening: "",
    wa: t.wa || "", email: t.email || "", status: t.status || "",
  }));
  return { source: "sample", projects, assignments, teachers, months: [], tab: "" };
}

/** Baca satu bulan. `bulan` boleh nama bulan, nama tab, atau kosong (terbaru). */
export async function getBoard(bulan) {
  const ap = await authParams();
  if (!ap) return sampleBoard();

  const baca = async (tab) => {
    const L = layoutOf(tab);
    const [oRows, subIds, gRows, tRows] = await batchRead(
      ID,
      [
        q(tab, `B${FIRST_ROW}:H${SCAN_TO}`),
        q(tab, `V${FIRST_ROW}:V${SCAN_TO}`),
        q(tab, `J${FIRST_ROW}:${L.logEnd}${SCAN_TO}`),
        `'${TAB_GURU}'!A1:AD200`,
      ],
      ap
    );
    return {
      source: "live",
      tab,
      projects: mapProjects(oRows || [], subIds || []),
      assignments: mapAssignments(gRows || [], L),
      teachers: mapTeachers(tRows || []),
      canWrite: ap.write,
    };
  };

  try {
    const tab = await pickTab(bulan, ap);
    const hasil = await baca(tab);
    hasil.months = await listMonthTabs(ap);
    if (!hasil.projects.length && !hasil.assignments.length) return { ...sampleBoard(), months: hasil.months };
    return hasil;
  } catch (e) {
    // Nama tab bisa berubah/dihapus sementara cache masih menyimpan yang lama.
    try {
      RESOLVED_TAB = null;
      _tabAt = 0;
      const tab = await pickTab(bulan, ap);
      const hasil = await baca(tab);
      hasil.months = await listMonthTabs(ap);
      if (hasil.projects.length || hasil.assignments.length) return hasil;
    } catch (e2) {
      console.error("getBoard gagal setelah resolve ulang:", e2.message);
    }
    console.error("getBoard fallback:", e.message);
    return sampleBoard();
  }
}

// ============================================================================
//  TULIS — hanya kolom input; kolom formula tidak pernah ditimpa saat edit.
// ============================================================================
const NUMERIC = new Set(["jumlah", "harga", "kebutuhan"]);
const ID_FIELDS = new Set(["id", "idProject"]);

function cellValue(field, v) {
  if (v === null || v === undefined) return "";
  if (field === "tanggal") return v === "" ? "" : isoToSheetDate(v);
  if (NUMERIC.has(field)) return v === "" ? "" : parseNum(v);
  if (ID_FIELDS.has(field)) return asText(v);
  return String(v);
}

export async function updateAssignment(row, patch, bulan) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const ap = await authParams();
  const tab = await pickTab(bulan, ap);
  const L = layoutOf(tab);
  const data = [];
  for (const [field, col] of Object.entries(L.col)) {
    if (!(field in patch)) continue;
    data.push({ range: q(tab, `${col}${r}:${col}${r}`), values: [[cellValue(field, patch[field])]] });
  }
  if (!data.length) return { updated: 0 };
  await batchWrite(ID, data);
  return { updated: data.length, row: r, tab };
}

export async function updateProject(row, patch, bulan) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const ap = await authParams();
  const tab = await pickTab(bulan, ap);
  const data = [];
  for (const [field, col] of Object.entries(ORANGE_COL)) {
    if (!(field in patch)) continue;
    data.push({ range: q(tab, `${col}${r}:${col}${r}`), values: [[cellValue(field, patch[field])]] });
  }
  if ("idSubtes" in patch) data.push({ range: q(tab, `V${r}:V${r}`), values: [[norm(patch.idSubtes)]] });
  if (!data.length) return { updated: 0 };
  await batchWrite(ID, data);
  return { updated: data.length, row: r, tab };
}

function greenRowValues(a, r, L) {
  const hasId = Boolean(norm(a.idProject));
  const v = new Array(L.lebar).fill("");
  const put = (k, val) => { if (L.idx[k] >= 0) v[L.idx[k]] = val; };
  put("tanggal", cellValue("tanggal", a.tanggal));
  put("idProject", asText(a.idProject));
  put("guru", norm(a.guru));
  put("idGuru", a.idGuru == null ? "" : String(a.idGuru));
  put("subtes", norm(a.subtes));
  put("jumlah", a.jumlah === "" || a.jumlah == null ? "" : parseNum(a.jumlah));
  put("fee", hasId ? feeFormula(L, r) : "");
  put("status", norm(a.status));
  put("picSoal", norm(a.picSoal));
  put("picVideo", norm(a.picVideo));
  put("bulan", hasId || a.tanggal ? bulanFormula(r) : "");
  return v;
}

function orangeRowValues(p, r, L) {
  const hasId = Boolean(norm(p.id));
  return [
    asText(p.id), norm(p.platform), norm(p.subtes), norm(p.output),
    p.harga === "" || p.harga == null ? "" : parseNum(p.harga),
    p.kebutuhan === "" || p.kebutuhan == null ? "" : parseNum(p.kebutuhan),
    hasId ? sisaFormula(L, r) : "",
  ];
}

const lastFilled = (rows) => rows.reduce((m, row, i) => ((row || []).some((c) => norm(c) !== "") ? FIRST_ROW + i : m), FIRST_ROW - 1);

/** Kode baris berikutnya untuk bulan tsb, mis. "P08-17". */
function nextKode(tab, existing) {
  const i = monthIdx(tab);
  const pre = "P" + String((i === -1 ? 0 : i) + 1).padStart(2, "0");
  let max = 0;
  existing.forEach((v) => {
    const m = new RegExp("^" + pre + "-(\\d+)$", "i").exec(norm(v));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${pre}-${String(max + 1).padStart(2, "0")}`;
}

export async function createAssignment(a, bulan) {
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google Sheets belum diset.");
  const tab = await pickTab(bulan, ap);
  const L = layoutOf(tab);
  const [rows] = await batchRead(ID, [q(tab, `J${FIRST_ROW}:${L.logEnd}${SCAN_TO}`)], ap);
  const r = lastFilled(rows || []) + 1;
  await batchWrite(ID, [{ range: q(tab, `J${r}:${L.logEnd}${r}`), values: [greenRowValues(a, r, L)] }]);
  return { row: r, tab };
}

export async function createProject(p, bulan) {
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google Sheets belum diset.");
  const tab = await pickTab(bulan, ap);
  const L = layoutOf(tab);
  const [rows] = await batchRead(ID, [q(tab, `B${FIRST_ROW}:H${SCAN_TO}`)], ap);
  const r = lastFilled(rows || []) + 1;
  // Kode baris dibuat sistem bila tidak diisi — admin tak perlu mengarang ID.
  const kode = norm(p.id) || nextKode(tab, (rows || []).map((x) => (x || [])[0]));
  await batchWrite(ID, [{ range: q(tab, `B${r}:H${r}`), values: [orangeRowValues({ ...p, id: kode }, r, L)] }]);
  if (norm(p.idSubtes)) await batchWrite(ID, [{ range: q(tab, `V${r}:V${r}`), values: [[norm(p.idSubtes)]] }]);
  return { row: r, tab, kode };
}

// Hapus = geser blok ke atas, HANYA pada kolom tabel yang bersangkutan.
// deleteDimension tidak dipakai: menghapus baris sheet akan ikut menghapus
// baris tabel di sebelahnya (katalog & log berbagi nomor baris).
export async function deleteAssignment(row, bulan) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const ap = await authParams();
  const tab = await pickTab(bulan, ap);
  const L = layoutOf(tab);
  const [rows] = await batchRead(ID, [q(tab, `J${FIRST_ROW}:${L.logEnd}${SCAN_TO}`)], ap);
  const last = lastFilled(rows || []);
  if (r > last) return { deleted: 0 };
  const keep = mapAssignments(rows || [], L).filter((a) => a.row > r).sort((x, y) => x.row - y.row);
  const out = [];
  let cur = r;
  for (const a of keep) out.push(greenRowValues(a, cur++, L));
  out.push(new Array(L.lebar).fill(""));
  await batchWrite(ID, [{ range: q(tab, `J${r}:${L.logEnd}${r + out.length - 1}`), values: out }]);
  return { deleted: 1, shifted: keep.length, tab };
}

export async function deleteProject(row, bulan) {
  const r = Number(row);
  if (!Number.isInteger(r) || r < FIRST_ROW) throw new Error("Nomor baris tidak valid: " + row);
  const ap = await authParams();
  const tab = await pickTab(bulan, ap);
  const L = layoutOf(tab);
  const [rows, subIds] = await batchRead(ID, [q(tab, `B${FIRST_ROW}:H${SCAN_TO}`), q(tab, `V${FIRST_ROW}:V${SCAN_TO}`)], ap);
  const last = lastFilled(rows || []);
  if (r > last) return { deleted: 0 };
  const all = mapProjects(rows || [], subIds || []);
  const keep = all.filter((p) => p.row > r).sort((x, y) => x.row - y.row);
  const out = [], subs = [];
  let cur = r;
  for (const p of keep) { out.push(orangeRowValues(p, cur++, L)); subs.push([p.idSubtes || ""]); }
  out.push(new Array(7).fill(""));
  subs.push([""]);
  await batchWrite(ID, [
    { range: q(tab, `B${r}:H${r + out.length - 1}`), values: out },
    { range: q(tab, `V${r}:V${r + subs.length - 1}`), values: subs },
  ]);
  return { deleted: 1, shifted: keep.length, tab };
}
