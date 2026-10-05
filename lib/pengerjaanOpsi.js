// ============================================================================
//  PENGERJAAN — status, label & hitungan yang dipakai server (lib/pengerjaan.js)
//  DAN browser (halaman guru, dashboard akademik). Tanpa impor server.
//
//  Alur: guru menekan "Ambil" -> Diajukan -> tim akademik acc -> Running
//  (baris log dibuat) | tolak -> Ditolak (kuota kembali open). Pengajuan yang
//  belum di-acc TIDAK ditulis ke log (kolom Status log punya dropdown ketat);
//  kuotanya dikunci dengan mengurangkan pengajuan yang menunggu dari Sisa.
// ============================================================================

export const ST = {
  diajukan: "Diajukan",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  running: "Running",
};
// Masih memakan jatah "proyek aktif" guru.
export const AKTIF = new Set([ST.diajukan, ST.running, "Ready to review", "Revisi"]);
export const MAKS_AKTIF_BAWAAN = 3;

export const kelasStatus = (s) =>
  ({ [ST.diajukan]: "qc", [ST.running]: "run", [ST.ditolak]: "rev", [ST.dibatalkan]: "batal plain", "Ready to review": "qc", Revisi: "rev", Approved: "appr" })[s] || "qc";
export const labelStatus = (s) => ({ [ST.diajukan]: "Menunggu acc", [ST.running]: "Running · sedang dikerjakan" })[s] || s;

/** Status di kolom log saat di-acc (harus salah satu pilihan dropdown sheet). */
export const statusLogRunning = (output) => (/video/i.test(output || "") && !/lengkap|soal/i.test(output || "") ? "Running Video" : "Running Soal");

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
  ["Kerjakan sebelum deadline", "Tiap proyek punya tanggal deadline — lihat hitung mundurnya di Proyek saya."],
  ["Kumpulkan & review", "Serahkan hasil berupa link Google Docs dari Drive-mu ke tim akademik. Hasilnya dinilai: Approved, Revisi, atau Reject."],
  ["Revisi maksimal 3 hari", "Soal yang diminta revisi wajib diperbaiki dalam 3 hari sejak status Revisi. Soal revisi yang baru disetujui setelah lewat 3 hari dibayar 75% (potongan 25% hanya untuk soal itu)."],
];
export const ATURAN_GURU = [
  "Jumlah proyek yang boleh berjalan bersamaan dibatasi — selesaikan yang lama untuk mengambil yang baru.",
  "Pekerjaan yang direview tidak layak lebih dari 3 kali dapat dikenai potongan 25% dari fee proyek itu.",
  "Soal yang di-reject tidak dibayar.",
];
