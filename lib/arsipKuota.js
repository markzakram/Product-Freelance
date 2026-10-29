// ============================================================================
//  ARSIP KUOTA (v3.18.0) — soal yang ditolak (review / pengambilan dihentikan)
//  tetapi BELUM dibuka lagi ke katalog. Saat diarsipkan, kebutuhan proyek di
//  katalog dikurangi sehingga tidak tampil untuk guru; tim akademik nanti
//  membuka sebagian/semuanya ke katalog (kebutuhan ditambah lagi) atau
//  menghanguskannya. Tab "Arsip kuota", satu baris per kejadian.
// ============================================================================

import crypto from "node:crypto";
import { namaTab, bacaBaris, tambahBaris, ubahBaris } from "./tabSheet";
import { getBoard, updateProject } from "./juli";
import { waktuWib } from "./akun";
import { norm, parseNum } from "./format";

export const TAB_ARSIP = namaTab("Arsip kuota", "TAB_ARSIP_KUOTA");
export const H = ["ID", "Bulan", "ID proyek", "Subtes", "Jumlah", "Dibuka", "Hangus", "Asal pengambilan", "Guru", "Alasan", "Diarsipkan", "Oleh", "Diubah", "Diubah oleh"];
const K = { id: 0, bulan: 1, idProyek: 2, subtes: 3, jumlah: 4, dibuka: 5, hangus: 6, asal: 7, guru: 8, alasan: 9, waktu: 10, oleh: 11, diubah: 12, diubahOleh: 13 };
const angka = (v) => Math.max(0, parseNum(v));
const galat = (pesan, status = 400) => Object.assign(new Error(pesan), { status });

/** Semua catatan arsip (opsional satu bulan); `sisa` = yang masih diarsipkan. */
export async function bacaArsip({ bulan } = {}) {
  const rows = await bacaBaris(TAB_ARSIP, H, 2000);
  return rows
    .map(({ row, v }) => {
      const jumlah = angka(v[K.jumlah]);
      const dibuka = angka(v[K.dibuka]);
      const hangus = angka(v[K.hangus]);
      return {
        row,
        id: norm(v[K.id]),
        bulan: norm(v[K.bulan]),
        idProyek: norm(v[K.idProyek]).toUpperCase(),
        subtes: norm(v[K.subtes]),
        jumlah,
        dibuka,
        hangus,
        sisa: Math.max(0, jumlah - dibuka - hangus),
        asal: norm(v[K.asal]),
        guru: norm(v[K.guru]),
        alasan: norm(v[K.alasan]),
        waktu: norm(v[K.waktu]),
        oleh: norm(v[K.oleh]),
        diubah: norm(v[K.diubah]),
        diubahOleh: norm(v[K.diubahOleh]),
      };
    })
    .filter((a) => a.id && (!bulan || a.bulan === bulan));
}

/** Catat soal yang diarsipkan — dipanggil review/hentikan SESUDAH kebutuhan katalog dikurangi. */
export async function catatArsip({ bulan, idProyek, subtes, jumlah, asal, guru, alasan }, oleh) {
  const id = "AK-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  await tambahBaris(TAB_ARSIP, H, [[id, bulan, idProyek, subtes, jumlah, 0, 0, asal, guru, norm(alasan).slice(0, 300), waktuWib(), norm(oleh).slice(0, 80), "", ""]]);
  return id;
}

/**
 * Tim akademik memutuskan arsip: `aksi` "buka" = `jumlah` soal kembali ke katalog
 * (kebutuhan proyek bertambah, bisa diambil guru lain); "hangus" = tidak dipakai.
 * Boleh sebagian; sisanya tetap di arsip.
 */
export async function aturArsip(id, { aksi, jumlah }, oleh) {
  if (!["buka", "hangus"].includes(aksi)) throw galat("Pilih: buka ke katalog atau hanguskan.");
  const a = (await bacaArsip()).find((x) => x.id === norm(id));
  if (!a) throw galat("Arsip kuota tidak ditemukan.", 404);
  const n = parseInt(jumlah, 10) || 0;
  if (n < 1 || n > a.sisa) throw galat(a.sisa ? `Jumlah harus 1–${a.sisa} soal.` : "Arsip ini sudah habis diputuskan.", a.sisa ? 400 : 409);
  if (aksi === "buka") {
    const board = await getBoard(a.bulan);
    const proyek = board.projects.find((x) => norm(x.id).toUpperCase() === a.idProyek);
    if (!proyek) throw galat(`Proyek ${a.idProyek} tidak ditemukan di katalog ${a.bulan}.`, 409);
    await updateProject(proyek.row, { kebutuhan: (proyek.kebutuhan || 0) + n }, a.bulan);
  }
  await ubahBaris(TAB_ARSIP, a.row, {
    [aksi === "buka" ? K.dibuka : K.hangus]: (aksi === "buka" ? a.dibuka : a.hangus) + n,
    [K.diubah]: waktuWib(),
    [K.diubahOleh]: norm(oleh).slice(0, 80),
  });
  return { id: a.id, aksi, jumlah: n, sisa: a.sisa - n };
}
