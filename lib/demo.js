// ============================================================================
//  MODE DEMO — situs terpisah (proyek Vercel kedua) yang tersambung ke SALINAN
//  spreadsheet berisi data contoh. Diaktifkan dengan env NEXT_PUBLIC_DEMO_MODE=1
//  (ikut ter-build ke browser). Di mode ini: tombol WA hanya membuka pratinjau,
//  form pendaftaran asli tidak ditautkan, akun contoh tampil di halaman login,
//  dan pemilik bisa mereset data contoh (lib/demoSeed.js).
//  Aman dipakai di browser & server — tidak mengimpor apa pun dari server.
// ============================================================================

export const MODE_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// Password akun contoh SENGAJA terbuka (tertulis di halaman login demo). Akun
// ini hanya ada di spreadsheet demo — tidak pernah ada di spreadsheet asli.
export const PASSWORD_DEMO = "Demo2026";

// Skenario tiap akun disiapkan lib/demoSeed.js.
export const GURU_DEMO = [
  { idGuru: "1", email: "ayu.demo@contoh.test", nama: "Ayu Lestari, S.Pd", ket: "proyek berjalan + pengajuan menunggu acc" },
  { idGuru: "2", email: "bima.demo@contoh.test", nama: "Bima Pratama, S.Si", ket: "hasil menunggu review + lapor progres" },
  { idGuru: "3", email: "citra.demo@contoh.test", nama: "Citra Dewi, M.Pd", ket: "sedang revisi (batas 3 hari)" },
];
export const TIM_DEMO = [
  { email: "seleksi.demo@contoh.test", nama: "Tim Seleksi (demo)", peran: ["Seleksi"] },
  { email: "akademik.demo@contoh.test", nama: "Tim Akademik (demo)", peran: ["Akademik"] },
  { email: "pemilik.demo@contoh.test", nama: "Pemilik (demo)", peran: ["Pemilik"] },
];
export const EMAIL_DEMO = new Set([...GURU_DEMO, ...TIM_DEMO].map((a) => a.email));
