// ============================================================================
//  PENGERJAAN — status, label & hitungan yang dipakai server (lib/pengerjaan.js)
//  DAN browser (halaman guru, dashboard akademik). Tanpa impor server.
//
//  Alur: guru menekan "Ambil" -> Diajukan -> tim akademik acc -> Running
//  (baris log dibuat) | tolak -> Ditolak (kuota kembali open). Pengajuan yang
//  belum di-acc TIDAK ditulis ke log (kolom Status log punya dropdown ketat);
//  kuotanya dikunci dengan mengurangkan pengajuan yang menunggu dari Sisa.
// ============================================================================

import { waktuKeMs } from "./reachoutOpsi";

export const ST = {
  diajukan: "Diajukan",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  running: "Running",
  review: "Ready to review",
  revisi: "Revisi",
  selesai: "Selesai",
};
// Masih memakan jatah "proyek aktif" guru.
export const AKTIF = new Set([ST.diajukan, ST.running, ST.review, ST.revisi]);
export const MAKS_AKTIF_BAWAAN = 3;
export const BATAS_REVISI_JAM = 72; // revisi maks 3 hari sejak status Revisi
export const PERINGATAN_MULAI = 2; // review gagal ke-2 & ke-3 -> peringatan
export const DENDA_SETELAH = 4; // review gagal ke-4 ("lebih dari 3×") -> usul denda 25%

export const kelasStatus = (s) =>
  ({ [ST.diajukan]: "qc", [ST.running]: "run", [ST.ditolak]: "rev", [ST.dibatalkan]: "batal plain", [ST.review]: "qc", [ST.revisi]: "rev", [ST.selesai]: "appr" })[s] || "qc";
export const labelStatus = (s) =>
  ({ [ST.diajukan]: "Menunggu acc", [ST.running]: "Running · sedang dikerjakan", [ST.review]: "Menunggu review", [ST.revisi]: "Revisi", [ST.selesai]: "Selesai" })[s] || s;

/** Status di kolom log (harus salah satu pilihan dropdown sheet): Running/QC/Revisi + Soal|Video. */
export const jenisLog = (output) => (/video/i.test(output || "") && !/lengkap|soal/i.test(output || "") ? "Video" : "Soal");
export const statusLog = (output, tahap) => `${{ running: "Running", review: "QC", revisi: "Revisi" }[tahap]} ${jenisLog(output)}`;
export const statusLogRunning = (output) => statusLog(output, "running");

/** Soal yang belum diputuskan (sedang dikerjakan / direview / direvisi). */
export const belumSelesai = (p) => Math.max(0, (p.jumlah || 0) - (p.tepat || 0) - (p.telat || 0) - (p.tolakBuka || 0) - (p.tolakHangus || 0));

/** Link pengumpulan wajib Google Docs / Drive. */
export const linkSah = (u) => /^https:\/\/(docs|drive)\.google\.com\//i.test(String(u || "").trim());

/** Sisa waktu ke batas (ms epoch): "2 hari 5 jam lagi" / "lewat 3 jam". */
export function sisaWaktu(batasMs, kini = Date.now()) {
  if (!batasMs) return { teks: "—", lewat: false, kelas: "batal plain" };
  const d = batasMs - kini;
  const abs = Math.abs(d);
  const hari = Math.floor(abs / 86400000);
  const jam = Math.floor((abs % 86400000) / 3600000);
  const teks = hari ? `${hari} hari${jam ? ` ${jam} jam` : ""}` : jam ? `${jam} jam` : `${Math.max(1, Math.floor(abs / 60000))} menit`;
  return d < 0 ? { teks: `lewat ${teks}`, lewat: true, kelas: "rev" } : { teks: `${teks} lagi`, lewat: false, kelas: d < 86400000 ? "rev" : "qc" };
}
export const msWaktu = waktuKeMs;

/** "2026-10-12" -> ms akhir hari itu (23.59 WIB); 0 bila kosong/tak valid. */
export function akhirHari(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], 23 - 7, 59) : 0;
}

/** Hitung mundur deadline per tanggal kalender WIB: { teks, kelas, lewat, hari } — kelas appr / qc / rev. */
export function hitungMundur(iso, kini = Date.now()) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { teks: "belum ada deadline", kelas: "batal plain", lewat: false, hari: null };
  const HARI = 86400000;
  const hari = Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / HARI) - Math.floor((kini + 7 * 3600000) / HARI);
  if (hari < 0) return { teks: `lewat ${-hari} hari`, kelas: "rev", lewat: true, hari };
  if (hari === 0) return { teks: "hari ini", kelas: "rev", lewat: false, hari };
  if (hari === 1) return { teks: "besok", kelas: "qc", lewat: false, hari };
  return { teks: `${hari} hari lagi`, kelas: hari <= 3 ? "qc" : "appr", lewat: false, hari };
}

export const tanggalPendek = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${+m[3]} ${BLN[+m[2] - 1]} ${m[1]}`;
};

/** Langkah alur untuk guru — dipakai di Panduan dan halaman "Proyek saya". */
export const ALUR_GURU = [
  ["Pilih & ajukan", "Pilih proyek dan jumlah soal di halaman proyek, lalu tekan Ajukan. Kuotanya langsung dipesan untukmu."],
  ["Tunggu acc tim akademik", "Status: Menunggu acc. Bila disetujui, status jadi Running dan kamu mulai mengerjakan. Bila ditolak, kuotanya kembali dibuka untuk guru lain."],
  ["Kerjakan & lapor progres", "Tiap proyek punya tanggal deadline. Bila proyek mewajibkan lapor progres (30% atau 50%), laporkan di Proyek saya sebelum batasnya — hasil akhir baru bisa dikumpulkan setelah lapor progres."],
  ["Kumpulkan & review", "Di Proyek saya, kirim link Google Docs dari Drive-mu (akses: siapa saja yang punya link). Tim akademik menilai tiap soal: Approved, Revisi, atau Reject."],
  ["Revisi maksimal 3 hari", "Soal yang diminta revisi wajib diperbaiki dalam 3 hari sejak status Revisi. Soal revisi yang baru disetujui setelah lewat 3 hari dibayar 75% (potongan 25% hanya untuk soal itu)."],
];
export const ATURAN_GURU = [
  "Jumlah proyek yang boleh berjalan bersamaan dibatasi — selesaikan yang lama untuk mengambil yang baru.",
  "Pekerjaan yang direview tidak layak lebih dari 3 kali dapat dikenai potongan 25% dari fee proyek itu.",
  "Soal yang di-reject tidak dibayar.",
];

// ============================================================ lapor progres & pengingat (v3.4.0)
export const PILIHAN_LAPOR = [0, 30, 50]; // % yang wajib dilaporkan, diatur per proyek di Katalog

/** Jumlah soal minimal untuk memenuhi lapor progres. */
export const minimalLapor = (p) => (p.wajibLapor ? Math.ceil(((p.jumlah || 0) * p.wajibLapor) / 100) : 0);

/**
 * Batas lapor progres: sebanding waktu kerja — acc + (deadline − acc) × persen.
 * Mis. acc 1 Okt, deadline 11 Okt, wajib 30% -> ±4 Okt. 0 bila tak ada deadline.
 */
export function batasLapor(p) {
  const akhir = akhirHari(p.deadline);
  if (!p.wajibLapor || !p.tAcc || !akhir || akhir <= p.tAcc) return 0;
  return Math.round(p.tAcc + ((akhir - p.tAcc) * p.wajibLapor) / 100);
}

/**
 * Hal yang perlu diingatkan untuk satu pengambilan: deadline besok/hari ini/lewat,
 * lapor progres yang jatuh tempo ≤ 24 jam/lewat, batas revisi ≤ 24 jam/lewat.
 * -> [{ jenis: "deadline"|"progres"|"revisi", teks, kelas, lewat }]
 */
export function pengingat(p, kini = Date.now()) {
  const out = [];
  if (p.status === ST.running && p.deadline) {
    const dl = hitungMundur(p.deadline, kini);
    if (dl.lewat) out.push({ jenis: "deadline", teks: `Deadline ${dl.teks}`, kelas: "rev", lewat: true });
    else if (dl.hari <= 1) out.push({ jenis: "deadline", teks: `Deadline ${dl.teks}`, kelas: dl.hari === 0 ? "rev" : "qc", lewat: false });
  }
  if (p.status === ST.running && p.wajibLapor && !p.tLapor) {
    const b = batasLapor(p);
    const sw = sisaWaktu(b, kini);
    if (b && (sw.lewat || b - kini < 86400000))
      out.push({ jenis: "progres", teks: `Lapor progres ${p.wajibLapor}% ${sw.teks}`, kelas: sw.lewat ? "rev" : "qc", lewat: sw.lewat });
  }
  if (p.status === ST.revisi && p.tBatas) {
    const sw = sisaWaktu(p.tBatas, kini);
    if (sw.lewat || p.tBatas - kini < 86400000) out.push({ jenis: "revisi", teks: `Batas revisi ${sw.teks}`, kelas: sw.lewat ? "rev" : "qc", lewat: sw.lewat });
  }
  return out;
}
