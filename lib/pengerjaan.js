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
// ============================================================================

import crypto from "node:crypto";
import { namaTab, bacaBaris, tambahBaris, ubahBaris, pastikanTab } from "./tabSheet";
import { norm, parseNum } from "./format";
import { waktuWib, bacaPengaturan, simpanPengaturan } from "./akun";
import { createAssignment } from "./juli";
import { deadlineProyek } from "./aturanProyek";
import { ST, AKTIF, MAKS_AKTIF_BAWAAN, statusLogRunning, hitungMundur } from "./pengerjaanOpsi";

export const TAB_PENGERJAAN = namaTab("Pengerjaan", "TAB_PENGERJAAN");
const H = ["ID", "Bulan", "ID proyek", "Subtes", "Output", "ID guru", "Nama guru", "Email", "Jumlah", "Status", "Diajukan", "Diputuskan", "Oleh", "Baris log", "Deadline", "Catatan"];
const K = { status: 9, diputuskan: 11, oleh: 12, barisLog: 13, deadline: 14, catatan: 15 };

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
        oleh: norm(v[12]),
        barisLog: parseInt(norm(v[13]), 10) || 0,
        deadline: norm(v[14]),
        catatan: norm(v[15]),
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
  lupakan();
  await ubahBaris(TAB_PENGERJAAN, p.row, { ...isi, [K.status]: ST.running, [K.barisLog]: row, [K.deadline]: dl });
  lupakan();
  return { ...p, status: ST.running, barisLog: row, deadline: dl };
}
