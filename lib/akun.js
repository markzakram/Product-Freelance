// ============================================================================
//  DATA LAYER — akun login guru (tab "Akun guru") & pengaturan (tab
//  "Pengaturan"), keduanya di spreadsheet PROYEK GURU FREELANCE.
//
//  Satu baris = satu email yang pernah diputuskan admin:
//    Aktif / Nonaktif  -> punya akun (hash password)
//    Ditolak           -> pendaftar yang ditolak (tanpa password)
//  Password TIDAK PERNAH disimpan sebagai teks — hanya hash (lib/sandi.js).
//  Tab dibuat otomatis saat pertama dipakai.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite, appendRows, sheetMeta, structuralUpdate } from "./gauth";
import { hashPassword, passwordAcak } from "./sandi";
import { norm } from "./format";

const ID = SHEET_IDS.master;
// Nama tab bisa ditimpa HANYA untuk pengujian lokal (tab uji terpisah).
export const TAB_AKUN = (process.env.NODE_ENV !== "production" && process.env.TAB_AKUN_GURU) || "Akun guru";
export const TAB_ATUR = (process.env.NODE_ENV !== "production" && process.env.TAB_PENGATURAN) || "Pengaturan";

const HEADER_AKUN = [
  "Email",
  "ID guru",
  "Nama",
  "Hash password",
  "Wajib ganti password",
  "Status",
  "Dibuat",
  "Password diubah",
  "Login terakhir",
  "Gagal login",
  "Terkunci sampai",
];
const HEADER_ATUR = ["Kunci", "Nilai", "Keterangan"];
const KOLOM = { email: "A", idGuru: "B", nama: "C", hash: "D", wajibGanti: "E", status: "F", dibuat: "G", diubah: "H", loginTerakhir: "I", gagal: "J", terkunciSampai: "K" };

export const STATUS = { aktif: "Aktif", nonaktif: "Nonaktif", ditolak: "Ditolak" };
export const MAKS_GAGAL = 5;
export const LAMA_KUNCI_MENIT = 15;

const qa = (a1) => `'${TAB_AKUN}'!${a1}`;
const qp = (a1) => `'${TAB_ATUR}'!${a1}`;
export const rapikanEmail = (e) => norm(e).toLowerCase();

/** "26/09/2026 14:05" (WIB) — untuk dibaca manusia di spreadsheet. */
export function waktuWib(d = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/\./g, ":")
    .replace(",", "");
}

// ---------------------------------------------------------------- tab dasar
let tabSiap = new Set();
async function pastikanTab(judul, header) {
  if (tabSiap.has(judul)) return;
  const ap = await authParams();
  const ada = (await sheetMeta(ID, ap)).some((t) => t.title === judul);
  if (!ada) {
    try {
      await structuralUpdate(ID, [
        { addSheet: { properties: { title: judul, gridProperties: { rowCount: 500, columnCount: header.length, frozenRowCount: 1 } } } },
      ]);
    } catch (e) {
      // dua permintaan bersamaan sama-sama membuat tab: yang kalah cukup lanjut
      if (!/already exists|sudah ada/i.test(e.message)) throw e;
    }
    await batchWrite(ID, [{ range: `'${judul}'!A1`, values: [header] }], "RAW");
  }
  tabSiap.add(judul);
}

// ---------------------------------------------------------------- akun
const TTL = 20000;
let cache = null; // { at, rows }

function mapAkun(rows) {
  const out = [];
  rows.forEach((r, i) => {
    const email = rapikanEmail(r[0]);
    if (!email) return;
    out.push({
      row: i + 2,
      email,
      idGuru: norm(r[1]),
      nama: norm(r[2]),
      hash: norm(r[3]),
      wajibGanti: /^(true|ya|1)$/i.test(norm(r[4])),
      status: norm(r[5]) || STATUS.aktif,
      dibuat: norm(r[6]),
      diubah: norm(r[7]),
      loginTerakhir: norm(r[8]),
      gagal: parseInt(norm(r[9]), 10) || 0,
      terkunciSampai: norm(r[10]),
    });
  });
  return out;
}

/** Semua baris akun. `segar` = lewati cache (untuk login & tulis). */
export async function bacaAkun({ segar = false } = {}) {
  if (!segar && cache && Date.now() - cache.at < TTL) return cache.rows;
  const ap = await authParams();
  if (!ap) return [];
  await pastikanTab(TAB_AKUN, HEADER_AKUN);
  const [rows] = await batchRead(ID, [qa("A2:K2000")], ap);
  const hasil = mapAkun(rows || []);
  cache = { at: Date.now(), rows: hasil };
  return hasil;
}
const lupakan = () => (cache = null);

export async function cariAkun(email, opt) {
  const e = rapikanEmail(email);
  return (await bacaAkun(opt)).find((a) => a.email === e) || null;
}

/** Ubah beberapa kolom satu baris akun. */
export async function ubahAkun(row, patch) {
  const data = [];
  for (const [f, v] of Object.entries(patch)) {
    if (!KOLOM[f]) continue;
    const nilai = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v ?? "";
    data.push({ range: qa(`${KOLOM[f]}${row}`), values: [[String(nilai)]] });
  }
  if (!data.length) return;
  await batchWrite(ID, data, "RAW");
  lupakan();
}

const barisBaru = (a) => [
  a.email,
  a.idGuru || "",
  a.nama || "",
  a.hash || "",
  a.wajibGanti ? "TRUE" : "FALSE",
  a.status || STATUS.aktif,
  waktuWib(),
  "",
  "",
  "0",
  "",
];

/**
 * Buat akun untuk beberapa guru sekaligus (satu kali tulis). Tiap guru dapat
 * password acak yang wajib diganti saat masuk pertama. Password asli hanya
 * dikembalikan di sini — untuk dikirim admin lewat WhatsApp — lalu hilang.
 * Email yang sudah punya baris (akun/ditolak) diperbarui, bukan diduplikasi.
 */
export async function buatAkun(daftar) {
  await pastikanTab(TAB_AKUN, HEADER_AKUN);
  const ada = await bacaAkun({ segar: true });
  const hasil = [];
  const tambah = [];
  for (const g of daftar) {
    const email = rapikanEmail(g.email);
    if (!email) continue;
    const password = passwordAcak();
    const hash = await hashPassword(password);
    const lama = ada.find((a) => a.email === email);
    if (lama) {
      await ubahAkun(lama.row, {
        idGuru: g.idGuru || lama.idGuru,
        nama: g.nama || lama.nama,
        hash,
        wajibGanti: true,
        status: STATUS.aktif,
        diubah: waktuWib(),
        gagal: 0,
        terkunciSampai: "",
      });
    } else {
      tambah.push(barisBaru({ email, idGuru: g.idGuru, nama: g.nama, hash, wajibGanti: true }));
    }
    hasil.push({ email, idGuru: g.idGuru || "", nama: g.nama || "", wa: g.wa || "", password });
  }
  if (tambah.length) await appendRows(ID, qa("A1:K1"), tambah, "RAW");
  lupakan();
  return hasil;
}

/** Reset oleh admin: password acak baru, wajib diganti lagi, kunci dilepas. */
export async function resetPassword(email) {
  const a = await cariAkun(email, { segar: true });
  if (!a || a.status === STATUS.ditolak) throw new Error("Akun tidak ditemukan.");
  const password = passwordAcak();
  await ubahAkun(a.row, {
    hash: await hashPassword(password),
    wajibGanti: true,
    status: STATUS.aktif,
    diubah: waktuWib(),
    gagal: 0,
    terkunciSampai: "",
  });
  return { email: a.email, idGuru: a.idGuru, nama: a.nama, password };
}

export async function setStatusAkun(email, status) {
  if (![STATUS.aktif, STATUS.nonaktif].includes(status)) throw new Error("Status tidak dikenal: " + status);
  const a = await cariAkun(email, { segar: true });
  if (!a || !a.hash) throw new Error("Akun tidak ditemukan.");
  await ubahAkun(a.row, { status, gagal: 0, terkunciSampai: "" });
}

/** Tandai pendaftar ditolak (tanpa akun), atau batalkan penolakan. */
export async function setDitolak(email, { nama, batal = false } = {}) {
  await pastikanTab(TAB_AKUN, HEADER_AKUN);
  const e = rapikanEmail(email);
  const a = await cariAkun(e, { segar: true });
  if (batal) {
    if (a && a.status === STATUS.ditolak) await ubahAkun(a.row, { email: "", idGuru: "", nama: "", status: "", dibuat: "", gagal: "" });
    return;
  }
  if (a && a.hash) throw new Error("Email ini sudah punya akun — nonaktifkan akunnya saja.");
  if (a) await ubahAkun(a.row, { status: STATUS.ditolak });
  else await appendRows(ID, qa("A1:K1"), [barisBaru({ email: e, nama, status: STATUS.ditolak })], "RAW");
  lupakan();
}

/** Email guru diganti di Database guru -> akunnya ikut pindah email. */
export async function pindahkanEmail(idGuru, emailBaru) {
  const id = norm(idGuru);
  const e = rapikanEmail(emailBaru);
  if (!id || !e) return;
  const semua = await bacaAkun({ segar: true });
  const a = semua.find((x) => x.idGuru === id && x.hash);
  if (!a || a.email === e) return;
  if (semua.some((x) => x.email === e && x.row !== a.row)) throw new Error(`Email ${e} sudah dipakai akun lain.`);
  await ubahAkun(a.row, { email: e });
}

// ---------------------------------------------------------------- pengaturan
let cacheAtur = null;

export async function bacaPengaturan({ segar = false } = {}) {
  if (!segar && cacheAtur && Date.now() - cacheAtur.at < TTL) return cacheAtur.nilai;
  const ap = await authParams();
  if (!ap) return {};
  await pastikanTab(TAB_ATUR, HEADER_ATUR);
  const [rows] = await batchRead(ID, [qp("A2:B100")], ap);
  const nilai = {};
  (rows || []).forEach((r, i) => {
    const k = norm(r[0]);
    if (k) nilai[k] = { nilai: norm(r[1]), row: i + 2 };
  });
  cacheAtur = { at: Date.now(), nilai };
  return nilai;
}

export async function simpanPengaturan(kunci, nilai, keterangan = "") {
  const semua = await bacaPengaturan({ segar: true });
  const ada = semua[kunci];
  if (ada) await batchWrite(ID, [{ range: qp(`B${ada.row}`), values: [[String(nilai)]] }], "RAW");
  else await appendRows(ID, qp("A1:C1"), [[kunci, String(nilai), keterangan]], "RAW");
  cacheAtur = null;
}

/** Halaman proyek guru wajib login? (diatur admin; bawaan: tidak). */
export async function wajibLoginGuru() {
  try {
    const atur = await bacaPengaturan();
    return /^(true|ya|1)$/i.test(atur.wajib_login_guru?.nilai || "");
  } catch (e) {
    console.error("pengaturan:", e.message);
    return false;
  }
}
