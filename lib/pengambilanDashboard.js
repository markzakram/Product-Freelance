import { ST } from "./pengerjaanOpsi";
import { barisPantauan, progresBelumDiperiksa, proyekButuhGuru } from "./pantauanOpsi";
import { kunciSubtesPengambilan } from "./pengambilanFilter";

export const FOKUS_KERJA = {
  semua: "Semua pengambilan", tugas: "Perlu tindakan RAD", acc: "Menunggu ACC",
  progres: "Progres belum diperiksa", periksa: "Perlu pemeriksaan", qc: "Menunggu QC", ulang: "Menunggu QC ulang",
  awal: "Menunggu QC pertama", revisi: "Menunggu revisi guru", siap: "Siap dikabari",
  sudah: "Semua hasil sudah dikabari", reminder: "Perlu reminder", lolos: "Ada soal disetujui",
};
export function cocokFokusKerja(r, fokus) {
  switch (fokus) {
    case "tugas": return ["acc", "qc"].includes(r.tahap) || progresBelumDiperiksa(r.p).length > 0;
    case "acc": return r.tahap === "acc";
    case "progres": return progresBelumDiperiksa(r.p).length > 0;
    case "periksa": return r.tahap === "qc" || progresBelumDiperiksa(r.p).length > 0;
    case "qc": return r.tahap === "qc";
    case "awal": return r.tahap === "qc" && !r.p.ronde;
    case "ulang": return r.tahap === "qc" && r.p.ronde > 0;
    case "revisi": return r.tahap === "revisi";
    case "siap": return r.siap.length > 0;
    case "sudah": return r.sudah.length > 0 && !r.siap.length;
    case "reminder": return r.pengingat.some((i) => !i.terkirim);
    case "lolos": return soalDisetujui(r.p) > 0;
    default: return true;
  }
}
export function soalDisetujui(p) {
  if ([ST.diajukan, ST.ditolak, ST.dibatalkan].includes(p.status)) return 0;
  return Math.min(Math.max(0, Number(p.jumlah) || 0), Math.max(0, Number(p.tepat) || 0) + Math.max(0, Number(p.telat) || 0));
}

/** Kuota dari katalog; jumlah lolos QC hanya dari hasil review pengambilan.
 * Kiriman 100% dan banyaknya laporan/revisi tidak pernah menambah jumlah lolos.
 */
export function ringkasanPengambilan(projects, daftar, kini = Date.now()) {
  const baris = daftar.map((p) => barisPantauan(p, kini));
  const grup = new Map();
  const pastikan = (p) => {
    const key = kunciSubtesPengambilan(p);
    if (!grup.has(key)) grup.set(key, { key, nama: String(p.subtes || "Tanpa subtes").trim(), target: 0, terisi: 0, lolos: 0, proyek: [], pengambilan: 0, periksa: 0, revisi: 0, kabar: 0 });
    return grup.get(key);
  };
  for (const p of projects) {
    const g = pastikan(p);
    const target = Math.max(0, Number(p.kebutuhan) || 0);
    g.target += target;
    g.terisi += Math.max(0, target - (Number(p.sisa) || 0));
    g.proyek.push(p.id);
  }
  for (const r of baris) {
    const g = pastikan(r.p);
    g.lolos += soalDisetujui(r.p);
    g.pengambilan++;
    if (r.tahap === "qc" || progresBelumDiperiksa(r.p).length) g.periksa++;
    if (r.tahap === "revisi") g.revisi++;
    if (r.siap.length) g.kabar++;
  }
  const subtes = [...grup.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  const counts = Object.fromEntries(Object.keys(FOKUS_KERJA).map((fokus) => [fokus, baris.filter((r) => cocokFokusKerja(r, fokus)).length]));
  return {
    baris, subtes, counts, kuota: proyekButuhGuru(projects, daftar),
    target: subtes.reduce((n, g) => n + g.target, 0),
    terisi: subtes.reduce((n, g) => n + g.terisi, 0),
    lolos: subtes.reduce((n, g) => n + g.lolos, 0),
  };
}
