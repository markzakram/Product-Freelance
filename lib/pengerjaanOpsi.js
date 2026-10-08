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
  ["Kerjakan & lapor progres", "Tiap proyek punya tanggal deadline. Bila proyek mewajibkan lapor progres 30% dan/atau 50%, tanggalnya tertulis di kartu proyek (mis. H-3). Laporkan jumlah soal yang sudah selesai + link Google Docs di Proyek saya paling lambat tanggal itu. Kalau hasil akhir sudah selesai lebih dulu, langsung kumpulkan saja — lapor progresnya dianggap terpenuhi."],
  ["Kumpulkan & review", "Di Proyek saya, kirim link Google Docs dari Drive-mu (akses: siapa saja yang punya link). Tim akademik menilai tiap soal: Approved, Revisi, atau Reject."],
  ["Revisi maksimal 3 hari", "Soal yang diminta revisi wajib diperbaiki dalam 3 hari sejak status Revisi. Soal revisi yang baru disetujui setelah lewat 3 hari dibayar 75% (potongan 25% hanya untuk soal itu)."],
];
export const ATURAN_GURU = [
  "Jumlah proyek yang boleh berjalan bersamaan dibatasi — selesaikan yang lama untuk mengambil yang baru.",
  "Pekerjaan yang direview tidak layak lebih dari 3 kali dapat dikenai potongan 25% dari fee proyek itu.",
  "Soal yang di-reject tidak dibayar.",
];

// ============================================================ lapor progres & pengingat (v3.6.0)
// Titik lapor diatur tim akademik per proyek di Katalog: lapor 30% dan/atau
// 50%, masing-masing dengan TANGGAL tetap (sama untuk semua guru). Server
// menempelkan `p.titik = [{ persen, tanggal }]` (lib/pengerjaan.js →
// lengkapiTitik) dan `p.laporan = [{ soal, waktu, t, link, catatan, otomatis }]`.
export const PERSEN_LAPOR = [30, 50];
export const OTOMATIS = "[otomatis]"; // awalan catatan laporan yang dibuat sistem saat hasil akhir dikumpulkan

/** Soal minimal untuk memenuhi titik lapor `persen`. */
export const minimalSoal = (jumlah, persen) => Math.ceil(((jumlah || 0) * persen) / 100);

/** "H-3" / "Hari H" / "lewat 2 hari" dari hasil hitungMundur. */
export const labelH = (hm) => (hm?.hari == null ? "" : hm.hari > 0 ? `H-${hm.hari}` : hm.hari === 0 ? "Hari H" : `lewat ${-hm.hari} hari`);

/** "Jum, 10 Okt" — hari & tanggal singkat untuk pengingat. */
export function tanggalHari(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${HARI[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]}, ${+m[3]} ${BLN[+m[2] - 1]}`;
}

/**
 * Status tiap titik lapor satu pengambilan. Titik yang tanggalnya sudah lewat
 * saat guru di-acc tidak berlaku untuknya (tidak adil menandainya telat).
 * Titik terpenuhi oleh laporan PERTAMA yang soalnya ≥ minimal; telat bila
 * laporan itu masuk setelah tanggalnya berakhir (23.59 WIB).
 * -> [{ persen, tanggal, min, selesai, laporan, telat, lewat, hm, h }]
 */
export function statusTitik(p, kini = Date.now()) {
  const laporan = (p.laporan || []).filter((l) => l.t).sort((a, b) => a.t - b.t);
  return (p.titik || [])
    .filter((t) => !p.tAcc || p.tAcc <= akhirHari(t.tanggal))
    .map((t) => {
      const min = minimalSoal(p.jumlah, t.persen);
      const lap = laporan.find((l) => l.soal >= min) || null;
      const hm = hitungMundur(t.tanggal, kini);
      return { ...t, min, selesai: Boolean(lap), laporan: lap, telat: Boolean(lap && lap.t > akhirHari(t.tanggal)), lewat: !lap && hm.lewat, hm, h: labelH(hm) };
    });
}

/** Titik lapor berikutnya yang belum dipenuhi (null bila tidak ada / sudah semua). */
export const titikBerikut = (p, kini = Date.now()) => statusTitik(p, kini).find((s) => !s.selesai) || null;

/** Masih wajib lapor progres sekarang? (hanya selama Running) */
export const perluLapor = (p, kini = Date.now()) => p.status === ST.running && Boolean(titikBerikut(p, kini));

/** Laporan progres dari guru (bukan otomatis) yang belum ditandai "sudah dicek" tim akademik. */
export const laporanBaru = (p) => (p.laporan || []).filter((l) => l.t && !l.otomatis && (!p.tDicek || l.t > p.tDicek));

/**
 * Hal yang perlu diingatkan untuk satu pengambilan: deadline besok/hari ini/lewat,
 * lapor progres H-1/Hari H/lewat, batas revisi ≤ 24 jam/lewat.
 * -> [{ jenis: "deadline"|"progres"|"revisi", teks, kelas, lewat, persen? }]
 */
export function pengingat(p, kini = Date.now()) {
  const out = [];
  if (p.status === ST.running && p.deadline) {
    const dl = hitungMundur(p.deadline, kini);
    if (dl.lewat) out.push({ jenis: "deadline", teks: `Deadline ${dl.teks}`, kelas: "rev", lewat: true });
    else if (dl.hari <= 1) out.push({ jenis: "deadline", teks: `Deadline ${dl.teks}`, kelas: dl.hari === 0 ? "rev" : "qc", lewat: false });
  }
  if (p.status === ST.running) {
    const t = titikBerikut(p, kini);
    if (t && (t.lewat || t.hm.hari <= 1)) {
      out.push({ jenis: "progres", persen: t.persen, teks: `Lapor progres ${t.persen}% ${t.lewat ? t.h : t.hm.teks}`, kelas: t.lewat || t.hm.hari === 0 ? "rev" : "qc", lewat: t.lewat });
    }
  }
  if (p.status === ST.revisi && p.tBatas) {
    const sw = sisaWaktu(p.tBatas, kini);
    if (sw.lewat || p.tBatas - kini < 86400000) out.push({ jenis: "revisi", teks: `Batas revisi ${sw.teks}`, kelas: sw.lewat ? "rev" : "qc", lewat: sw.lewat });
  }
  return out;
}
