// ============================================================================
//  Google Sheets data layer (zero runtime dependencies).
//  Talks to the Sheets REST API directly with fetch:
//   - Service Account  -> signs a JWT with Node crypto to get an access token
//   - API Key          -> appended as ?key=...
//   - No credentials   -> falls back to bundled (anonymised) sample data
//  Every export returns { source: "live" | "sample", ... }.
// ============================================================================

import crypto from "crypto";
import { parseNum, norm } from "./format";
import sample from "./sampleData.json";

const IDS = {
  master: process.env.SHEET_ID_MASTER || "13woeXhJ8-1hNjvJbJeZegsFHbRiDg3Klppj1v4wyBiQ",
  rekap: process.env.SHEET_ID_REKAP || "14xyyMKPud3i8z9AfivMObOZwiejbMZbu0YuSAO5lRU8",
  juli: process.env.SHEET_ID_JULI || "16PZr4sBmozX344o47KYc9EyM7GmZzFmwAtz0gLzfbOQ",
};
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export function isLiveConfigured() {
  return Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim()) ||
      (process.env.GOOGLE_SHEETS_API_KEY && process.env.GOOGLE_SHEETS_API_KEY.trim())
  );
}

function getCreds() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

// --- Service-account access token (cached in-module) ------------------------
let _tok = { value: null, exp: 0 };
function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function getAccessToken() {
  const creds = getCreds();
  if (!creds) return null;
  const now = Math.floor(Date.now() / 1000);
  if (_tok.value && _tok.exp > now + 30) return _tok.value;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const sig = b64url(signer.sign(creds.private_key));
  const jwt = `${header}.${claim}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("OAuth token error: " + JSON.stringify(j));
  _tok = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return _tok.value;
}

// --- Low-level fetch helpers ------------------------------------------------
async function authParams() {
  const token = await getAccessToken();
  if (token) return { headers: { Authorization: "Bearer " + token }, key: "" };
  const apiKey = (process.env.GOOGLE_SHEETS_API_KEY || "").trim();
  if (apiKey) return { headers: {}, key: "&key=" + encodeURIComponent(apiKey) };
  return null;
}

async function tabTitles(spreadsheetId, ap) {
  const url = `${API}/${spreadsheetId}?fields=sheets.properties.title${ap.key}`;
  const res = await fetch(url, { headers: ap.headers });
  if (!res.ok) throw new Error(`meta ${spreadsheetId}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.sheets || []).map((s) => s.properties.title);
}

async function readTab(spreadsheetId, title, ap, range = "A1:AZ2000") {
  const a1 = encodeURIComponent(`${title}!${range}`);
  const url = `${API}/${spreadsheetId}/values/${a1}?valueRenderOption=UNFORMATTED_VALUE${ap.key}`;
  const res = await fetch(url, { headers: ap.headers });
  if (!res.ok) throw new Error(`values ${title}: ${res.status}`);
  const j = await res.json();
  return j.values || [];
}

// --- Header helpers ---------------------------------------------------------
function findCol(row, label, from = 0, mode = "eq") {
  const target = norm(label).toLowerCase();
  for (let i = from; i < row.length; i++) {
    const cell = norm(row[i]).toLowerCase();
    if (!cell) continue;
    if (mode === "eq" && cell === target) return i;
    if (mode === "includes" && cell.includes(target)) return i;
    if (mode === "starts" && cell.startsWith(target)) return i;
  }
  return -1;
}
function findHeaderRow(rows, label, mode = "eq") {
  for (let r = 0; r < rows.length; r++) {
    if (findCol(rows[r] || [], label, 0, mode) !== -1) return r;
  }
  return -1;
}
function normDate(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

// ===========================================================================
//  DATASET 1 — OPEN PROJECTS (Project Juli)  [public]
// ===========================================================================
function mapProjectRows(rows) {
  const hr = findHeaderRow(rows, "ID Project");
  if (hr === -1) return [];
  const h = rows[hr];
  const cId = findCol(h, "ID Project");
  const cPlat = findCol(h, "Platform");
  const cSub = findCol(h, "Subtes");
  const cOut = findCol(h, "Output");
  const cHarga = findCol(h, "Harga");
  const cKeb = findCol(h, "Kebutuhan");
  const cSisa = findCol(h, "Sisa");
  const out = [];
  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const id = norm(row[cId]);
    if (!id) continue;
    out.push({
      id,
      platform: norm(row[cPlat]),
      subtes: norm(row[cSub]),
      output: norm(row[cOut]),
      harga: parseNum(row[cHarga]),
      kebutuhan: parseNum(row[cKeb]),
      sisa: parseNum(row[cSisa]),
    });
  }
  return out;
}

export async function getOpenProjects() {
  try {
    const ap = await authParams();
    if (!ap) return { source: "sample", rows: sample.openProjects };
    const titles = await tabTitles(IDS.juli, ap);
    const title =
      titles.find((t) => /det[ia]?l.*proyek/i.test(t)) ||
      titles.find((t) => !/panduan/i.test(t)) ||
      titles[0];
    const rows = await readTab(IDS.juli, title, ap);
    const mapped = mapProjectRows(rows);
    if (!mapped.length) return { source: "sample", rows: sample.openProjects };
    return { source: "live", rows: mapped };
  } catch (e) {
    console.error("getOpenProjects fallback:", e.message);
    return { source: "sample", rows: sample.openProjects };
  }
}

// ===========================================================================
//  DATASET 2 — MASTER PROJECTS + FEE LOG (master)  [internal]
// ===========================================================================
function mapMaster(rows) {
  const hr = findHeaderRow(rows, "ID Project");
  if (hr === -1) return { projects: [], feeLog: [] };
  const h = rows[hr];
  const projects = mapProjectRows(rows);
  const cTgl = findCol(h, "Tanggal");
  const feeLog = [];
  if (cTgl !== -1) {
    const cId2 = findCol(h, "ID Project", cTgl);
    const cGuru = findCol(h, "Guru", cTgl);
    const cSub2 = findCol(h, "Subtes", cTgl);
    const cJml = findCol(h, "Jumlah", cTgl);
    const cFee = findCol(h, "Fee", cTgl);
    const cStat = findCol(h, "Status", cTgl);
    const cPic = findCol(h, "PIC QC", cTgl, "includes");
    const cBln = findCol(h, "Bulan", cTgl);
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const guru = norm(row[cGuru]);
      const id = norm(row[cId2]);
      if (!guru && !id) continue;
      feeLog.push({
        tanggal: normDate(row[cTgl]),
        idProject: id,
        guru,
        subtes: norm(row[cSub2]),
        jumlah: parseNum(row[cJml]),
        fee: parseNum(row[cFee]),
        status: norm(row[cStat]),
        pic: cPic !== -1 ? norm(row[cPic]) : "",
        bulan: cBln !== -1 ? norm(row[cBln]) : "",
      });
    }
  }
  return { projects, feeLog };
}

export async function getMaster() {
  try {
    const ap = await authParams();
    if (!ap) return { source: "sample", projects: sample.masterProjects, feeLog: sample.feeLog };
    const titles = await tabTitles(IDS.master, ap);
    const title =
      titles.find((t) => /^master.?proyek$/i.test(norm(t))) ||
      titles.find((t) => /master/i.test(t) && !/lama/i.test(t)) ||
      titles[0];
    const rows = await readTab(IDS.master, title, ap);
    const { projects, feeLog } = mapMaster(rows);
    if (!projects.length) return { source: "sample", projects: sample.masterProjects, feeLog: sample.feeLog };
    return { source: "live", projects, feeLog };
  } catch (e) {
    console.error("getMaster fallback:", e.message);
    return { source: "sample", projects: sample.masterProjects, feeLog: sample.feeLog };
  }
}

// ===========================================================================
//  DATASET 3 — FEE RECAPS per month (Rekapitulasi)  [internal / HR]
// ===========================================================================
function categoryOf(tabName) {
  const n = norm(tabName);
  const m = n.match(/^(Live Class|Freelance Soal|Freelance Produk|Freelance)\s+(.*)$/i);
  if (!m) return null;
  let kat = m[1];
  const bulan = m[2].trim();
  if (/^live class$/i.test(kat)) kat = "Live Class";
  else if (/soal/i.test(kat)) kat = "Soal";
  else if (/produk/i.test(kat)) kat = "Produk";
  else kat = "Non Live Class";
  return { kategori: kat, bulan };
}
function mapRecapTab(rows, kategori, bulan) {
  const hr = findHeaderRow(rows, "NAMA");
  if (hr === -1) return [];
  const h = rows[hr];
  const cNama = findCol(h, "NAMA");
  const cPlat = findCol(h, "PLATFORM");
  const cProj = findCol(h, "PROJECT");
  const cJml = findCol(h, "JUMLAH");
  const cFee = findCol(h, "TOTAL FEE");
  const out = [];
  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const nama = norm(row[cNama]);
    const fee = parseNum(row[cFee]);
    if (!nama || !fee) continue;
    out.push({
      bulan,
      kategori,
      nama,
      platform: cPlat !== -1 ? norm(row[cPlat]) : "",
      project: cProj !== -1 ? norm(row[cProj]) : "",
      jumlah: cJml !== -1 ? parseNum(row[cJml]) : 0,
      totalFee: fee,
    });
  }
  return out;
}

export async function getFeeRecaps() {
  try {
    const ap = await authParams();
    if (!ap) return { source: "sample", rows: sample.feeRecaps };
    const titles = await tabTitles(IDS.rekap, ap);
    const all = [];
    for (const t of titles) {
      const cat = categoryOf(t);
      if (!cat) continue;
      const rows = await readTab(IDS.rekap, t, ap);
      all.push(...mapRecapTab(rows, cat.kategori, cat.bulan));
    }
    if (!all.length) return { source: "sample", rows: sample.feeRecaps };
    return { source: "live", rows: all };
  } catch (e) {
    console.error("getFeeRecaps fallback:", e.message);
    return { source: "sample", rows: sample.feeRecaps };
  }
}

// ===========================================================================
//  DATASET 4 — TEACHER DATABASE (Data guru freelance)  [internal]
// ===========================================================================
function mapTeachers(rows) {
  const hr = findHeaderRow(rows, "Nama Lengkap", "includes");
  if (hr === -1) return [];
  const h = rows[hr];
  const c = (label, mode = "includes") => findCol(h, label, 0, mode);
  const cNama = c("Nama Lengkap");
  const cStatus = c("Status", "eq");
  const cJk = c("Jenis Kelamin");
  const cPend = c("Pendidikan terakhir");
  const cJur = c("Jurusan");
  const cUniv = c("Asal universitas");
  const cKerja = c("Pekerjaan saat ini");
  const cPeng = c("Lama dan jenis pengalaman");
  const cBid = c("Bidang materi");
  const cProj = c("Jenis proyek yang ingin diambil");
  const cLive = c("LIVECLASS");
  const cKap = c("Estimasi kapasitas");
  const cWa = c("WhatsApp");
  const cEmail = c("Email");
  const out = [];
  let id = 0;
  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const nama = norm(row[cNama]);
    if (!nama) continue;
    id += 1;
    out.push({
      id,
      nama,
      status: cStatus !== -1 ? norm(row[cStatus]) : "",
      jenisKelamin: cJk !== -1 ? norm(row[cJk]) : "",
      pendidikan: cPend !== -1 ? norm(row[cPend]) : "",
      jurusan: cJur !== -1 ? norm(row[cJur]) : "",
      universitas: cUniv !== -1 ? norm(row[cUniv]) : "",
      pekerjaan: cKerja !== -1 ? norm(row[cKerja]) : "",
      pengalaman: cPeng !== -1 ? norm(row[cPeng]) : "",
      bidang: cBid !== -1 ? norm(row[cBid]) : "",
      jenisProyek: cProj !== -1 ? norm(row[cProj]) : "",
      liveClass: cLive !== -1 ? norm(row[cLive]) : "",
      kapasitas: cKap !== -1 ? parseNum(row[cKap]) : 0,
      wa: cWa !== -1 ? norm(row[cWa]) : "",
      email: cEmail !== -1 ? norm(row[cEmail]) : "",
    });
  }
  return out;
}

export async function getTeachers() {
  try {
    const ap = await authParams();
    if (!ap) return { source: "sample", rows: sample.teachers };
    const titles = await tabTitles(IDS.master, ap);
    const title = titles.find((t) => /data guru freelance/i.test(t));
    if (!title) return { source: "sample", rows: sample.teachers };
    const rows = await readTab(IDS.master, title, ap);
    const mapped = mapTeachers(rows);
    if (!mapped.length) return { source: "sample", rows: sample.teachers };
    return { source: "live", rows: mapped };
  } catch (e) {
    console.error("getTeachers fallback:", e.message);
    return { source: "sample", rows: sample.teachers };
  }
}
