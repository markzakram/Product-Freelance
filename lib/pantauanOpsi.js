import { ST, riwayatPengambilan, laporanGuru, laporanBaru, revisiProgres, pengingat, tahapAktif } from "./pengerjaanOpsi";

export const TAHAP_PANTAUAN = [
  ["acc", "Menunggu ACC"], ["jalan", "Dikerjakan"], ["progres", "Progres belum diperiksa"],
  ["dicek", "Progres diperiksa"], ["qc", "QC / QC ulang"], ["revisi", "Dalam revisi"],
  ["selesai", "Disetujui"], ["tolak", "Ditolak / batal"],
];
export const progresBelumDiperiksa = (p) => [ST.running, ST.review, ST.revisi].includes(p.status) ? laporanBaru(p) : [];
export function proyekButuhGuru(projects, pengambilan) {
  const pesanan = new Map();
  for (const p of pengambilan) if (p.status === ST.diajukan) {
    const id = String(p.idProyek).toUpperCase();
    pesanan.set(id, (pesanan.get(id) || 0) + (Number(p.jumlah) || 0));
  }
  return projects.map((p) => {
    const dipesan = pesanan.get(String(p.id).toUpperCase()) || 0;
    return { ...p, dipesan, tersedia: Math.max(0, (Number(p.sisa) || 0) - dipesan) };
  }).filter((p) => p.tersedia > 0);
}
export function tahapPantauan(p) {
  if (p.status === ST.diajukan) return "acc";
  if ([ST.ditolak, ST.dibatalkan].includes(p.status)) return "tolak";
  if (p.status === ST.selesai) return "selesai";
  if (p.status === ST.review) return "qc";
  if (p.status === ST.revisi || revisiProgres(p).length) return "revisi";
  if (laporanBaru(p).length) return "progres";
  return laporanGuru(p).length ? "dicek" : "jalan";
}

export function judulKeputusan(e) {
  if (e.jenis === "acc") return "Pengajuan disetujui";
  if (e.jenis === "tolak") return "Pengajuan ditolak";
  const lingkup = e.persen === 100 ? "Hasil akhir" : `Laporan ${e.noLaporan || "progres"} · ${e.persen}%`;
  if (e.jenis === "minta_revisi" || (e.jenis === "review" && e.meta?.revisi)) return `Revisi ${e.versi || e.meta?.ronde || 1} diminta · ${lingkup}`;
  return e.jenis === "review" ? "QC selesai · hasil diputuskan" : `${lingkup} diperiksa`;
}

// Hanya hasil untuk versi yang masih berlaku. Kiriman baru menunggu QC ulang,
// sehingga kabar hasil versi sebelumnya tidak bisa menutupi pekerjaan baru.
export function keputusanPengambilan(p) {
  const riwayat = riwayatPengambilan(p).map((e) => e.lama && e.jenis === "review" ? { ...e, versi: Math.max(e.versi || 1, e.meta?.ronde || 1) } : e);
  const terakhir = (fn) => [...riwayat].reverse().find(fn);
  const akhir = terakhir((e) => ["pengumpulan", "revisi_akhir"].includes(e.jenis));
  if (akhir || [ST.review, ST.revisi, ST.selesai].includes(p.status)) {
    if (p.status === ST.review) return [];
    const hasil = terakhir((e) => e.jenis === "review" && (!akhir || e.versi === akhir.versi));
    return hasil ? [hasil] : [];
  }
  if (p.status === ST.dibatalkan || p.status === ST.diajukan) return [];
  if (p.status === ST.ditolak) {
    const tolak = terakhir((e) => e.jenis === "tolak");
    return tolak ? [tolak] : p.diputuskan ? [{ id: `lama-${p.id}-tolak`, jenis: "tolak", waktu: p.diputuskan, t: p.tAcc, oleh: p.oleh, catatan: p.catatan }] : [];
  }
  const laporan = laporanGuru(p);
  if (laporan.length) return laporan.map((l) => terakhir((e) => ["dicek", "minta_revisi"].includes(e.jenis) && e.laporanId === l.laporanId && e.versi === l.versi)).filter(Boolean);
  const acc = terakhir((e) => e.jenis === "acc");
  return acc ? [acc] : p.tAcc ? [{ id: `lama-${p.id}-acc`, jenis: "acc", waktu: p.diputuskan, t: p.tAcc, oleh: p.oleh }] : [];
}

export const kabarKeputusan = (p, keputusan) => [...(p.riwayat || [])].reverse().find((e) => e.jenis === "kabar" && e.meta?.keputusanId === keputusan.id) || null;
const hariWib = (kini) => new Date(kini + 7 * 3600000).toISOString().slice(0, 10);
export function pengingatPantauan(p, kini = Date.now()) {
  return pengingat(p, kini).map((i) => {
    const key = [i.jenis, i.persen || "", p.deadline || "", p.batasRevisi || "", ...(p.titik || []).map((t) => `${t.persen}:${t.tanggal}`), hariWib(kini)].join("|");
    const terkirim = [...(p.riwayat || [])].reverse().find((e) => e.jenis === "reminder" && e.meta?.pengingatId === key) || null;
    return { ...i, key, terkirim };
  });
}

export function barisPantauan(p, kini = Date.now()) {
  const keputusan = keputusanPengambilan(p).map((e) => ({ ...e, judul: judulKeputusan(e), kabar: kabarKeputusan(p, e) }));
  return { p, tahap: tahapPantauan(p), persen: tahapAktif(p), keputusan, siap: keputusan.filter((e) => !e.kabar), sudah: keputusan.filter((e) => e.kabar), pengingat: pengingatPantauan(p, kini) };
}

export function pesanKabar(p, keputusan) {
  const hasil = judulKeputusan(keputusan);
  const tahap = keputusan.persen ? `, tahap ${keputusan.persen}%` : "";
  const rincian = keputusan.jenis === "review" ? `\nHasil review: ${keputusan.meta?.setuju || 0} disetujui, ${keputusan.meta?.revisi || 0} revisi, ${keputusan.meta?.tolak || 0} ditolak.` : "";
  return `Halo ${p.nama || "Bapak/Ibu"}, berikut update ${p.subtes} (${p.idProyek})${tahap}: ${hasil}.${rincian}${keputusan.catatan ? `\nCatatan: ${keputusan.catatan}` : ""}${keputusan.meta?.batas ? `\nBatas revisi: ${keputusan.meta.batas} WIB.` : ""}\nSilakan cek detail di menu Proyek saya. Terima kasih.`;
}
