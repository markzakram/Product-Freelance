// ============================================================================
//  Sisi browser pencatatan reachout. Dipanggil dari onClick tombol WhatsApp
//  admin: tautan wa.me tetap terbuka seperti biasa, pencatatan jalan di
//  belakang. Perubahan diumumkan lewat event window "gf:reachout" supaya
//  AdminBoard (pemilik data) bisa langsung memperbaruinya tanpa menunggu
//  baca ulang spreadsheet — dan tanpa mengoper callback ke tiap komponen.
// ============================================================================

import { msKeWaktu } from "./reachoutOpsi";

export const EVENT_REACHOUT = "gf:reachout";
const KUNCI_PIC = "gf_pic";

const umumkan = (detail) => window.dispatchEvent(new CustomEvent(EVENT_REACHOUT, { detail }));

/** PIC yang dipilih admin di perangkat ini (halaman Pantau reachout). */
export function picSaya() {
  try {
    return localStorage.getItem(KUNCI_PIC) || "";
  } catch (_) {
    return "";
  }
}
export function aturPicSaya(nama) {
  try {
    if (nama) localStorage.setItem(KUNCI_PIC, nama);
    else localStorage.removeItem(KUNCI_PIC);
  } catch (_) {}
}

function idBaru() {
  const acak = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return acak.replace(/[^a-z0-9]/gi, "").slice(0, 16);
}

async function kirim(payload) {
  const res = await fetch("/api/admin/reachout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    keepalive: true, // di HP, membuka WhatsApp bisa membekukan halaman ini
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

/**
 * Catat satu kontak WA. `isi`: { tujuan, idGuru, nama, email, wa, bulan?, idProyek?, subtes? }.
 * Langsung tampil (sementara), lalu dikonfirmasi atau dibatalkan setelah server menjawab.
 */
export function catatWa(isi) {
  if (typeof window === "undefined") return;
  const t = Date.now();
  const k = { ...isi, kid: idBaru(), pic: picSaya(), waktu: msKeWaktu(t), t, hasil: "", tHasil: 0, sementara: true };
  umumkan({ jenis: "tambah", kontak: k });
  const { sementara, t: _t, tHasil, hasil, waktu, ...data } = k;
  kirim({ action: "catat", ...data })
    .then(() => umumkan({ jenis: "tersimpan", kid: k.kid }))
    .catch((e) => umumkan({ jenis: "gagal", kid: k.kid, pesan: "Kontak WA tidak tercatat: " + e.message }));
}

/** Tandai hasil satu kontak; kembali ke nilai lama bila gagal disimpan. */
export function tandaiHasilWa(kontak, hasil) {
  const lama = { hasil: kontak.hasil, tHasil: kontak.tHasil };
  umumkan({ jenis: "hasil", kid: kontak.kid, hasil, tHasil: hasil ? Date.now() : 0 });
  kirim({ action: "hasil", kid: kontak.kid, hasil }).catch((e) => {
    umumkan({ jenis: "hasil", kid: kontak.kid, ...lama });
    umumkan({ jenis: "galat", pesan: "Hasil tidak tersimpan: " + e.message });
  });
}
