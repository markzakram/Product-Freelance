// Pilihan tetap untuk seleksi pendaftar — dipakai server (lib/seleksi.js) DAN
// browser (panel Pendaftaran), jadi sengaja tanpa impor kode server.

export const TAHAP = ["Tinjau", "Sampel", "Lolos sampel", "Ditolak"];
export const HASIL_QC = ["Lolos", "Perlu revisi", "Tidak lolos"];
export const RUBRIK = [
  { k: "bidang", label: "Kesesuaian bidang" },
  { k: "pengalaman", label: "Pendidikan & pengalaman" },
  { k: "berkas", label: "Kelengkapan & kualitas berkas" },
];
// Delapan hal yang dicek pada sampel — Panduan Proyek Freelance, E.2.
export const CHECKLIST = [
  "Kesesuaian materi",
  "Bentuk soal",
  "Tingkat kesulitan",
  "Kualitas pilihan jawaban",
  "Ketepatan kunci jawaban",
  "Kualitas pembahasan",
  "Kesesuaian dengan template",
  "Kesesuaian dengan karakter soal",
];
