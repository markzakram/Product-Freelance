// ============================================================================
//  CARI GURU UNTUK PROYEK — mencocokkan satu baris katalog dengan guru di
//  Database guru, memakai jawaban form pendataan:
//    Q "Bidang materi yang dikuasai"   -> BIDANG (pilihan tetap di form)
//    R "Jenis proyek yang ingin diambil" -> minat (soal / video / live / lainnya)
//    S/T bersedia & jadwal live class, U kapasitas per minggu
//  ditambah beban kerja bulan berjalan dan pengalaman dari Log.
//
//  Istilah form berbeda dengan kategori Master (form "Matematika &
//  Kuantitatif" = Master "Numerik", "Hitung Berhitung", …), jadi bidang
//  proyek ditebak dari kata kunci subtes + kategori + platform. Tebakannya
//  hanya pilihan awal — admin bisa menambah/mengurangi bidang di panel.
// ============================================================================

// `guru`: mengenali pilihan form di kolom Q. `proyek`: kata kunci di nama
// subtes / kategori Master / platform.
export const BIDANG = [
  { k: "mtk", label: "Matematika & Kuantitatif", guru: /matematika\s*&\s*kuantitatif/i, proyek: /matemat|numerik|hitung|kuantitatif|deret|matriks|soal cerita|aritmat|statistik/i },
  { k: "logika", label: "Penalaran Logika", guru: /penalaran logika/i, proyek: /logika|silogisme|analitis|penalaran (umum|analitik|verbal)|\btpa\b/i },
  { k: "spasial", label: "Penalaran Spasial/Gambar", guru: /spasial|penalaran gambar/i, proyek: /figural|spasial|gambar|keruangan|next ?box/i },
  { k: "bindo", label: "Bahasa Indonesia & Literasi", guru: /bahasa indonesia/i, proyek: /bahasa indonesia|verbal|literasi|sinonim|antonim|analogi|bacaan/i },
  { k: "bing", label: "Bahasa Inggris", guru: /bahasa inggris|english/i, proyek: /inggris|english|toefl|ielts/i },
  { k: "twk", label: "Pengetahuan & Wawasan Umum", guru: /wawasan umum|pengetahuan\s*&/i, proyek: /\btwk\b|wawasan|kebangsaan|pengetahuan umum|pancasila|nasionalisme/i },
  { k: "tkp", label: "Kepribadian & Karakter Kerja", guru: /kepribadian|karakter kerja/i, proyek: /\btkp\b|kepribadian|karakter|integritas/i },
  { k: "psikotes", label: "Psikotes", guru: /psikotes/i, proyek: /psikotes|psikologi|kraepelin|pauli|wartegg/i },
  { k: "saintek", label: "IPA/Saintek (Fisika, Kimia, Biologi)", guru: /saintek|fisika|kimia|biologi/i, proyek: /fisika|kimia|biologi|\bipa\b|saintek/i },
  { k: "soshum", label: "Soshum (Sejarah, Geografi, Ekonomi, Sosiologi)", guru: /soshum|sejarah|geografi|ekonomi|sosiologi/i, proyek: /sejarah|geografi|ekonomi|sosiologi|soshum|\bips\b/i },
  { k: "beasiswa", label: "Beasiswa & wawancara", guru: /beasiswa|interview|wawancara|lpdp/i, proyek: /beasiswa|lpdp|wawancara|interview|esai|essay|mentor/i },
];

export const JADWAL = [
  { k: "malam1", label: "Sen–Jum 18.00–20.00", re: /18\.00/ },
  { k: "malam2", label: "Sen–Jum 21.00–22.00", re: /21\.00/ },
  { k: "sore", label: "Sen–Jum sore", re: /sore|15\.00/i },
  { k: "akhir", label: "Sabtu–Minggu", re: /sabtu|minggu/i },
  { k: "fleksibel", label: "Fleksibel", re: /fleksibel|menyesuaikan/i },
];

const MINAT = {
  soal: { label: "menyusun soal & pembahasan", re: /penyusunan soal|paket lengkap/i },
  video: { label: "membuat video pembahasan", re: /video pembahasan|paket lengkap/i },
  lengkap: { label: "paket lengkap (soal + video)", re: /paket lengkap|(?=[\s\S]*penyusunan soal)(?=[\s\S]*video pembahasan)/i },
  live: { label: "mengisi live class", re: /live class/i },
  lainnya: { label: "proyek lainnya", re: /proyek lainnya/i },
};

// Status log yang berarti pekerjaan sudah beres (bukan beban lagi).
const SELESAI = /appro|paid|dibayar|selesai|cancel|batal/i;
const low = (s) => String(s ?? "").toLowerCase().trim();

/** Jenis proyek sebuah baris katalog (Soal / Liveclass / Laporan FR / Editor). */
export function jenisProyek(p, m) {
  if (m?.jenis) return m.jenis;
  if (/^laporan/i.test(p.subtes)) return "Laporan FR";
  if (/live ?class/i.test(p.output)) return "Liveclass";
  return "Soal";
}

/** Minat yang dibutuhkan proyek ini, dari jenis & output-nya. */
export function minatDibutuhkan(p, m) {
  const j = jenisProyek(p, m);
  if (j === "Liveclass" || /live ?class/i.test(p.output)) return "live";
  if (j === "Laporan FR" || j === "Editor") return "lainnya";
  const o = low(p.output);
  if (o.includes("video")) return "video";
  if (o.includes("lengkap")) return "lengkap";
  return "soal";
}
export const labelMinat = (k) => MINAT[k]?.label || k;

/** Bidang yang ditebak dari proyek (kunci BIDANG). */
export function bidangProyek(p, m) {
  const teks = `${p.subtes} ${m?.subtes || ""} ${m?.kategori || ""} ${p.platform || ""}`;
  return BIDANG.filter((b) => b.proyek.test(teks)).map((b) => b.k);
}

export const bidangGuru = (g) => BIDANG.filter((b) => b.guru.test(g.bidang || "")).map((b) => b.k);
export const jadwalGuru = (g) => JADWAL.filter((j) => j.re.test(g.jadwalLive || "")).map((j) => j.k);

/** Baris log -> guru di Database guru (ID dulu, lalu nama, lalu nama pendek). */
export function pemetaLog(daftarGuru) {
  const perId = new Map(daftarGuru.filter((g) => g.idGuru).map((g) => [String(g.idGuru), g]));
  const perNama = new Map(daftarGuru.map((g) => [low(g.nama), g]));
  return (a) => {
    const byId = a.idGuru && perId.get(String(a.idGuru));
    if (byId) return byId;
    const n = low(a.guru);
    if (!n) return null;
    return perNama.get(n) || daftarGuru.find((g) => low(g.nama).startsWith(n)) || null;
  };
}

/**
 * Daftar kandidat guru untuk satu proyek, sudah diberi skor.
 * `log` = baris log bulan berjalan; `riwayat` = log lintas bulan (yang tampil).
 */
export function kandidatGuru({ proyek: p, master: m, guru, log = [], riwayat = [], akun = new Map() }) {
  const peta = pemetaLog(guru);
  const beban = new Map(); // idGuru/nama -> soal berjalan
  const ambilIni = new Map(); // soal proyek ini yang sudah diambil
  const kunci = (g) => g.idGuru || g.nama;
  log.forEach((a) => {
    const g = peta(a);
    if (!g) return;
    if (!SELESAI.test(a.status || "") && a.jumlah > 0) beban.set(kunci(g), (beban.get(kunci(g)) || 0) + a.jumlah);
    if (a.idProject === p.id && !/cancel|batal/i.test(a.status || "")) ambilIni.set(kunci(g), (ambilIni.get(kunci(g)) || 0) + (a.jumlah || 0));
  });
  const pernah = new Map(); // soal subtes yang sama di bulan mana pun yang tampil
  const namaSubtes = low(p.subtes);
  riwayat.forEach((a) => {
    if (low(a.subtes) !== namaSubtes || /cancel|batal/i.test(a.status || "")) return;
    const g = peta(a);
    if (g) pernah.set(kunci(g), (pernah.get(kunci(g)) || 0) + (a.jumlah || 0));
  });

  const perlu = minatDibutuhkan(p, m);
  return guru.map((g) => {
    const k = kunci(g);
    const bidang = bidangGuru(g);
    const minatSesuai = MINAT[perlu].re.test(g.jenisProyek || "") && (perlu !== "live" || !/^tidak/i.test(g.liveclass || ""));
    const a = g.email ? akun.get(low(g.email)) : null;
    const punyaAkun = Boolean(a && a.punyaPassword && a.status === "Aktif");
    const x = {
      g,
      bidang,
      tanpaBidang: !bidang.length,
      jadwal: jadwalGuru(g),
      minatSesuai,
      beban: beban.get(k) || 0,
      sudahAmbil: ambilIni.get(k) || 0,
      pernah: pernah.get(k) || 0,
      baru: /baru/i.test(g.status || ""),
      punyaAkun,
      kapasitas: g.kapasitas || 0,
    };
    // Urutan: berminat, berpengalaman di subtes ini, guru lama, lalu yang
    // paling longgar. Yang sudah mengambil proyek ini turun ke bawah.
    x.skor = (minatSesuai ? 4 : 0) + (x.pernah ? 2 : 0) + (x.baru ? 0 : 1) - Math.min(3, x.beban / 40) - (x.sudahAmbil ? 5 : 0);
    return x;
  });
}

/** Pesan WA penawaran proyek. */
export function pesanTawaran(k, p, asal) {
  return (
    `Halo ${k.g.nama}, ada proyek baru yang sesuai bidang Anda:\n\n` +
    `*${p.subtes}* — ${p.output || "proyek"}\n` +
    `Fee Rp${Math.round(p.harga || 0).toLocaleString("id-ID")}/soal · sisa kuota ${p.sisa} soal\n\n` +
    `Lihat dan ambil di: ${asal}/open\n` +
    (k.punyaAkun ? "Masuk dengan akun yang sudah dikirim admin.\n" : "") +
    "Terima kasih!"
  );
}
