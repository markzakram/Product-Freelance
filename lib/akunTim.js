// ============================================================================
//  AKUN TIM — anggota tim yang memakai dashboard admin (tab "Akun tim" di
//  spreadsheet PROYEK GURU FREELANCE). Satu baris = satu orang, dengan peran:
//    Pemilik  : semua menu + mengelola akun tim
//    Seleksi  : pendaftar, kolam & seleksi, corong rekrutmen
//    Akademik : master, katalog, log, pembayaran, review & pantauan proyek
//  Satu orang boleh punya lebih dari satu peran ("Seleksi, Akademik").
//  Password hanya disimpan sebagai hash (lib/sandi.js); password sementara
//  dari pemilik wajib diganti saat masuk pertama.
// ============================================================================

import { namaTab, pastikanTab, bacaBaris, tambahBaris, ubahBaris } from "./tabSheet";
import { hashPassword, passwordAcak } from "./sandi";
import { waktuWib } from "./akun";
import { norm } from "./format";
import { PERAN } from "./auth";

export const TAB_TIM = namaTab("Akun tim", "TAB_AKUN_TIM");
const H = ["Email", "Nama", "Peran", "Hash password", "Wajib ganti password", "Status", "Dibuat", "Password diubah", "Login terakhir", "Gagal login", "Terkunci sampai"];
const K = { email: 0, nama: 1, peran: 2, hash: 3, wajibGanti: 4, status: 5, dibuat: 6, diubah: 7, loginTerakhir: 8, gagal: 9, terkunciSampai: 10 };
export const STATUS_TIM = { aktif: "Aktif", nonaktif: "Nonaktif" };

const rapikanEmail = (e) => norm(e).toLowerCase();
/** "akademik, seleksi" / ["Seleksi"] -> ["Seleksi", "Akademik"] (urutan & ejaan baku). */
export const rapikanPeran = (p) => {
  const t = (Array.isArray(p) ? p.join(",") : String(p || "")).toLowerCase();
  return PERAN.filter((x) => t.includes(x.toLowerCase()));
};

// Sesi tim diperiksa di SETIAP permintaan admin (dashboard memanggil ±6 API
// sekaligus saat dibuka) — permintaan yang bersamaan berbagi satu pembacaan.
let cache = null; // { at, rows }
let janjiBaca = null;
const TTL = 30000;
const lupakan = () => (cache = null);

export async function bacaAkunTim({ segar = false } = {}) {
  if (!segar && cache && Date.now() - cache.at < TTL) return cache.rows;
  if (!janjiBaca) {
    janjiBaca = bacaBaris(TAB_TIM, H, 500).finally(() => (janjiBaca = null));
  }
  let mentah;
  try {
    mentah = await janjiBaca;
  } catch (e) {
    // Sheets sedang gangguan/kuota habis: data akun terakhir (maks. 10 menit)
    // lebih baik daripada mengeluarkan semua anggota tim. Tanpa data lama -> gagal.
    if (cache && Date.now() - cache.at < 600000) return cache.rows;
    throw e;
  }
  const rows = mentah
    .map(({ row, v }) => ({
      row,
      email: rapikanEmail(v[0]),
      nama: norm(v[1]),
      peran: rapikanPeran(v[2]),
      hash: norm(v[3]),
      wajibGanti: /^(true|ya|1)$/i.test(norm(v[4])),
      status: norm(v[5]) || STATUS_TIM.aktif,
      dibuat: norm(v[6]),
      diubah: norm(v[7]),
      loginTerakhir: norm(v[8]),
      gagal: parseInt(norm(v[9]), 10) || 0,
      terkunciSampai: norm(v[10]),
    }))
    .filter((a) => a.email);
  cache = { at: Date.now(), rows };
  return rows;
}

export async function cariAkunTim(email, opt) {
  const e = rapikanEmail(email);
  return (await bacaAkunTim(opt)).find((a) => a.email === e) || null;
}

/** Ubah beberapa kolom satu baris: `patch` = { nama, peran, hash, … }. */
export async function ubahAkunTim(row, patch) {
  const isi = {};
  for (const [f, v] of Object.entries(patch)) {
    if (!(f in K)) continue;
    isi[K[f]] = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : Array.isArray(v) ? v.join(", ") : v ?? "";
  }
  lupakan();
  await ubahBaris(TAB_TIM, row, isi);
  lupakan();
}

/** Tanpa hash — aman dikirim ke browser pemilik. */
export const akunTimPublik = (a) => ({
  email: a.email,
  nama: a.nama,
  peran: a.peran,
  status: a.status,
  wajibGanti: a.wajibGanti,
  dibuat: a.dibuat,
  loginTerakhir: a.loginTerakhir,
  terkunci: Boolean(a.terkunciSampai && Date.parse(a.terkunciSampai) > Date.now()),
});

/** Tambah anggota tim; password sementara dikembalikan SEKALI untuk diserahkan pemilik. */
export async function buatAkunTim({ email, nama, peran }) {
  const e = rapikanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Email tidak valid.");
  const p = rapikanPeran(peran);
  if (!p.length) throw new Error("Pilih minimal satu peran.");
  const n = norm(nama).slice(0, 80);
  if (!n) throw new Error("Nama wajib diisi.");
  if (await cariAkunTim(e, { segar: true })) throw new Error("Email ini sudah terdaftar di akun tim.");
  const password = passwordAcak();
  await pastikanTab(TAB_TIM, H);
  lupakan();
  await tambahBaris(TAB_TIM, H, [[e, n, p.join(", "), await hashPassword(password), "TRUE", STATUS_TIM.aktif, waktuWib(), "", "", "0", ""]]);
  lupakan();
  return { email: e, nama: n, peran: p, password };
}

/** Reset oleh pemilik: password acak baru, wajib diganti, kunci dilepas, akun diaktifkan. */
export async function resetAkunTim(email) {
  const a = await cariAkunTim(email, { segar: true });
  if (!a) throw new Error("Akun tim tidak ditemukan.");
  const password = passwordAcak();
  await ubahAkunTim(a.row, { hash: await hashPassword(password), wajibGanti: true, status: STATUS_TIM.aktif, diubah: waktuWib(), gagal: "0", terkunciSampai: "" });
  return { email: a.email, nama: a.nama, peran: a.peran, password };
}

export async function aturAkunTim(email, { status, peran, nama }) {
  const a = await cariAkunTim(email, { segar: true });
  if (!a) throw new Error("Akun tim tidak ditemukan.");
  const patch = {};
  if (status !== undefined) patch.status = status === STATUS_TIM.nonaktif ? STATUS_TIM.nonaktif : STATUS_TIM.aktif;
  if (peran !== undefined) {
    const p = rapikanPeran(peran);
    if (!p.length) throw new Error("Pilih minimal satu peran.");
    patch.peran = p;
  }
  if (nama !== undefined && norm(nama)) patch.nama = norm(nama).slice(0, 80);
  await ubahAkunTim(a.row, patch);
}
