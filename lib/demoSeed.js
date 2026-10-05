// ============================================================================
//  DATA CONTOH MODE DEMO — mengisi ulang spreadsheet DEMO dengan skenario
//  fiktif yang lengkap: pendaftar di tiap tahap seleksi, guru dengan akun,
//  katalog bulan berjalan, dan pengambilan proyek di setiap status (menunggu
//  acc, running, menunggu review, revisi, selesai, ditolak).
//
//  Dipanggil tombol "Pulihkan data contoh" (app/api/admin/demo). Pengaman
//  berlapis — semuanya harus lolos sebelum satu sel pun ditulis:
//    1. MODE_DEMO aktif (env NEXT_PUBLIC_DEMO_MODE=1);
//    2. semua SHEET_ID_* terisi dan BUKAN ID spreadsheet asli (lib/gauth.js);
//    3. spreadsheet tujuan punya tab penanda "MODE DEMO" — tab ini hanya
//       dibuat oleh skrip penyiapan awal, tidak pernah oleh aplikasi.
//  Tab "Master_Project" & "Panduan" tidak disentuh.
// ============================================================================

import crypto from "node:crypto";
import { SHEET_IDS, ID_PRODUKSI, authParams, batchRead, batchWrite, batchClear, sheetMeta, structuralUpdate } from "./gauth";
import { MODE_DEMO, PASSWORD_DEMO, GURU_DEMO, TIM_DEMO } from "./demo";
import { isiUlangBulan, listMonthTabs, lupakanDaftarTab } from "./juli";
import { MONTHS, kodeBulan, createMonth } from "./months";
import { getMaster } from "./master";
import { hashPassword, cocokPassword } from "./sandi";
import { kolomAkhir } from "./tabSheet";
import { TAB_GURU, COL as COL_GURU, lupakanGuru } from "./teachers";
import { TAB_AKUN, TAB_ATUR, HEADER_AKUN, HEADER_ATUR } from "./akun";
import { TAB_TIM, H as H_TIM } from "./akunTim";
import { TAB_SELEKSI, TAB_QC, H_SELEKSI, H_QC } from "./seleksi";
import { CHECKLIST } from "./seleksiOpsi";
import { TAB_REACHOUT, H as H_REACHOUT } from "./reachout";
import { TAB_PENANDA, H as H_PENANDA } from "./penandaGuru";
import { TAB_ATURAN, H as H_ATURAN } from "./aturanProyek";
import { TAB_PENGERJAAN, H as H_PENGERJAAN } from "./pengerjaan";
import { TAB_PERUBAHAN, H as H_PERUBAHAN } from "./perubahanGuru";
import { msKeWaktu, TUJUAN_REKRUT } from "./reachoutOpsi";
import { norm } from "./format";

export const TAB_PENANDA_DEMO = "MODE DEMO";
const TAB_FORM = process.env.TAB_PENDAFTARAN || "Form responses 1";
const JAM = 3600000;
const HARI = 24 * JAM;

const galat = (pesan, status = 400) => Object.assign(new Error(pesan), { status });

// ------------------------------------------------------------------ pengaman
/** Syarat 1 & 2 — diperiksa sebelum menghubungi Google sama sekali. */
function cekIdDemo() {
  if (!MODE_DEMO) throw galat("Hanya tersedia di situs demo.", 404);
  const asli = new Set(Object.values(ID_PRODUKSI));
  if (Object.values(SHEET_IDS).some((id) => !id || asli.has(id))) {
    throw galat("SHEET_ID_* situs demo kosong atau menunjuk spreadsheet asli — data contoh tidak ditulis.", 500);
  }
}

/** Lempar galat bila salah satu syarat MODE DEMO tidak terpenuhi. */
export async function pastikanDemo(ap) {
  cekIdDemo();
  for (const id of new Set([SHEET_IDS.master, SHEET_IDS.pendaftaran])) {
    const tabs = await sheetMeta(id, ap);
    if (!tabs.some((t) => t.title === TAB_PENANDA_DEMO)) {
      throw galat(`Spreadsheet tujuan tidak punya tab penanda "${TAB_PENANDA_DEMO}" — data contoh tidak ditulis.`, 500);
    }
  }
}

// ------------------------------------------------------------------ waktu
const waktu = (ms) => msKeWaktu(ms); // "05/10/2026 09:48" (WIB)
const isoWib = (ms) => new Date(ms + 7 * JAM).toISOString().slice(0, 10);
/** Format stempel waktu Google Form: "05/10/2026 09:48:12". */
const stempelForm = (ms) => `${waktu(ms)}:${String(Math.floor((ms / 1000) % 60)).padStart(2, "0")}`;
const baris = (header, isi) => header.map((h) => (isi[h] === undefined || isi[h] === null ? "" : isi[h]));
const kid = () => crypto.randomBytes(6).toString("hex");

// ------------------------------------------------------------------ orang
// Guru (Data guru). Tiga yang pertama punya akun login (GURU_DEMO).
const GURU = [
  { id: "1", nama: "Ayu Lestari, S.Pd", email: GURU_DEMO[0].email, wa: "081200000101", status: "Guru Lama", jk: "Perempuan", pend: "S1", jur: "Pendidikan Matematika", univ: "Universitas Contoh Nusantara", kerja: "Guru SMA", bidang: "Matematika, Penalaran Kuantitatif", jenis: "Soal & Pembahasan, Liveclass", live: "Ya", jadwal: "Senin–Jumat, 19.00–21.00", kap: 40, hari: 120 },
  { id: "2", nama: "Bima Pratama, S.Si", email: GURU_DEMO[1].email, wa: "081200000102", status: "Guru Lama", jk: "Laki-laki", pend: "S1", jur: "Fisika", univ: "Institut Contoh Teknologi", kerja: "Tentor bimbel", bidang: "Fisika, Kimia, Penalaran Umum", jenis: "Soal & Pembahasan", live: "Mungkin", jadwal: "Akhir pekan", kap: 30, hari: 95 },
  { id: "3", nama: "Citra Dewi, M.Pd", email: GURU_DEMO[2].email, wa: "081200000103", status: "Guru Baru", jk: "Perempuan", pend: "S2", jur: "Pendidikan Bahasa Indonesia", univ: "Universitas Contoh Pendidikan", kerja: "Dosen", bidang: "Literasi Bahasa Indonesia, Literasi Bahasa Inggris", jenis: "Soal & Pembahasan", live: "Tidak", jadwal: "", kap: 25, hari: 30 },
  { id: "4", nama: "Dedi Kurniawan, S.Pd", email: "dedi.demo@contoh.test", wa: "081200000104", status: "Guru Lama", jk: "Laki-laki", pend: "S1", jur: "Pendidikan Pancasila", univ: "Universitas Contoh Nusantara", kerja: "Guru SMP", bidang: "TWK, TIU", jenis: "Soal & Pembahasan, Video Pembahasan", live: "Ya", jadwal: "Setiap hari setelah 16.00", kap: 50, hari: 150 },
  { id: "5", nama: "Eka Putri Ramadhani, S.Pd", email: "eka.demo@contoh.test", wa: "081200000105", status: "Guru Baru", jk: "Perempuan", pend: "S1", jur: "Pendidikan Bahasa Inggris", univ: "Universitas Contoh Pendidikan", kerja: "Guru les privat", bidang: "Literasi Bahasa Inggris", jenis: "Soal & Pembahasan", live: "Mungkin", jadwal: "Selasa & Kamis malam", kap: 20, hari: 18 },
  { id: "6", nama: "Fajar Nugroho, S.Kom", email: "fajar.demo@contoh.test", wa: "081200000106", status: "Guru Baru", jk: "Laki-laki", pend: "S1", jur: "Ilmu Komputer", univ: "Institut Contoh Teknologi", kerja: "Pengajar bootcamp", bidang: "TIU, Penalaran Umum", jenis: "Soal & Pembahasan, Liveclass", live: "Ya", jadwal: "Sabtu–Minggu", kap: 30, hari: 16 },
  { id: "7", nama: "Gita Anggraini, S.Psi", email: "gita.demo@contoh.test", wa: "081200000107", status: "Guru Lama", jk: "Perempuan", pend: "S1", jur: "Psikologi", univ: "Universitas Contoh Nusantara", kerja: "Konselor sekolah", bidang: "TKP", jenis: "Soal & Pembahasan", live: "", jadwal: "", kap: 30, hari: 200 },
  { id: "8", nama: "Hendra Wijaya, M.Si", email: "hendra.demo@contoh.test", wa: "081200000108", status: "Guru Lama", jk: "Laki-laki", pend: "S2", jur: "Kimia", univ: "Institut Contoh Teknologi", kerja: "Guru SMA", bidang: "Kimia, Biologi", jenis: "Soal & Pembahasan", live: "Tidak", jadwal: "", kap: 20, hari: 180 },
];
// Pendaftar yang belum masuk Data guru.
const PENDAFTAR_BARU = [
  { nama: "Indah Permatasari, S.Pd", email: "indah.demo@contoh.test", wa: "081200000109", status: "Guru Baru", pend: "S1", jur: "Pendidikan Biologi", univ: "Universitas Contoh Pendidikan", kerja: "Guru SMA", bidang: "Biologi", jenis: "Soal & Pembahasan", live: "Ya", kap: 20, hari: 1 },
  { nama: "Irfan Maulana, S.Pd", email: "irfan.demo@contoh.test", wa: "081200000110", status: "Guru Baru", pend: "S1", jur: "Pendidikan Matematika", univ: "Universitas Contoh Nusantara", kerja: "Guru SD", bidang: "Matematika", jenis: "Soal & Pembahasan", live: "Mungkin", kap: 15, hari: 6 },
  { nama: "Joko Santoso, S.T.", email: "joko.demo@contoh.test", wa: "081200000111", status: "Guru Baru", pend: "S1", jur: "Teknik Sipil", univ: "Institut Contoh Teknologi", kerja: "Karyawan swasta", bidang: "Fisika", jenis: "Video Pembahasan", live: "Tidak", kap: 10, hari: 12 },
  { nama: "Kartika Sari, S.Hum", email: "kartika.demo@contoh.test", wa: "081200000112", status: "Guru Baru", pend: "S1", jur: "Sastra Inggris", univ: "Universitas Contoh Nusantara", kerja: "Penerjemah lepas", bidang: "Literasi Bahasa Inggris", jenis: "Soal & Pembahasan", live: "Mungkin", kap: 20, hari: 4 },
];

// Katalog cadangan bila Master_Project kosong.
const KATALOG_CADANGAN = [
  { subtes: "Penalaran Umum", platform: "SIADU", harga: 15000 },
  { subtes: "Pengetahuan Kuantitatif", platform: "SIADU", harga: 15000 },
  { subtes: "Literasi Bahasa Indonesia", platform: "SIADU", harga: 12000 },
  { subtes: "Literasi Bahasa Inggris", platform: "SIADU", harga: 12000 },
  { subtes: "Penalaran Matematika", platform: "SIADU", harga: 15000 },
  { subtes: "Tes Wawasan Kebangsaan", platform: "SIADU", harga: 10000 },
  { subtes: "Tes Intelegensia Umum", platform: "SIADU", harga: 10000 },
  { subtes: "Tes Karakteristik Pribadi", platform: "SIADU", harga: 9000 },
];
const KEBUTUHAN = [40, 30, 30, 25, 30, 50, 40, 40];
const OUTPUT = "Soal & Pembahasan";

/** 8 baris katalog dari Master_Project (harga pasti untuk Soal & Pembahasan / Lengkap). */
function pilihKatalog(master, bulan) {
  const kode = kodeBulan(bulan);
  const dari = [];
  const nama = new Set();
  for (const m of master) {
    if (dari.length >= 8) break;
    if (!m.subtes || /arsip/i.test(m.status) || nama.has(m.subtes.toLowerCase())) continue;
    const h = m.harga?.[OUTPUT]?.ada && !m.harga[OUTPUT].tentatif ? m.harga[OUTPUT] : m.harga?.Lengkap?.ada && !m.harga.Lengkap.tentatif ? m.harga.Lengkap : null;
    if (!h || !h.min) continue;
    nama.add(m.subtes.toLowerCase());
    dari.push({ subtes: m.subtes, platform: m.platform || "SIADU", harga: h.min, idSubtes: m.id });
  }
  for (const c of KATALOG_CADANGAN) {
    if (dari.length >= 8) break;
    if (!nama.has(c.subtes.toLowerCase())) dari.push({ ...c, idSubtes: "" });
  }
  return dari.map((p, i) => ({ ...p, id: `${kode}-${String(i + 1).padStart(2, "0")}`, output: OUTPUT, kebutuhan: KEBUTUHAN[i] }));
}

// ------------------------------------------------------------------ bulan
/** Tab bulan berjalan (dibuat / diganti nama dari bulan lama); bulan lain dikosongkan. */
async function siapkanBulan(ap, kini) {
  const bulan = MONTHS[new Date(kini + 7 * JAM).getUTCMonth()];
  lupakanDaftarTab();
  const list = await listMonthTabs(ap);
  let tab = list.find((m) => m.bulan === bulan)?.tab;
  let lama = null;
  if (!tab && list.length) {
    // data contoh selalu di bulan berjalan: tab bulan terakhir diganti nama
    lama = list[list.length - 1].tab;
    tab = `${bulan}_Freelance`;
    const meta = await sheetMeta(SHEET_IDS.master, ap);
    const sheetId = meta.find((t) => t.title === lama)?.sheetId;
    await structuralUpdate(SHEET_IDS.master, [{ updateSheetProperties: { properties: { sheetId, title: tab }, fields: "title" } }]);
  }
  if (!tab) tab = (await createMonth(bulan)).tab;
  lupakanDaftarTab();
  const lain = list.map((m) => m.tab).filter((t) => t !== tab && t !== lama);
  return { tab, bulan, lain };
}

// ------------------------------------------------------------------ isi
/** Hash password akun contoh: dipakai ulang bila masih cocok (sesi yang sedang login tidak putus). */
async function hashDemo(lama) {
  if (lama && (await cocokPassword(PASSWORD_DEMO, lama))) return lama;
  return hashPassword(PASSWORD_DEMO);
}

function cocokKolom(head) {
  const cari = (re) => head.findIndex((h) => re.test(norm(h)));
  return {
    waktu: cari(/^timestamp|stempel waktu/i),
    email: cari(/e-?mail/i),
    wa: cari(/whatsapp/i),
    nama: cari(/^nama lengkap/i),
    pendidikan: cari(/^pendidikan/i),
    jurusan: cari(/^jurusan/i),
    universitas: cari(/universitas/i),
    pekerjaan: cari(/^pekerjaan/i),
    pengalaman: cari(/pengalaman/i),
    statusForm: head.findIndex((h) => /^status$/i.test(norm(h))),
    live: cari(/bersedia.*live/i),
    jadwal: cari(/ketersediaan/i),
    bidang: cari(/^bidang/i),
    jenisProyek: cari(/^jenis proyek/i),
    kapasitas: cari(/kapasitas/i),
    cv: cari(/cv/i),
    portofolio: cari(/portofolio/i),
  };
}

function barisForm(head, p, kini) {
  const k = cocokKolom(head);
  const r = new Array(head.length).fill("");
  const isi = (kunci, v) => k[kunci] >= 0 && (r[k[kunci]] = v);
  const slug = p.email.split("@")[0];
  isi("waktu", stempelForm(kini - p.hari * HARI));
  isi("email", p.email);
  isi("wa", p.wa);
  isi("nama", p.nama);
  isi("pendidikan", p.pend);
  isi("jurusan", p.jur);
  isi("universitas", p.univ);
  isi("pekerjaan", p.kerja);
  isi("pengalaman", "Data contoh — 3 tahun mengajar dan membuat soal latihan.");
  isi("statusForm", p.status);
  isi("live", p.live);
  isi("jadwal", p.jadwal || "");
  isi("bidang", p.bidang);
  isi("jenisProyek", p.jenis);
  isi("kapasitas", p.kap);
  isi("cv", `https://drive.google.com/file/d/DEMO-cv-${slug}/view`);
  isi("portofolio", `https://drive.google.com/file/d/DEMO-portofolio-${slug}/view`);
  return r;
}

function barisDataGuru(lebar, g, kini) {
  const r = new Array(lebar).fill("");
  const huruf = (c) => (c.length === 1 ? c.charCodeAt(0) - 65 : 26 + c.charCodeAt(1) - 65);
  const isi = (f, v) => COL_GURU[f] && huruf(COL_GURU[f]) < lebar && (r[huruf(COL_GURU[f])] = v);
  isi("idGuru", g.id);
  r[1] = stempelForm(kini - g.hari * HARI); // kolom B = stempel waktu form
  isi("email", g.email);
  isi("wa", g.wa);
  isi("status", g.status);
  isi("nama", g.nama);
  isi("jenisKelamin", g.jk);
  isi("pendidikan", g.pend);
  isi("jurusan", g.jur);
  isi("universitas", g.univ);
  isi("pekerjaan", g.kerja);
  isi("bidang", g.bidang);
  isi("jenisProyek", g.jenis);
  isi("liveclass", g.live);
  isi("jadwalLive", g.jadwal);
  isi("kapasitas", g.kap);
  isi("catatan", "Data contoh (fiktif).");
  isi("cv", `https://drive.google.com/file/d/DEMO-cv-${g.email.split("@")[0]}/view`);
  isi("rekening", `12345678${g.id.padStart(2, "0")} (Bank Contoh)`);
  isi("pemilikRekening", g.nama.split(",")[0]);
  isi("npwp", "-");
  return r;
}

/**
 * Isi ulang seluruh data contoh. Mengembalikan ringkasan jumlah baris.
 * `kini` bisa diberikan untuk pengujian.
 */
export async function pulihkanDataContoh({ kini = Date.now() } = {}) {
  cekIdDemo();
  const ap = await authParams();
  if (!ap?.write) throw galat("Butuh service account dengan akses Editor.", 500);
  await pastikanDemo(ap);
  const M = SHEET_IDS.master;
  const R = SHEET_IDS.pendaftaran;

  // --- baca yang perlu dipertahankan: judul kolom form & Data guru, hash akun contoh
  const metaM = await sheetMeta(M, ap);
  const metaR = R === M ? metaM : await sheetMeta(R, ap);
  if (!metaM.some((t) => t.title === TAB_GURU)) throw galat(`Tab "${TAB_GURU}" belum ada di spreadsheet demo — jalankan penyiapan awal.`, 500);
  if (!metaR.some((t) => t.title === TAB_FORM)) throw galat(`Tab "${TAB_FORM}" belum ada di spreadsheet demo — jalankan penyiapan awal.`, 500);
  const ada = new Set(metaM.map((t) => t.title));
  const tabAkun = [TAB_AKUN, TAB_TIM].filter((t) => ada.has(t));
  const [[headGuru = []] = [], ...akunLama] = await batchRead(M, [`'${TAB_GURU}'!A1:AC1`, ...tabAkun.map((t) => `'${t}'!A2:D200`)], ap);
  const [[headForm = []] = []] = await batchRead(R, [`'${TAB_FORM}'!A1:BZ1`], ap);
  if (headForm.length < 5) throw galat(`Judul kolom tab "${TAB_FORM}" di spreadsheet demo kosong — jalankan penyiapan awal.`, 500);
  const hashLama = new Map(akunLama.flatMap((rows) => (rows || []).map((r) => [norm(r[0]).toLowerCase(), norm(r[3])])));

  // --- tab kecil yang belum ada dibuat sekaligus
  const KECIL = [
    [TAB_AKUN, HEADER_AKUN], [TAB_ATUR, HEADER_ATUR], [TAB_TIM, H_TIM], [TAB_SELEKSI, H_SELEKSI], [TAB_QC, H_QC],
    [TAB_REACHOUT, H_REACHOUT], [TAB_PENANDA, H_PENANDA], [TAB_ATURAN, H_ATURAN], [TAB_PENGERJAAN, H_PENGERJAAN], [TAB_PERUBAHAN, H_PERUBAHAN],
  ];
  const baru = KECIL.filter(([t]) => !ada.has(t));
  if (baru.length) {
    await structuralUpdate(M, baru.map(([title, h]) => ({ addSheet: { properties: { title, gridProperties: { rowCount: 500, columnCount: Math.max(h.length, 12), frozenRowCount: 1 } } } })));
  }

  // --- bulan & katalog
  const { tab, bulan, lain } = await siapkanBulan(ap, kini);
  const master = (await getMaster()).rows || [];
  const katalog = pilihKatalog(master, bulan);
  const P = (i) => katalog[i];
  const tim = { seleksi: TIM_DEMO.find((t) => t.peran.includes("Seleksi"))?.nama || "Tim Seleksi", akademik: TIM_DEMO.find((t) => t.peran.includes("Akademik"))?.nama || "Tim Akademik" };
  const g = (id) => GURU.find((x) => x.id === id);
  const dok = (s) => `https://docs.google.com/document/d/DEMO-${s}/edit`;

  // Log pengambilan (urutan = nomor baris mulai baris 10)
  const LOG = [
    { kunci: "A1", guru: "1", p: 0, jumlah: 10, status: "Running Soal", hari: 3 },
    { kunci: "B1", guru: "2", p: 2, jumlah: 8, status: "QC Soal", hari: 5 },
    { kunci: "B2", guru: "2", p: 3, jumlah: 6, status: "Approved", hari: 9 },
    { kunci: "B3", guru: "2", p: 4, jumlah: 12, status: "Running Soal", hari: 4 },
    { kunci: "C1", guru: "3", p: 5, jumlah: 10, status: "Revisi Soal", hari: 6 },
    { kunci: "D1", guru: "4", p: 6, jumlah: 15, status: "Approved", hari: 12 }, // dicatat manual (tanpa pengajuan)
    { kunci: "D2", guru: "4", p: 7, jumlah: 8, status: "Running Soal", hari: 2 },
    { kunci: "G1", guru: "7", p: 1, jumlah: 10, status: "Approved", hari: 15 },
  ];
  const assignments = LOG.map((l) => ({
    tanggal: isoWib(kini - l.hari * HARI),
    idProject: P(l.p).id,
    guru: g(l.guru).nama,
    idGuru: l.guru,
    subtes: P(l.p).subtes,
    jumlah: l.jumlah,
    status: l.status,
  }));
  const barisLog = Object.fromEntries(LOG.map((l, i) => [l.kunci, 10 + i]));

  // Aturan proyek: [proyek, deadline (hari lagi), wajib lapor %]. Dipilih supaya
  // pengingat (≤24 jam) langsung terlihat: lapor 50% Ayu ±20 jam lagi, deadline
  // Bima besok, batas revisi Citra ±20 jam lagi.
  const ATURAN = [[0, 4, 50], [1, 10, 0], [2, 5, 0], [3, 3, 0], [4, 1, 30], [5, 6, 0], [6, 4, 0]];
  const deadline = (i) => {
    const a = ATURAN.find((x) => x[0] === i);
    return a ? isoWib(kini + a[1] * HARI) : "";
  };

  // Pengerjaan (pengambilan lewat dashboard)
  const pj = (k, guruId, p, isi) => {
    const gg = g(guruId);
    return baris(H_PENGERJAAN, {
      ID: `PJ-DEMO-${k}`, Bulan: tab, "ID proyek": P(p).id, Subtes: P(p).subtes, Output: P(p).output,
      "ID guru": guruId, "Nama guru": gg.nama, Email: gg.email, Deadline: deadline(p), ...isi,
    });
  };
  const putus = (hari, jam = 2) => ({ Diputuskan: waktu(kini - hari * HARI + jam * JAM), Oleh: tim.akademik, Diajukan: waktu(kini - hari * HARI) });
  const PENGERJAAN = [
    pj("A1", "1", 0, { Jumlah: 10, Status: "Running", ...putus(3), "Baris log": barisLog.A1, "Wajib lapor (%)": 50 }),
    pj("A2", "1", 1, { Jumlah: 5, Status: "Diajukan", Diajukan: waktu(kini - 5 * JAM) }),
    pj("B1", "2", 2, {
      Jumlah: 8, Status: "Ready to review", ...putus(5), "Baris log": barisLog.B1,
      Link: dok("hasil-bima-1"), Dikumpulkan: waktu(kini - 6 * JAM), "Catatan guru": "Sudah lengkap dengan pembahasan. Mohon dicek ya kak.",
    }),
    pj("B2", "2", 3, {
      Jumlah: 6, Status: "Selesai", ...putus(9), "Baris log": barisLog.B2, Link: dok("hasil-bima-2"), Dikumpulkan: waktu(kini - 8 * HARI),
      "Ronde review": 1, "Disetujui tepat": 6, "Disetujui telat": 0, "Ditolak dibuka": 0, "Ditolak hangus": 0, "Review gagal": 0,
      Direview: waktu(kini - 7 * HARI), Reviewer: tim.akademik,
    }),
    pj("B3", "2", 4, {
      Jumlah: 12, Status: "Running", ...putus(4), "Baris log": barisLog.B3, "Wajib lapor (%)": 30,
      "Progres (soal)": 4, "Lapor progres": waktu(kini - HARI), "Link progres": dok("progres-bima-3"), "Catatan progres": "4 soal pertama selesai, lanjut minggu ini.",
    }),
    pj("C1", "3", 5, {
      Jumlah: 10, Status: "Revisi", ...putus(6), "Baris log": barisLog.C1, Link: dok("hasil-citra-1"), Dikumpulkan: waktu(kini - 3 * HARI),
      "Ronde review": 1, "Disetujui tepat": 7, "Disetujui telat": 0, "Ditolak dibuka": 0, "Ditolak hangus": 0,
      "Batas revisi": waktu(kini + 20 * JAM), "Catatan revisi": "Soal no. 3, 5, dan 8: kunci jawaban tidak sesuai pembahasan, dan pengecohnya terlalu mudah. Mohon diperbaiki.",
      "Review gagal": 1, Direview: waktu(kini - 52 * JAM), Reviewer: tim.akademik,
    }),
    pj("C2", "3", 6, { Jumlah: 5, Status: "Ditolak", ...putus(8, 3), Catatan: "Kuota proyek ini sudah dijanjikan ke guru lain bulan ini." }),
  ];

  const sekarang = waktu(kini);
  const akun = await Promise.all(
    GURU_DEMO.map(async (a) => baris(HEADER_AKUN, {
      Email: a.email, "ID guru": a.idGuru, Nama: g(a.idGuru)?.nama || a.nama, "Hash password": await hashDemo(hashLama.get(a.email)),
      "Wajib ganti password": "FALSE", Status: "Aktif", Dibuat: waktu(kini - 20 * HARI), "Gagal login": 0,
    }))
  );
  const akunTim = await Promise.all(
    TIM_DEMO.map(async (a) => baris(H_TIM, {
      Email: a.email, Nama: a.nama, Peran: a.peran.join(", "), "Hash password": await hashDemo(hashLama.get(a.email)),
      "Wajib ganti password": "FALSE", Status: "Aktif", Dibuat: waktu(kini - 30 * HARI), "Gagal login": 0,
    }))
  );
  const seleksi = [
    ["3", "Lolos sampel", [4, 4, 5], "Sampel rapi, pembahasan runtut.", 22],
    ["5", "Sampel", [4, 3, 4], "Menunggu sampel revisi.", 10],
    ["6", "Lolos sampel", [5, 4, 4], "Siap dibuatkan akun.", 8],
  ].map(([id, tahap, s, cat, hari]) => baris(H_SELEKSI, {
    Email: g(id).email, Nama: g(id).nama, Tahap: tahap, "Skor bidang": s[0], "Skor pengalaman": s[1], "Skor berkas": s[2],
    "Catatan tinjau": cat, Diubah: waktu(kini - hari * HARI), Oleh: tim.seleksi,
  }));
  const pd = (email) => PENDAFTAR_BARU.find((x) => x.email === email);
  seleksi.push(
    baris(H_SELEKSI, { Email: "irfan.demo@contoh.test", Nama: pd("irfan.demo@contoh.test").nama, Tahap: "Tinjau", "Skor bidang": 3, "Skor pengalaman": 4, "Skor berkas": 3, "Catatan tinjau": "Pengalaman cukup, minta contoh soal dulu.", Diubah: waktu(kini - 2 * HARI), Oleh: tim.seleksi }),
    baris(H_SELEKSI, { Email: "joko.demo@contoh.test", Nama: pd("joko.demo@contoh.test").nama, Tahap: "Ditolak", "Skor bidang": 2, "Skor pengalaman": 2, "Skor berkas": 1, "Catatan tinjau": "Bidang belum sesuai kebutuhan proyek.", Diubah: waktu(kini - 9 * HARI), Oleh: tim.seleksi })
  );
  const ceklis = (gagal = []) => CHECKLIST.map((k) => `${k}: ${gagal.includes(k) ? "✗" : "✓"}`).join("; ");
  const qc = [
    ["3", 24, P(2).subtes, ceklis(), "Lolos", "Siap lanjut."],
    ["5", 12, P(3).subtes, ceklis(["Kualitas pilihan jawaban", "Kualitas pembahasan"]), "Perlu revisi", "Pengecoh terlalu mudah ditebak."],
    ["6", 9, P(6).subtes, ceklis(), "Lolos", ""],
  ].map(([id, hari, subtes, c, hasil, cat]) => baris(H_QC, {
    Waktu: waktu(kini - hari * HARI), Email: g(id).email, Nama: g(id).nama, Sesi: 1, "Subtes sampel": subtes,
    "Tautan sampel": dok(`sampel-${id}`), "PIC QC": tim.seleksi, Checklist: c, Hasil: hasil, Catatan: cat,
  }));
  const kontak = (tujuan, orang, hari, hasil, extra = {}) => baris(H_REACHOUT, {
    ID: kid(), Waktu: waktu(kini - hari * HARI), Tujuan: tujuan, "ID guru": orang.id || "", Nama: orang.nama, Email: orang.email, WA: orang.wa,
    PIC: TUJUAN_REKRUT.has(tujuan) ? tim.seleksi : tim.akademik, Hasil: hasil, "Diubah hasil": hasil ? waktu(kini - hari * HARI + 3 * JAM) : "", ...extra,
  });
  const tawar = (p) => ({ Bulan: tab, "ID proyek": P(p).id, Subtes: P(p).subtes });
  const reachout = [
    kontak("Tawaran proyek", g("4"), 13, "Bersedia", tawar(6)),
    kontak("Tawaran proyek", g("1"), 1, "", tawar(1)),
    kontak("Tawaran proyek", g("8"), 3, "", tawar(7)),
    kontak("Info pengambilan", g("2"), 1, "Dibalas"),
    kontak("Kirim akun", g("3"), 20, "Dibalas"),
    kontak("Minta sampel", g("5"), 14, "Dibalas"),
    kontak("Ingatkan aktivasi", g("6"), 3, ""),
    kontak("Sapa pendaftar", pd("kartika.demo@contoh.test"), 3, ""),
    kontak("Sapa pendaftar", pd("irfan.demo@contoh.test"), 5, "Dibalas"),
  ];
  const penanda = [g("1"), g("4")].map((x) => baris(H_PENANDA, { "ID guru": x.id, Nama: x.nama, "Bisa liveclass": "TRUE", Diubah: waktu(kini - 10 * HARI), Oleh: tim.seleksi }));
  const aturan = ATURAN.map(([p, , lapor]) => baris(H_ATURAN, { Bulan: tab, "ID proyek": P(p).id, Deadline: deadline(p), "Lapor progres (%)": lapor || "", Diubah: waktu(kini - 16 * HARI), Oleh: tim.akademik }));
  const perubahan = [baris(H_PERUBAHAN, { Waktu: waktu(kini - 20 * JAM), "ID guru": "2", Nama: g("2").nama, Email: g("2").email, Kolom: "wa", "Nilai lama": g("2").wa, "Nilai baru": "081200000202", Status: "Menunggu" })];
  const pengaturan = [
    ["wajib_login_guru", "TRUE", "Halaman proyek guru wajib login"],
    ["maks_proyek_aktif", "3", "Maks. proyek berjalan bersamaan per guru (diatur tim akademik)"],
  ];

  // --- tulis: katalog & log bulan
  await isiUlangBulan(tab, { projects: katalog, assignments });
  for (const t of lain) await isiUlangBulan(t, {}); // bulan lain dikosongkan

  // --- tulis: tab kecil + Data guru (satu kali hapus, satu kali tulis)
  const TULIS = [
    [TAB_AKUN, HEADER_AKUN, akun], [TAB_ATUR, HEADER_ATUR, pengaturan], [TAB_TIM, H_TIM, akunTim], [TAB_SELEKSI, H_SELEKSI, seleksi],
    [TAB_QC, H_QC, qc], [TAB_REACHOUT, H_REACHOUT, reachout], [TAB_PENANDA, H_PENANDA, penanda], [TAB_ATURAN, H_ATURAN, aturan],
    [TAB_PENGERJAAN, H_PENGERJAAN, PENGERJAAN], [TAB_PERUBAHAN, H_PERUBAHAN, perubahan],
  ];
  const lebarGuru = Math.max(headGuru.length, 29);
  const dataGuru = GURU.map((x) => barisDataGuru(lebarGuru, x, kini));
  await batchClear(M, [...TULIS.map(([t, h]) => `'${t}'!A2:${kolomAkhir(h)}`), `'${TAB_GURU}'!A2:AC`]);
  await batchWrite(
    M,
    [
      ...TULIS.flatMap(([t, h, rows]) => [{ range: `'${t}'!A1`, values: [h] }, ...(rows.length ? [{ range: `'${t}'!A2`, values: rows }] : [])]),
      { range: `'${TAB_GURU}'!A2`, values: dataGuru },
    ],
    "RAW"
  );

  // --- tulis: jawaban form pendaftaran (semua guru + pendaftar baru)
  const form = [...GURU, ...PENDAFTAR_BARU].sort((a, b) => b.hari - a.hari).map((p) => barisForm(headForm, p, kini));
  await batchClear(R, [`'${TAB_FORM}'!A2:BZ`]);
  await batchWrite(R, [{ range: `'${TAB_FORM}'!A2`, values: form }], "RAW");

  lupakanDaftarTab();
  lupakanGuru();
  return {
    bulan: tab,
    katalog: katalog.length,
    log: assignments.length,
    pengerjaan: PENGERJAAN.length,
    guru: GURU.length,
    pendaftar: form.length,
    waktu: sekarang,
  };
}
