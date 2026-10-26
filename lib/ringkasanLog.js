import { isBatal, norm, parseNum } from "./format";

/** Angka log mengikuti baris tampil; kuota selalu memakai sisa aktual katalog. */
export function ringkasanLog(rows = [], projects = [], tersaring = false) {
  const kode = (s) => norm(s).toUpperCase();
  const terkait = new Set(rows.map((a) => kode(a.idProject)));
  const katalog = projects.filter((p) => !tersaring || terkait.has(kode(p.id)));
  const aktif = rows.filter((a) => !isBatal(a.status));
  // Nama lama tanpa ID bisa digabung hanya jika tepat satu ID memakai nama itu.
  const idsNama = new Map();
  for (const a of aktif) if (a.idGuru && a.guru) {
    const nama = norm(a.guru).toLowerCase();
    const ids = idsNama.get(nama) || new Set();
    ids.add(String(a.idGuru)); idsNama.set(nama, ids);
  }
  const guru = new Set();
  for (const a of aktif) if (parseNum(a.jumlah) > 0) {
    const nama = norm(a.guru).toLowerCase(), ids = idsNama.get(nama);
    const id = a.idGuru || (ids?.size === 1 ? [...ids][0] : "");
    if (id || nama) guru.add(id ? `id:${id}` : `nama:${nama}`);
  }
  const kebutuhan = katalog.reduce((n, p) => n + parseNum(p.kebutuhan), 0);
  const diambil = aktif.reduce((n, a) => n + parseNum(a.jumlah), 0);
  return {
    feeTotal: aktif.reduce((n, a) => n + parseNum(a.fee), 0), diambil, kebutuhan,
    sisa: katalog.reduce((n, p) => n + parseNum(p.sisa), 0),
    proyek: katalog.length, habis: katalog.filter((p) => parseNum(p.sisa) <= 0).length,
    guruAktif: guru.size, baris: rows.length,
    pct: kebutuhan > 0 ? Math.round(diambil / kebutuhan * 100) : 0,
  };
}
