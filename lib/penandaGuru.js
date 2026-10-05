// ============================================================================
//  PENANDA GURU — label yang dipasang TIM (bukan jawaban form guru) untuk
//  guru di Data guru freelance. Tab "Penanda guru": satu baris per ID guru.
//    Bisa liveclass : sudah dipastikan tim bisa mengajar live class (mis.
//                     setelah microteaching) — beda dengan kolom form
//                     "bersedia mengambil proyek LIVECLASS" yang diisi guru.
//  Tab dibuat otomatis saat pertama dipakai; Data guru tidak diubah.
// ============================================================================

import { namaTab, bacaBaris, tambahBaris, ubahBaris, pastikanTab } from "./tabSheet";
import { norm } from "./format";
import { waktuWib } from "./akun";

export const TAB_PENANDA = namaTab("Penanda guru", "TAB_PENANDA");
const H = ["ID guru", "Nama", "Bisa liveclass", "Diubah", "Oleh"];
const benar = (v) => /^(true|ya|1)$/i.test(norm(v));

let cache = null; // 10 detik, permintaan bersamaan berbagi satu pembacaan
const lupakan = () => (cache = null);

/** Map ID guru -> { row, liveclass, diubah, oleh }. */
export async function bacaPenanda() {
  if (cache && Date.now() - cache.at < 10000) return cache.janji;
  const janji = bacaBaris(TAB_PENANDA, H, 2000).then((rows) => {
    const m = new Map();
    rows.forEach(({ row, v }) => {
      const id = norm(v[0]);
      if (id) m.set(id, { row, liveclass: benar(v[2]), diubah: norm(v[3]), oleh: norm(v[4]) });
    });
    return m;
  });
  cache = { at: Date.now(), janji };
  try {
    return await janji;
  } catch (e) {
    if (cache?.janji === janji) cache = null;
    throw e;
  }
}

/** Bentuk yang dikirim ke browser: { "12": { liveclass, diubah, oleh }, … } (hanya yang bertanda). */
export const penandaPublik = (m) =>
  Object.fromEntries([...m].filter(([, p]) => p.liveclass).map(([id, p]) => [id, { liveclass: true, diubah: p.diubah, oleh: p.oleh }]));

/** Pasang / lepas penanda "Bisa liveclass" untuk satu guru. */
export async function aturLiveclass(idGuru, { nama, liveclass }, oleh) {
  const id = norm(idGuru);
  if (!id) throw new Error("ID guru kosong.");
  await pastikanTab(TAB_PENANDA, H, { cekJudul: true });
  lupakan();
  const ada = (await bacaPenanda()).get(id);
  const isi = { 1: norm(nama).slice(0, 150), 2: liveclass ? "TRUE" : "FALSE", 3: waktuWib(), 4: norm(oleh).slice(0, 80) };
  if (ada) await ubahBaris(TAB_PENANDA, ada.row, isi);
  else await tambahBaris(TAB_PENANDA, H, [[id, isi[1], isi[2], isi[3], isi[4]]]);
  lupakan();
  return { idGuru: id, liveclass: Boolean(liveclass), diubah: isi[3], oleh: isi[4] };
}
