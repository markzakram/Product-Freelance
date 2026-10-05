// ============================================================================
//  PENGERJAAN — pengambilan proyek oleh guru lewat dashboard.
//  Tab "Pengerjaan" (spreadsheet PROYEK GURU FREELANCE): satu baris per
//  pengambilan (guru × proyek × bulan). Alur & status: lib/pengerjaanOpsi.js.
//
//  Diajukan  : belum ada di log; kuotanya dipesan (Sisa yang dilihat guru =
//              Sisa sheet − pengajuan yang menunggu).
//  Running   : di-acc tim akademik -> baris log dibuat (status Running Soal/
//              Video), Sisa sheet berkurang lewat rumusnya sendiri.
//  Ditolak / Dibatalkan : tidak pernah masuk log -> kuota otomatis kembali.
//  Ready to review (v3.3.0): guru mengumpulkan link GDoc -> log "QC Soal/Video".
//  Review per SOAL: disetujui / revisi / reject (jumlahnya harus pas).
//    reject  -> langsung: baris log utama dikurangi + baris "Cancel" (dibuka
//               lagi = kuota kembali; hangus = kebutuhan katalog ikut dikurangi)
//    revisi  -> status Revisi, batas 3×24 jam; log "Revisi Soal/Video"
//    selesai -> baris utama Approved (soal tepat waktu); soal revisi yang
//               DIKIRIM guru lewat batas -> baris Approved terpisah tarif 75%.
//  Baris log tambahan ditandai ID pengerjaan di kolom Ket. Tarif.
// ============================================================================

import crypto from "node:crypto";
import { namaTab, bacaBaris, tambahBaris, ubahBaris, pastikanTab } from "./tabSheet";
import { norm, parseNum } from "./format";
import { waktuWib, bacaPengaturan, simpanPengaturan } from "./akun";
import { createAssignment, updateAssignment, updateProject, getBoard } from "./juli";
import { deadlineProyek, laporProyek } from "./aturanProyek";
import { ST, AKTIF, MAKS_AKTIF_BAWAAN, BATAS_REVISI_JAM, DENDA_SETELAH, statusLog, statusLogRunning, hitungMundur, belumSelesai, linkSah, msWaktu, minimalLapor } from "./pengerjaanOpsi";
import { msKeWaktu } from "./reachoutOpsi";

export const TAB_PENGERJAAN = namaTab("Pengerjaan", "TAB_PENGERJAAN");
const H = [
  "ID", "Bulan", "ID proyek", "Subtes", "Output", "ID guru", "Nama guru", "Email", "Jumlah", "Status", "Diajukan", "Diputuskan", "Oleh", "Baris log", "Deadline", "Catatan",
  // v3.3.0 — pengumpulan & review
  "Link", "Dikumpulkan", "Catatan guru", "Ronde review", "Disetujui tepat", "Disetujui telat", "Ditolak dibuka", "Ditolak hangus",
  "Batas revisi", "Catatan revisi", "Review gagal", "Denda", "Baris tolak", "Baris telat", "Direview", "Reviewer",
  // v3.4.0 — lapor progres
  "Wajib lapor (%)", "Progres (soal)", "Lapor progres", "Link progres", "Catatan progres",
];
const K = {
  status: 9, diputuskan: 11, oleh: 12, barisLog: 13, deadline: 14, catatan: 15,
  link: 16, dikumpulkan: 17, catatanGuru: 18, ronde: 19, tepat: 20, telat: 21, tolakBuka: 22, tolakHangus: 23,
  batasRevisi: 24, catatanRevisi: 25, gagal: 26, denda: 27, barisTolak: 28, barisTelat: 29, direview: 30, reviewer: 31,
  wajibLapor: 32, progres: 33, lapor: 34, linkProgres: 35, catatanProgres: 36,
};
const angka = (v) => parseInt(norm(v), 10) || 0;

const galat = (pesan, status = 400) => Object.assign(new Error(pesan), { status });
const low = (s) => norm(s).toLowerCase();

let cache = null; // 10 detik; permintaan bersamaan berbagi satu pembacaan
const lupakan = () => (cache = null);

export async function bacaPengerjaan({ segar = false } = {}) {
  if (!segar && cache && Date.now() - cache.at < 10000) return cache.janji;
  const janji = bacaBaris(TAB_PENGERJAAN, H, 5000).then((rows) =>
    rows
      .map(({ row, v }) => ({
        row,
        id: norm(v[0]),
        bulan: norm(v[1]),
        idProyek: norm(v[2]).toUpperCase(),
        subtes: norm(v[3]),
        output: norm(v[4]),
        idGuru: norm(v[5]),
        nama: norm(v[6]),
        email: low(v[7]),
        jumlah: parseNum(v[8]),
        status: norm(v[9]),
        diajukan: norm(v[10]),
        diputuskan: norm(v[11]),
        tAcc: msWaktu(v[11]),
        oleh: norm(v[12]),
        barisLog: parseInt(norm(v[13]), 10) || 0,
        deadline: norm(v[14]),
        catatan: norm(v[15]),
        link: norm(v[16]),
        dikumpulkan: norm(v[17]),
        tDikumpulkan: msWaktu(v[17]),
        catatanGuru: norm(v[18]),
        ronde: angka(v[19]),
        tepat: angka(v[20]),
        telat: angka(v[21]),
        tolakBuka: angka(v[22]),
        tolakHangus: angka(v[23]),
        batasRevisi: norm(v[24]),
        tBatas: msWaktu(v[24]),
        catatanRevisi: norm(v[25]),
        gagal: angka(v[26]),
        denda: /^(true|ya|1)$/i.test(norm(v[27])),
        barisTolak: angka(v[28]),
        barisTelat: angka(v[29]),
        direview: norm(v[30]),
        reviewer: norm(v[31]),
        wajibLapor: angka(v[32]),
        progres: angka(v[33]),
        lapor: norm(v[34]),
        tLapor: msWaktu(v[34]),
        linkProgres: norm(v[35]),
        catatanProgres: norm(v[36]),
      }))
      .filter((p) => p.id && p.idProyek)
  );
  cache = { at: Date.now(), janji };
  try {
    return await janji;
  } catch (e) {
    if (cache?.janji === janji) cache = null;
    throw e;
  }
}

/** Jumlah soal yang dipesan (menunggu acc) per ID proyek untuk satu bulan. */
export function dipesanPerProyek(semua, bulan) {
  const m = {};
  semua.forEach((p) => p.bulan === bulan && p.status === ST.diajukan && (m[p.idProyek] = (m[p.idProyek] || 0) + p.jumlah));
  return m;
}

const milikGuru = (p, g) => (g.idGuru && p.idGuru === String(g.idGuru)) || (g.email && p.email === low(g.email));

/** Batas proyek aktif per guru (tab Pengaturan, kunci maks_proyek_aktif). */
export async function maksAktif() {
  try {
    const n = parseInt((await bacaPengaturan()).maks_proyek_aktif?.nilai, 10);
    return n > 0 ? n : MAKS_AKTIF_BAWAAN;
  } catch (_) {
    return MAKS_AKTIF_BAWAAN;
  }
}
export async function aturMaksAktif(n) {
  const v = parseInt(n, 10);
  if (!(v >= 1 && v <= 50)) throw galat("Batas proyek aktif harus 1–50.");
  await simpanPengaturan("maks_proyek_aktif", v, "Maks. proyek berjalan bersamaan per guru (diatur tim akademik)");
  return v;
}

const idBaru = () => "PJ-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();

/**
 * Guru mengajukan pengambilan. `items` = [{ idProyek, jumlah }], `board` =
 * papan bulan berjalan (getBoard). Mengembalikan { dibuat, ditolak } —
 * tiap item diperiksa sendiri: satu yang gagal tidak menggagalkan yang lain.
 */
export async function ajukan(guru, items, board) {
  if (!guru?.idGuru && !guru?.email) throw galat("Akun guru tidak dikenal.", 401);
  if (!Array.isArray(items) || !items.length) throw galat("Pilih minimal satu proyek.");
  if (items.length > 20) throw galat("Terlalu banyak proyek sekaligus.");
  const bulan = board.tab;
  const semua = await bacaPengerjaan({ segar: true });
  const maks = await maksAktif();
  let aktif = semua.filter((p) => milikGuru(p, guru) && AKTIF.has(p.status)).length;
  const dipesan = dipesanPerProyek(semua, bulan);
  const proyek = new Map(board.projects.map((p) => [norm(p.id).toUpperCase(), p]));
  const dibuat = [];
  const ditolak = [];
  const baris = [];
  const sudahDiItemIni = new Set();

  for (const it of items) {
    const id = norm(it.idProyek).toUpperCase();
    const p = proyek.get(id);
    const jumlah = parseInt(it.jumlah, 10);
    const tolak = (alasan) => ditolak.push({ idProyek: id, subtes: p?.subtes || "", alasan });
    if (!p) { tolak("Proyek tidak ada di katalog bulan ini."); continue; }
    if (sudahDiItemIni.has(id)) { tolak("Proyek yang sama dipilih dua kali."); continue; }
    if (semua.some((x) => milikGuru(x, guru) && x.bulan === bulan && x.idProyek === id && AKTIF.has(x.status))) {
      tolak("Kamu sudah mengambil proyek ini dan belum selesai.");
      continue;
    }
    const tersedia = Math.max(0, (p.sisa || 0) - (dipesan[id] || 0));
    if (!(jumlah >= 1)) { tolak("Jumlah soal minimal 1."); continue; }
    if (jumlah > tersedia) { tolak(tersedia ? `Sisa kuota tinggal ${tersedia} soal.` : "Kuota proyek ini sudah habis."); continue; }
    const dl = await deadlineProyek(bulan, id);
    if (dl && hitungMundur(dl).lewat) { tolak("Deadline proyek ini sudah lewat."); continue; }
    if (aktif >= maks) { tolak(`Batas ${maks} proyek aktif tercapai — selesaikan proyek yang berjalan dulu.`); continue; }
    aktif++;
    sudahDiItemIni.add(id);
    dipesan[id] = (dipesan[id] || 0) + jumlah;
    const rec = { id: idBaru(), idProyek: id, subtes: p.subtes, output: p.output, jumlah, deadline: dl };
    dibuat.push(rec);
    baris.push([rec.id, bulan, id, p.subtes, p.output || "", guru.idGuru || "", guru.nama || "", low(guru.email), jumlah, ST.diajukan, waktuWib(), "", "", "", dl, ""]);
  }
  if (baris.length) {
    await pastikanTab(TAB_PENGERJAAN, H, { cekJudul: true });
    lupakan();
    await tambahBaris(TAB_PENGERJAAN, H, baris);
    lupakan();
    // Dua guru menekan Ambil bersamaan untuk kuota terakhir: urutan baris di
    // tab menentukan siapa yang dapat; yang kalah dibatalkan otomatis.
    const segar = await bacaPengerjaan({ segar: true });
    const pakai = {};
    for (const x of segar.filter((x) => x.bulan === bulan && x.status === ST.diajukan).sort((a, b) => a.row - b.row)) {
      pakai[x.idProyek] = (pakai[x.idProyek] || 0) + x.jumlah;
      const mine = dibuat.find((d) => d.id === x.id);
      if (mine && pakai[x.idProyek] > (proyek.get(x.idProyek)?.sisa || 0)) {
        await ubahBaris(TAB_PENGERJAAN, x.row, { [K.status]: ST.dibatalkan, [K.catatan]: "Kuota keburu habis diambil guru lain." });
        dibuat.splice(dibuat.indexOf(mine), 1);
        ditolak.push({ idProyek: x.idProyek, subtes: x.subtes, alasan: "Kuota keburu habis diambil guru lain." });
        pakai[x.idProyek] -= x.jumlah;
      }
    }
    lupakan();
  }
  return { dibuat, ditolak, maks };
}

/** Guru membatalkan pengajuannya sendiri (hanya selama belum di-acc). */
export async function batalkanPengajuan(guru, id) {
  const p = (await bacaPengerjaan({ segar: true })).find((x) => x.id === norm(id));
  if (!p || !milikGuru(p, guru)) throw galat("Pengajuan tidak ditemukan.", 404);
  if (p.status !== ST.diajukan) throw galat("Hanya pengajuan yang belum di-acc yang bisa dibatalkan.");
  lupakan();
  await ubahBaris(TAB_PENGERJAAN, p.row, { [K.status]: ST.dibatalkan, [K.diputuskan]: waktuWib(), [K.catatan]: "Dibatalkan guru." });
  lupakan();
}

/**
 * Tim akademik memutuskan pengajuan. Acc -> baris log dibuat di bulan yang
 * sama (status Running Soal/Video) dan kuota sheet berkurang lewat rumusnya.
 */
export async function putuskan(id, { acc, catatan = "" }, oleh, board) {
  const p = (await bacaPengerjaan({ segar: true })).find((x) => x.id === norm(id));
  if (!p) throw galat("Pengajuan tidak ditemukan.", 404);
  if (p.status !== ST.diajukan) throw galat(`Pengajuan ini sudah diputuskan (${p.status}).`, 409);
  const isi = { [K.diputuskan]: waktuWib(), [K.oleh]: norm(oleh).slice(0, 80), [K.catatan]: norm(catatan).slice(0, 500) };
  if (!acc) {
    lupakan();
    await ubahBaris(TAB_PENGERJAAN, p.row, { ...isi, [K.status]: ST.ditolak });
    lupakan();
    return { ...p, status: ST.ditolak };
  }
  if (board.tab !== p.bulan) throw galat(`Pengajuan ini untuk ${p.bulan}; buka bulan itu dulu di dashboard.`, 409);
  const proyek = board.projects.find((x) => norm(x.id).toUpperCase() === p.idProyek);
  if (!proyek) throw galat("Proyek ini sudah tidak ada di katalog.", 409);
  if ((proyek.sisa || 0) < p.jumlah) throw galat(`Sisa kuota di sheet tinggal ${proyek.sisa} soal — kurang dari ${p.jumlah} yang diajukan.`, 409);
  const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const { row } = await createAssignment(
    { tanggal: hariIni, idProject: proyek.id, guru: p.nama, idGuru: p.idGuru, subtes: proyek.subtes, jumlah: p.jumlah, status: statusLogRunning(proyek.output) },
    p.bulan
  );
  const dl = (await deadlineProyek(p.bulan, p.idProyek)) || p.deadline;
  const wajib = await laporProyek(p.bulan, p.idProyek); // aturan saat di-acc yang berlaku untuk guru ini
  lupakan();
  await ubahBaris(TAB_PENGERJAAN, p.row, { ...isi, [K.status]: ST.running, [K.barisLog]: row, [K.deadline]: dl, [K.wajibLapor]: wajib || "" });
  lupakan();
  return { ...p, status: ST.running, barisLog: row, deadline: dl, wajibLapor: wajib };
}

// ===================================================== pengumpulan & review
const cocokGuruLog = (p) => (x) =>
  norm(x.idProject).toUpperCase() === p.idProyek && ((p.idGuru && String(x.idGuru) === p.idGuru) || low(x.guru) === low(p.nama));

/** Baris log utama pengerjaan ini (dicek ulang — baris log bisa bergeser bila ada yang dihapus). */
function barisUtama(p, board) {
  const cocok = cocokGuruLog(p);
  const a = board.assignments.find((x) => x.row === p.barisLog);
  if (a && cocok(a)) return a;
  const calon = board.assignments.filter((x) => cocok(x) && !/approved|paid|cancel/i.test(x.status || ""));
  if (calon.length === 1) return calon[0];
  throw galat("Baris log pengambilan ini tidak ditemukan (mungkin diubah/dihapus manual). Periksa Log pengambilan.", 409);
}
/** Baris log tambahan (tolak / telat) — dikenali dari ID pengerjaan di Ket. Tarif. */
const barisTambahan = (p, board, kata) => board.assignments.find((x) => String(x.ketTarif || "").includes(p.id) && String(x.ketTarif || "").includes(kata));

const hariIniIso = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

/** Guru mengumpulkan hasil (link Google Docs/Drive) — pertama kali atau setelah revisi. */
export async function kumpulkan(guru, id, { link, catatan = "" }) {
  const p = (await bacaPengerjaan({ segar: true })).find((x) => x.id === norm(id));
  if (!p || !milikGuru(p, guru)) throw galat("Proyek tidak ditemukan.", 404);
  if (p.status !== ST.running && p.status !== ST.revisi) throw galat(`Proyek ini tidak sedang menunggu pengumpulan (status: ${p.status}).`, 409);
  if (!linkSah(link)) throw galat("Link harus dari Google Docs / Google Drive (https://docs.google.com/… atau https://drive.google.com/…).");
  if (p.status === ST.running && p.wajibLapor && !p.tLapor) throw galat(`Laporkan progres ${p.wajibLapor}% (minimal ${minimalLapor(p)} soal) dulu sebelum mengumpulkan hasil akhir.`, 409);
  const board = await getBoard(p.bulan);
  const utama = barisUtama(p, board);
  await updateAssignment(utama.row, { status: statusLog(p.output, "review") }, p.bulan);
  lupakan();
  await ubahBaris(TAB_PENGERJAAN, p.row, {
    [K.status]: ST.review,
    [K.link]: norm(link).slice(0, 500),
    [K.dikumpulkan]: waktuWib(),
    [K.catatanGuru]: norm(catatan).slice(0, 1000),
    [K.barisLog]: utama.row,
  });
  lupakan();
  return { id: p.id, status: ST.review };
}

/**
 * Tim akademik mereview satu pengumpulan. `setuju + revisi + tolak` harus sama
 * dengan soal yang sedang dinilai (belumSelesai). `tujuanTolak`: "buka" (kuota
 * kembali ke katalog) atau "hangus" (kebutuhan katalog ikut berkurang).
 */
export async function review(id, { setuju, revisi, tolak, tujuanTolak = "buka", catatan = "" }, oleh) {
  const p = (await bacaPengerjaan({ segar: true })).find((x) => x.id === norm(id));
  if (!p) throw galat("Pengerjaan tidak ditemukan.", 404);
  if (p.status !== ST.review) throw galat(`Belum ada pengumpulan untuk direview (status: ${p.status}).`, 409);
  const n = belumSelesai(p);
  const [a, r, j] = [setuju, revisi, tolak].map((v) => parseInt(v, 10) || 0);
  if (a < 0 || r < 0 || j < 0 || a + r + j !== n) throw galat(`Jumlah disetujui + revisi + reject harus ${n} soal.`);
  if (r > 0 && !norm(catatan)) throw galat("Isi catatan revisi supaya guru tahu apa yang harus diperbaiki.");
  if (j > 0 && !["buka", "hangus"].includes(tujuanTolak)) throw galat("Pilih: soal reject dibuka lagi ke katalog atau tidak.");

  const board = await getBoard(p.bulan);
  const proyek = board.projects.find((x) => norm(x.id).toUpperCase() === p.idProyek);
  const utama = barisUtama(p, board);
  // revisi yang dikirim guru setelah batasnya: soal yang disetujui di ronde ini dibayar 75%
  const telatKirim = Boolean(p.tBatas && p.tDikumpulkan > p.tBatas);
  const baru = {
    tepat: p.tepat + (telatKirim ? 0 : a),
    telat: p.telat + (telatKirim ? a : 0),
    tolakBuka: p.tolakBuka + (tujuanTolak === "buka" ? j : 0),
    tolakHangus: p.tolakHangus + (tujuanTolak === "hangus" ? j : 0),
  };
  const sisaAkhir = belumSelesai({ jumlah: p.jumlah, ...baru }); // = r
  const selesai = r === 0;
  const isi = {
    [K.ronde]: p.ronde + 1,
    [K.tepat]: baru.tepat,
    [K.telat]: baru.telat,
    [K.tolakBuka]: baru.tolakBuka,
    [K.tolakHangus]: baru.tolakHangus,
    [K.catatanRevisi]: norm(catatan).slice(0, 1500),
    [K.direview]: waktuWib(),
    [K.reviewer]: norm(oleh).slice(0, 80),
    [K.barisLog]: utama.row,
  };
  const ket = (teks) => `${teks} · ${p.id}`;
  const harga = proyek?.harga || 0;
  const tarif75 = harga ? Math.round(harga * 0.75) : "";

  // --- reject: langsung keluar dari baris utama
  if (j > 0) {
    const totalTolak = baru.tolakBuka + baru.tolakHangus;
    const ketTolak = ket(`Ditolak ${totalTolak} soal (dibuka lagi ${baru.tolakBuka}, hangus ${baru.tolakHangus})`);
    const ada = barisTambahan(p, board, "Ditolak");
    if (ada) await updateAssignment(ada.row, { jumlah: totalTolak, ketTarif: ketTolak }, p.bulan);
    else {
      const { row } = await createAssignment(
        { tanggal: hariIniIso(), idProject: proyek?.id || p.idProyek, guru: p.nama, idGuru: p.idGuru, subtes: p.subtes, jumlah: totalTolak, status: "Cancel", ketTarif: ketTolak },
        p.bulan
      );
      isi[K.barisTolak] = row;
    }
    if (tujuanTolak === "hangus" && proyek) await updateProject(proyek.row, { kebutuhan: Math.max(0, (proyek.kebutuhan || 0) - j) }, p.bulan);
  }

  if (!selesai) {
    // masih ada yang direvisi: semua soal yang belum ditolak tetap di baris utama
    await updateAssignment(utama.row, { jumlah: sisaAkhir + baru.tepat + baru.telat, status: statusLog(p.output, "revisi") }, p.bulan);
    isi[K.status] = ST.revisi;
    isi[K.batasRevisi] = msKeWaktu(Date.now() + BATAS_REVISI_JAM * 3600000);
    isi[K.gagal] = p.gagal + 1;
  } else {
    // semua soal sudah diputuskan: pecah baris log sesuai hasil
    const denda = p.denda && harga ? { tarif: tarif75, ketTarif: ket("Denda 25% · review gagal >3×") } : { tarif: "", ketTarif: "" };
    if (baru.tepat > 0) {
      await updateAssignment(utama.row, { jumlah: baru.tepat, status: "Approved", ...denda }, p.bulan);
      if (baru.telat > 0) {
        const adaTelat = barisTambahan(p, board, "revisi lewat batas");
        const dataTelat = { jumlah: baru.telat, status: "Approved", tarif: tarif75, ketTarif: ket("Potongan 25% · revisi lewat batas") };
        if (adaTelat) await updateAssignment(adaTelat.row, dataTelat, p.bulan);
        else {
          const { row } = await createAssignment({ tanggal: hariIniIso(), idProject: proyek?.id || p.idProyek, guru: p.nama, idGuru: p.idGuru, subtes: p.subtes, ...dataTelat }, p.bulan);
          isi[K.barisTelat] = row;
        }
      }
    } else if (baru.telat > 0) {
      await updateAssignment(utama.row, { jumlah: baru.telat, status: "Approved", tarif: tarif75, ketTarif: ket("Potongan 25% · revisi lewat batas") }, p.bulan);
    } else {
      // semua soal ditolak: baris utama kosong (fee 0); rinciannya di baris "Ditolak"
      await updateAssignment(utama.row, { jumlah: 0, status: "Cancel", ketTarif: ket("Semua soal ditolak") }, p.bulan);
    }
    isi[K.status] = ST.selesai;
    isi[K.batasRevisi] = "";
  }
  lupakan();
  await ubahBaris(TAB_PENGERJAAN, p.row, isi);
  lupakan();
  return { id: p.id, status: isi[K.status], telatKirim, ...baru };
}

/** Denda 25% (disarankan sistem setelah review gagal ke-4; diputuskan tim akademik). */
export async function terapkanDenda(id, oleh) {
  const p = (await bacaPengerjaan({ segar: true })).find((x) => x.id === norm(id));
  if (!p) throw galat("Pengerjaan tidak ditemukan.", 404);
  if (p.gagal < DENDA_SETELAH) throw galat(`Denda baru bisa diterapkan setelah review gagal ${DENDA_SETELAH}× (sekarang ${p.gagal}×).`);
  if (p.denda) throw galat("Denda sudah diterapkan.", 409);
  if (p.status === ST.selesai && p.tepat > 0) {
    // sudah selesai: potong baris Approved tepat-waktu sekarang juga (baris telat sudah 75%, tidak ditumpuk)
    const board = await getBoard(p.bulan);
    const proyek = board.projects.find((x) => norm(x.id).toUpperCase() === p.idProyek);
    const utama = board.assignments.find((x) => x.row === p.barisLog && cocokGuruLog(p)(x));
    if (!utama || !proyek?.harga) throw galat("Baris log atau harga proyek tidak ditemukan — terapkan potongan manual di Log.", 409);
    await updateAssignment(utama.row, { tarif: Math.round(proyek.harga * 0.75), ketTarif: `Denda 25% · review gagal >3× · ${p.id}` }, p.bulan);
  }
  lupakan();
  await ubahBaris(TAB_PENGERJAAN, p.row, { [K.denda]: "TRUE", [K.catatan]: [p.catatan, `Denda 25% oleh ${norm(oleh)} (${waktuWib()})`].filter(Boolean).join(" · ").slice(0, 500) });
  lupakan();
  return { id: p.id, denda: true };
}

// ============================================================ lapor progres (v3.4.0)
/** Guru melaporkan progres (jumlah soal selesai + link) — wajib bila proyeknya meminta 30%/50%. */
export async function laporProgres(guru, id, { soal, link, catatan = "" }) {
  const p = (await bacaPengerjaan({ segar: true })).find((x) => x.id === norm(id));
  if (!p || !milikGuru(p, guru)) throw galat("Proyek tidak ditemukan.", 404);
  if (p.status !== ST.running) throw galat("Lapor progres hanya untuk proyek yang sedang dikerjakan.", 409);
  const n = parseInt(soal, 10) || 0;
  if (n < 1 || n > p.jumlah) throw galat(`Jumlah soal selesai harus 1–${p.jumlah}.`);
  const min = minimalLapor(p);
  if (min && n < min) throw galat(`Progres yang dilaporkan minimal ${p.wajibLapor}% (${min} soal). Laporkan setelah mencapai jumlah itu.`);
  if (!linkSah(link)) throw galat("Link harus dari Google Docs / Google Drive.");
  lupakan();
  await ubahBaris(TAB_PENGERJAAN, p.row, {
    [K.progres]: n,
    [K.lapor]: waktuWib(),
    [K.linkProgres]: norm(link).slice(0, 500),
    [K.catatanProgres]: norm(catatan).slice(0, 1000),
  });
  lupakan();
  return { id: p.id, progres: n };
}
