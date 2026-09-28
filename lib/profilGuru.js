// ============================================================================
//  PROFIL GURU — gabungan Database guru + riwayat log SEMUA bulan (termasuk
//  Juni–Agustus yang disembunyikan dari dashboard) + akun + seleksi +
//  ajuan perubahan data. Dipakai panel Profil guru (admin) dan Profil saya.
// ============================================================================

import { getTeachers } from "./teachers";
import { getAllMonths } from "./months";
import { cariAkun, akunPublik } from "./akun";
import { bacaSeleksi } from "./seleksi";
import { daftarPerubahan } from "./perubahanGuru";
import { pemetaLog } from "./cocokGuru";

const low = (s) => String(s ?? "").toLowerCase().trim();

/** Baris log milik guru `g` di semua bulan, terbaru dulu. */
export async function riwayatGuru(g, semuaGuru) {
  const { log } = await getAllMonths({ semua: true });
  const peta = pemetaLog(semuaGuru);
  return log
    .filter((a) => peta(a)?.row === g.row)
    .map((a) => ({ bulan: a.bulan, tanggal: a.tanggal, kode: a.kode, subtes: a.subtes, jumlah: a.jumlah, status: a.status, fee: a.fee }))
    .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
}

export async function dataProfil(idGuru) {
  const { rows = [] } = await getTeachers();
  const g = rows.find((x) => String(x.idGuru) === String(idGuru));
  if (!g) throw new Error("Guru dengan ID ini tidak ada di Database guru.");
  const [riwayat, akun, seleksi, perubahan] = await Promise.all([
    riwayatGuru(g, rows),
    g.email ? cariAkun(g.email, { segar: true }) : null,
    bacaSeleksi(),
    daftarPerubahan({ idGuru: g.idGuru }),
  ]);
  return { guru: g, riwayat, akun: akun ? akunPublik(akun) : null, seleksi: (g.email && seleksi.get(low(g.email))) || null, perubahan };
}
