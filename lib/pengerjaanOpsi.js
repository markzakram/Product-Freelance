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
export const BATAS_REVISI_JAM = 72; // revisi maks 3 hari sejak status Revisi…
export const BATAS_REVISI_MIN_JAM = 24; // …tidak melewati deadline proyek, tapi minimal 24 jam
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

/**
 * Batas kirim revisi hasil akhir (ms): 3 hari sejak review, dipotong ke akhir hari
 * deadline proyek (23.59 WIB) bila lebih dulu. Bila sisa waktunya < 24 jam
 * (review dilakukan setelah/menjelang deadline), guru tetap diberi 24 jam.
 */
export function batasRevisiMs(deadline, kini = Date.now()) {
  const normal = kini + BATAS_REVISI_JAM * 3600000;
  const akhir = akhirHari(deadline);
  return Math.max(akhir ? Math.min(normal, akhir) : normal, kini + BATAS_REVISI_MIN_JAM * 3600000);
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
  ["Revisi maksimal 3 hari", "Soal yang diminta revisi wajib diperbaiki dalam 3 hari sejak status Revisi dan tidak melewati deadline proyek (bila review dilakukan menjelang/setelah deadline, tetap ada waktu minimal 24 jam). Batasnya tertulis di Proyek saya. Soal revisi yang dikirim lewat batas dibayar 75% (potongan 25% hanya untuk soal itu)."],
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

/** Semua laporan progres yang dikirim guru sendiri (bukan otomatis saat hasil akhir dikumpulkan), urut waktu. */
export function laporanGuru(p) {
  if (!p.riwayat?.length) return (p.laporan || []).filter((l) => l.t && !l.otomatis).sort((a, b) => a.t - b.t).map((l, i) => ({ ...l, id: `lama-${p.id}-laporan-${i + 1}`, laporanId: `lama-${p.id}-laporan-${i + 1}`, noLaporan: i + 1, versi: 1, persen: l.soal >= minimalSoal(p.jumlah, 50) ? 50 : 30 }));
  const terbaru = new Map();
  for (const e of p.riwayat) if (e.jenis === "laporan" || e.jenis === "revisi_laporan") terbaru.set(e.laporanId, e);
  return [...terbaru.values()].sort((a, b) => a.t - b.t);
}

/** Laporan progres dari guru (bukan otomatis) yang belum ditandai "sudah dicek" tim akademik. */
export const laporanBaru = (p) => laporanGuru(p).filter((l) => statusLaporan(p, l) === "baru");

/** Pemeriksaan berlaku untuk satu versi laporan, bukan semua laporan guru. */
export function statusLaporan(p, laporan) {
  if (!p.riwayat?.length) return p.tDicek && laporan.t <= p.tDicek ? "dicek" : "baru";
  const keputusan = [...p.riwayat].reverse().find((e) => e.laporanId === laporan.laporanId && e.versi === laporan.versi && ["dicek", "minta_revisi"].includes(e.jenis));
  return keputusan?.jenis === "minta_revisi" ? "revisi" : keputusan ? "dicek" : "baru";
}

export const revisiProgres = (p) => laporanGuru(p).filter((l) => statusLaporan(p, l) === "revisi");

/** Nomor perbaikan yang sudah dikirim berbeda dari nomor revisi berikutnya yang diminta. */
export function siklusRevisi(p, persen, laporanId) {
  if (persen !== 100) {
    const laporan = laporanGuru(p).find((l) => l.laporanId === laporanId);
    if (!laporan) return { dikirim: 0, diminta: 0 };
    return { dikirim: Math.max(0, laporan.versi - 1), diminta: statusLaporan(p, laporan) === "revisi" ? laporan.versi : 0 };
  }
  const kiriman = riwayatPengambilan(p).filter((e) => ["pengumpulan", "revisi_akhir"].includes(e.jenis));
  const versi = Math.max(0, ...kiriman.map((e) => e.versi || 1));
  return { dikirim: Math.max(0, versi - 1), diminta: p.status === ST.revisi ? Math.max(1, versi, p.ronde || 0) : 0 };
}

export function labelSiklusRevisi(siklus) {
  return siklus.diminta ? `Revisi ${siklus.diminta} diminta` : siklus.dikirim ? `Revisi ${siklus.dikirim} dikirim` : "";
}

/** Snapshot data lama hanya memakai kejadian yang masih diketahui, tanpa mengarang versi yang hilang. */
export function riwayatPengambilan(p) {
  if (p.riwayat?.length) return [...p.riwayat].sort((a, b) => a.t - b.t);
  const events = [];
  for (const l of laporanGuru(p)) {
    events.push({ ...l, jenis: "laporan", oleh: p.nama, lama: true });
    if (p.tDicek && l.t <= p.tDicek) events.push({ id: `${l.id}-dicek`, laporanId: l.id, noLaporan: l.noLaporan, versi: 1, persen: l.persen, jenis: "dicek", waktu: p.dicek, t: p.tDicek, oleh: p.dicekOleh, lama: true });
  }
  if (p.tDikumpulkan) events.push({ id: `lama-${p.id}-akhir`, laporanId: `lama-${p.id}-akhir`, jenis: "pengumpulan", persen: 100, versi: Math.max(1, (p.ronde || 0) + (p.status === ST.review ? 1 : 0)), soal: p.jumlah, link: p.link, catatan: p.catatanGuru, waktu: p.dikumpulkan, t: p.tDikumpulkan, oleh: p.nama, lama: true });
  if (p.direview) events.push({ id: `lama-${p.id}-review`, jenis: "review", persen: 100, versi: Math.max(1, p.ronde || 0), waktu: p.direview, t: msWaktu(p.direview), oleh: p.reviewer, catatan: p.catatanRevisi, meta: { setuju: (p.tepat || 0) + (p.telat || 0), revisi: p.status === ST.revisi || (p.status === ST.review && p.batasRevisi) ? belumSelesai(p) : 0, tolak: (p.tolakBuka || 0) + (p.tolakHangus || 0), batas: p.batasRevisi, ronde: p.ronde }, lama: true });
  return events.sort((a, b) => a.t - b.t);
}

export function progresPengambilan(p) {
  const akhir = riwayatPengambilan(p).some((e) => ["pengumpulan", "revisi_akhir"].includes(e.jenis));
  const soal = akhir ? p.jumlah : Math.max(0, ...laporanGuru(p).map((l) => l.soal || 0));
  return { soal, persen: p.jumlah ? Math.min(100, Math.round(soal / p.jumlah * 100)) : 0 };
}

/** Tahap aktif mengikuti laporan terakhir; 100% tidak menyatakan hasil sudah disetujui. */
export function tahapAktif(p) {
  if ([ST.diajukan, ST.ditolak, ST.dibatalkan].includes(p.status)) return null;
  if ([ST.review, ST.revisi, ST.selesai].includes(p.status) || riwayatPengambilan(p).some((e) => e.persen === 100)) return 100;
  const laporan = laporanGuru(p);
  if (laporan.length) return Math.max(...laporan.map((l) => l.persen));
  return statusTitik(p)[0]?.persen || 100;
}

export function tahapPengambilan(p, persen) {
  if ([ST.diajukan, ST.ditolak, ST.dibatalkan].includes(p.status)) return { label: p.status === ST.diajukan ? "Belum mulai" : "—", kelas: "", tanggal: p.status === ST.diajukan ? persen === 100 ? p.deadline : p.titik?.find((t) => t.persen === persen)?.tanggal : "" };
  if (persen === 100) {
    const riwayat = riwayatPengambilan(p);
    const akhir = riwayat.filter((e) => ["pengumpulan", "revisi_akhir"].includes(e.jenis)).slice(-1)[0];
    const review = riwayat.filter((e) => e.jenis === "review").slice(-1)[0];
    const label = p.status === ST.selesai ? "Selesai" : p.status === ST.revisi ? "Revisi" : akhir ? "Direview" : "Menunggu";
    const waktu = [ST.revisi, ST.selesai].includes(p.status) ? review?.waktu || p.direview || akhir?.waktu : akhir?.waktu;
    return { label, kelas: p.status === ST.selesai ? "appr" : p.status === ST.revisi ? "rev" : akhir ? "qc" : "", waktu: waktu || "", tanggal: p.deadline, laporan: null, siklus: siklusRevisi(p, 100) };
  }
  const semua = laporanGuru(p);
  const laporan = semua.filter((l) => l.persen === persen).slice(-1)[0] || semua.filter((l) => l.soal >= minimalSoal(p.jumlah, persen)).slice(-1)[0];
  const titik = statusTitik(p).find((t) => t.persen === persen);
  if (laporan) {
    const status = statusLaporan(p, laporan);
    const via = laporan.persen !== persen ? laporan.persen : null;
    const keputusan = [...(p.riwayat || [])].reverse().find((e) => e.laporanId === laporan.laporanId && e.versi === laporan.versi && ["dicek", "minta_revisi"].includes(e.jenis));
    const waktu = keputusan?.waktu || (status === "dicek" ? p.dicek : "") || laporan.waktu;
    return { label: via ? `Via ${via}%` : status === "revisi" ? "Revisi" : status === "baru" ? "Baru" : "Diperiksa", kelas: status === "revisi" ? "rev" : status === "baru" ? "qc" : "appr", waktu, tanggal: titik?.tanggal, laporan, via, siklus: siklusRevisi(p, laporan.persen, laporan.laporanId) };
  }
  const akhir = riwayatPengambilan(p).find((e) => ["pengumpulan", "revisi_akhir"].includes(e.jenis));
  if (titik?.laporan?.otomatis || akhir) return { label: "Via hasil akhir", kelas: "run", tanggal: titik?.tanggal, waktu: akhir?.waktu || titik?.laporan?.waktu, via: 100 };
  return { label: titik ? "Menunggu" : "Tidak wajib", kelas: titik?.lewat ? "rev" : "", tanggal: titik?.tanggal };
}

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
