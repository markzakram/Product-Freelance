// ============================================================================
//  Google Sheets auth + low-level REST helpers (zero runtime dependencies).
//   - Service Account -> signs a JWT with Node crypto to get an access token
//                        (read/write scope, so the admin dashboard can save)
//   - API Key         -> appended as ?key=...  (READ ONLY, cannot write)
//   - No credentials  -> callers fall back to bundled sample data
// ============================================================================

import crypto from "crypto";

export const API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// Spreadsheet ASLI (produksi). Dipakai bila env SHEET_ID_* kosong — kecuali
// di MODE DEMO (lihat bawah).
export const ID_PRODUKSI = {
  // The "Juli_Proyek ASN & Bappenas" and "Data guru freelance" tabs both live
  // in this spreadsheet ("PROYEK GURU FREELANCE").
  master: "13woeXhJ8-1hNjvJbJeZegsFHbRiDg3Klppj1v4wyBiQ",
  rekap: "14xyyMKPud3i8z9AfivMObOZwiejbMZbu0YuSAO5lRU8",
  juli: "16PZr4sBmozX344o47KYc9EyM7GmZzFmwAtz0gLzfbOQ",
  // Jawaban Google Form "Pendataan Guru Freelance PT.Cerebrum" — hanya DIBACA.
  pendaftaran: "1q9BLeAgZDlwNLr1S90NHEgZpp3PSS4oqDUsa5MGw6sk",
};

// MODE DEMO (situs demo terpisah): TIDAK ada jatuh-balik ke spreadsheet asli.
// Keempat SHEET_ID_* wajib diisi dan tidak boleh sama dengan ID produksi —
// kalau lupa diisi, semua akses Sheets ditolak (lihat cekModeDemo), bukan
// diam-diam menulis ke data asli.
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const ASLI = new Set(Object.values(ID_PRODUKSI));
const idDari = (env, k) => {
  const v = cleanEnv(process.env[env]);
  if (!DEMO) return v || ID_PRODUKSI[k];
  return v && !ASLI.has(v) ? v : "";
};
export const SHEET_IDS = {
  master: idDari("SHEET_ID_MASTER", "master"),
  rekap: idDari("SHEET_ID_REKAP", "rekap"),
  juli: idDari("SHEET_ID_JULI", "juli"),
  pendaftaran: idDari("SHEET_ID_PENDAFTARAN", "pendaftaran"),
};
/** MODE DEMO tapi ada SHEET_ID_* yang kosong / menunjuk spreadsheet asli. */
export const DEMO_SALAH_SETEL = DEMO && Object.values(SHEET_IDS).some((v) => !v);
function cekModeDemo() {
  if (DEMO_SALAH_SETEL) {
    throw new Error(
      "MODE DEMO: SHEET_ID_MASTER, SHEET_ID_PENDAFTARAN, SHEET_ID_JULI, dan SHEET_ID_REKAP wajib diisi ID spreadsheet DEMO (bukan spreadsheet asli). Akses Google Sheets dikunci sampai diperbaiki."
    );
  }
}

// Bersihkan nilai env var dari sampah yang sering ikut saat menempel di Vercel:
// spasi/enter di ujung, dan sepasang tanda kutip pembungkus.
function cleanEnv(raw) {
  let s = String(raw || "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function getCreds() {
  const raw = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!raw) return null;
  // Coba JSON mentah dulu, lalu base64. (base64 = cara paling aman di Vercel.)
  try {
    return JSON.parse(raw);
  } catch (e) {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch (_) {
      return null;
    }
  }
}

// Diagnosa aman untuk banner admin — TIDAK pernah mengembalikan isi kunci,
// hanya panjang, status parse, dan pesan error dari Google.
export async function credsDiagnosis() {
  const raw = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const apiKey = (process.env.GOOGLE_SHEETS_API_KEY || "").trim();
  if (!raw) {
    if (apiKey) return { stage: "apikey", ok: false, msg: "Hanya API key yang diset — itu cuma bisa membaca, tidak bisa menyimpan. Isi GOOGLE_SERVICE_ACCOUNT_JSON (base64) untuk akses tulis." };
    return { stage: "missing", ok: false, msg: "Env var GOOGLE_SERVICE_ACCOUNT_JSON kosong / belum diset di Vercel." };
  }
  const len = raw.length;
  const creds = getCreds();
  if (!creds) {
    return {
      stage: "unparseable",
      ok: false,
      msg: `Nilai env var ada (${len} karakter) tapi tidak bisa dibaca sebagai JSON maupun base64 — kemungkinan kepotong saat ditempel atau formatnya salah. Pakai versi base64 utuh.`,
    };
  }
  if (!creds.client_email || !creds.private_key) {
    return { stage: "incomplete", ok: false, msg: "JSON terbaca tapi tidak lengkap (client_email / private_key hilang)." };
  }
  try {
    await getAccessToken();
    return { stage: "ok", ok: true, msg: "Auth ke Google berhasil." };
  } catch (e) {
    return {
      stage: "rejected",
      ok: false,
      msg: `Google menolak kunci (${creds.client_email}): ${String(e.message || "").slice(0, 140)}. Kemungkinan kunci sudah dirotasi/dihapus, atau sheet belum di-share ke email ini.`,
    };
  }
}

export function isLiveConfigured() {
  return Boolean(
    getCreds() || (process.env.GOOGLE_SHEETS_API_KEY && process.env.GOOGLE_SHEETS_API_KEY.trim())
  );
}

// Writing requires a service account. An API key can only ever read.
export function canWrite() {
  return Boolean(getCreds());
}

// --- Service-account access token (cached in-module) ------------------------
let _tok = { value: null, exp: 0 };

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function getAccessToken() {
  cekModeDemo();
  const creds = getCreds();
  if (!creds) return null;
  const now = Math.floor(Date.now() / 1000);
  if (_tok.value && _tok.exp > now + 30) return _tok.value;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const jwt = `${header}.${claim}.${b64url(signer.sign(creds.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("OAuth token error: " + JSON.stringify(j));
  _tok = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return _tok.value;
}

export async function authParams() {
  cekModeDemo();
  const token = await getAccessToken();
  if (token) return { headers: { Authorization: "Bearer " + token }, key: "", write: true };
  const apiKey = (process.env.GOOGLE_SHEETS_API_KEY || "").trim();
  if (apiKey) return { headers: {}, key: "&key=" + encodeURIComponent(apiKey), write: false };
  return null;
}

// --- Reads ------------------------------------------------------------------
export async function tabTitles(spreadsheetId, ap) {
  const url = `${API}/${spreadsheetId}?fields=sheets.properties.title${ap.key}`;
  const res = await fetch(url, { headers: ap.headers, cache: "no-store" });
  if (!res.ok) throw new Error(`meta ${spreadsheetId}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.sheets || []).map((s) => s.properties.title);
}

// Judul + sheetId numerik tiap tab. Operasi STRUKTUR (menghapus baris) tidak
// menerima nama tab — hanya sheetId — jadi ini yang menjembatani keduanya.
export async function sheetMeta(spreadsheetId, ap) {
  const url = `${API}/${spreadsheetId}?fields=sheets.properties(title,sheetId)${ap.key}`;
  const res = await fetchUlang(url, { headers: ap.headers, cache: "no-store" });
  if (!res.ok) throw new Error(`meta ${spreadsheetId}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.sheets || []).map((s) => ({ title: s.properties.title, sheetId: s.properties.sheetId }));
}

export async function readTab(spreadsheetId, title, ap, range = "A1:AZ2000") {
  const a1 = encodeURIComponent(`${title}!${range}`);
  const url = `${API}/${spreadsheetId}/values/${a1}?valueRenderOption=UNFORMATTED_VALUE${ap.key}`;
  const res = await fetch(url, { headers: ap.headers, cache: "no-store" });
  if (!res.ok) throw new Error(`values ${title}: ${res.status}`);
  const j = await res.json();
  return j.values || [];
}

// Read several A1 ranges in one round-trip. Returns an array of value grids,
// in the same order as `ranges`.
// Batas Google: 60 pembacaan per menit untuk satu service account — dipakai
// bersama admin, halaman guru, dan halaman depan. Lonjakan sesaat (mis. admin
// menyimpan beberapa kali berturut-turut) cukup ditunggu, bukan jadi galat.
const JEDA_KUOTA = [1000, 2000, 4000];
// Google kadang membalas 500/502/503 sesaat ("try again in 30 seconds").
// Permintaan yang aman diulang (baca, tulis ke rentang tetap) dicoba lagi.
const JEDA_SEMENTARA = [700, 1500];
const galatSementara = (s) => s === 500 || s === 502 || s === 503 || s === 504;

/** fetch dengan pengulangan untuk 429 (kuota) dan 5xx sementara. */
async function fetchUlang(url, opt) {
  let res = await fetch(url, opt);
  for (let i = 0; i < JEDA_KUOTA.length; i++) {
    const jeda = res.status === 429 ? JEDA_KUOTA[i] : galatSementara(res.status) ? JEDA_SEMENTARA[i] : 0;
    if (!jeda) break;
    await new Promise((r) => setTimeout(r, jeda));
    res = await fetch(url, opt);
  }
  return res;
}

export async function batchRead(spreadsheetId, ranges, ap, render = "UNFORMATTED_VALUE") {
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${API}/${spreadsheetId}/values:batchGet?${qs}&valueRenderOption=${render}${ap.key}`;
  const res = await fetchUlang(url, { headers: ap.headers, cache: "no-store" });
  if (!res.ok) throw new Error(`batchGet: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.valueRanges || []).map((v) => v.values || []);
}

// --- Writes (service account only) -----------------------------------------
// `data` is [{ range: "'Tab'!J12:J12", values: [[...]] }, ...]
//
// mode "USER_ENTERED" (default): dd/mm/yyyy dates and "=FORMULA(...)" strings
// are parsed by Sheets exactly as if a human had typed them.
//
// mode "RAW": nilai disimpan apa adanya. WAJIB dipakai untuk kolom kode baris
// seperti "SEP-01" — dengan USER_ENTERED, Sheets menafsirkannya sebagai
// TANGGAL (1 September) sehingga SUMIF/XLOOKUP tidak akan pernah cocok.
export async function batchWrite(spreadsheetId, data, mode = "USER_ENTERED") {
  const token = await getAccessToken();
  if (!token) throw new Error("Menyimpan butuh GOOGLE_SERVICE_ACCOUNT_JSON (API key hanya bisa membaca).");
  // batchUpdate menulis ke rentang tetap -> hasilnya sama walau diulang
  const res = await fetchUlang(`${API}/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: mode, data }),
    cache: "no-store",
  });
  if (!res.ok) throw await tulisGagal(res);
  return res.json();
}

/** Kosongkan isi beberapa rentang (format & validasi sel tetap). */
export async function batchClear(spreadsheetId, ranges) {
  const token = await getAccessToken();
  if (!token) throw new Error("Menghapus butuh GOOGLE_SERVICE_ACCOUNT_JSON.");
  const res = await fetchUlang(`${API}/${spreadsheetId}/values:batchClear`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ ranges }),
    cache: "no-store",
  });
  if (!res.ok) throw await tulisGagal(res);
  return res.json();
}

// 403 di sini hampir selalu berarti service account cuma diberi akses "Viewer"
// pada spreadsheet — membaca jalan, menulis ditolak. Pesan mentah dari Google
// tidak memberi tahu apa yang harus dilakukan, jadi diganti.
async function tulisGagal(res) {
  const body = await res.text();
  if (res.status === 403) {
    const creds = getCreds();
    return new Error(
      "Tidak punya izin menulis ke spreadsheet. Buka Google Sheets → Bagikan, " +
        `lalu beri akses EDITOR ke ${creds?.client_email || "service account"} ` +
        "(sekarang aksesnya masih Pembaca/Viewer). Data tidak berubah."
    );
  }
  return new Error(`Gagal menyimpan (HTTP ${res.status}): ${body.replace(/\s+/g, " ").slice(0, 200)}`);
}

// Perubahan STRUKTUR sheet (menghapus/menyisipkan baris). Endpointnya berbeda
// dari values:batchUpdate yang hanya mengganti isi sel: yang ini menggeser
// baris di bawahnya, jadi nomor baris yang dipegang pemanggil ikut berubah.
/** Tambah baris di bawah tabel secara atomik (values:append) — aman untuk banyak baris sekaligus. */
export async function appendRows(spreadsheetId, range, values, mode = "RAW") {
  const token = await getAccessToken();
  if (!token) throw new Error("Menyimpan butuh GOOGLE_SERVICE_ACCOUNT_JSON (API key hanya bisa membaca).");
  const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${mode}&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
    cache: "no-store",
  });
  if (!res.ok) throw await tulisGagal(res);
  return res.json();
}

export async function structuralUpdate(spreadsheetId, requests) {
  const token = await getAccessToken();
  if (!token) throw new Error("Menyimpan butuh GOOGLE_SERVICE_ACCOUNT_JSON (API key hanya bisa membaca).");
  const res = await fetch(`${API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
    cache: "no-store",
  });
  if (!res.ok) throw await tulisGagal(res);
  return res.json();
}

// Cek apakah service account benar-benar boleh MENULIS di spreadsheet.
// batchUpdate dengan daftar kosong: 400 = boleh (permintaan valid tapi kosong),
// 403 = tidak boleh. Tidak mengubah data apa pun. Hasilnya di-cache singkat.
let _writeProbe = { at: 0, ok: null };
export async function probeWriteAccess(spreadsheetId = SHEET_IDS.master) {
  const now = Date.now();
  if (_writeProbe.ok !== null && now - _writeProbe.at < 120000) return _writeProbe.ok;
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [] }),
      cache: "no-store",
    });
    _writeProbe = { at: now, ok: res.status !== 403 };
  } catch (_) {
    _writeProbe = { at: now, ok: false };
  }
  return _writeProbe.ok;
}
