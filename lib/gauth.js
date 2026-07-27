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

export const SHEET_IDS = {
  // The "Juli_Proyek ASN & Bappenas" and "Data guru freelance" tabs both live
  // in this spreadsheet ("PROYEK GURU FREELANCE").
  master: process.env.SHEET_ID_MASTER || "13woeXhJ8-1hNjvJbJeZegsFHbRiDg3Klppj1v4wyBiQ",
  rekap: process.env.SHEET_ID_REKAP || "14xyyMKPud3i8z9AfivMObOZwiejbMZbu0YuSAO5lRU8",
  juli: process.env.SHEET_ID_JULI || "16PZr4sBmozX344o47KYc9EyM7GmZzFmwAtz0gLzfbOQ",
};

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
export async function batchRead(spreadsheetId, ranges, ap) {
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${API}/${spreadsheetId}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE${ap.key}`;
  const res = await fetch(url, { headers: ap.headers, cache: "no-store" });
  if (!res.ok) throw new Error(`batchGet: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.valueRanges || []).map((v) => v.values || []);
}

// --- Writes (service account only) -----------------------------------------
// `data` is [{ range: "'Tab'!J12:J12", values: [[...]] }, ...]
// USER_ENTERED so that dd/mm/yyyy dates and "=FORMULA(...)" strings are parsed
// by Sheets exactly as if a human had typed them.
export async function batchWrite(spreadsheetId, data) {
  const token = await getAccessToken();
  if (!token) throw new Error("Menyimpan butuh GOOGLE_SERVICE_ACCOUNT_JSON (API key hanya bisa membaca).");
  const res = await fetch(`${API}/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`batchUpdate gagal: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
