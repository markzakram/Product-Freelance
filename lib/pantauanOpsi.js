import { ST, riwayatPengambilan, laporanGuru, laporanBaru, revisiProgres, pengingat, tahapAktif, tanggalPendek } from "./pengerjaanOpsi";

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
  if (e.jenis === "review" && e.meta?.koreksi) return "Hasil akhir dikoreksi";
  if (e.jenis === "review" && e.meta?.dihentikan) return "Pengambilan dihentikan";
  const lingkup = e.persen === 100 ? "Hasil akhir" : `Laporan ${e.noLaporan || "progres"} · ${e.persen}%`;
  if (e.jenis === "minta_revisi" || (e.jenis === "review" && e.meta?.revisi)) return `Revisi ${e.versi || e.meta?.ronde || 1} diminta · ${lingkup}`;
  return e.jenis === "review" ? "Pekerjaan selesai" : `${lingkup} diperiksa`;
}

/** Catatan RAD wajib ikut di pesan bila berisi alasan / bagian yang harus diperbaiki;
 *  untuk hasil yang beres (ACC, laporan diperiksa, pekerjaan selesai) catatan opsional. */
export const catatanWajib = (e) => e.jenis === "tolak" || e.jenis === "minta_revisi" || (e.jenis === "review" && Boolean(e.meta?.revisi || e.meta?.dihentikan || e.meta?.koreksi));

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

export const pesanReminder = (p, i) => `Halo ${p.nama || "Bapak/Ibu"}, pengingat ${p.subtes} (${p.idProyek}): ${i.teks}. Mohon kabari progres dan kendalanya, ya.`;

/** Draf WhatsApp CLO untuk satu hasil RAD. `sertakanCatatan` menimpa bawaan catatanWajib(). */
export function pesanKabar(p, e, { sertakanCatatan } = {}) {
  const halo = `Halo ${p.nama || "Bapak/Ibu"}, `;
  const proyek = `*${p.subtes}* (${p.idProyek})`;
  const catatan = e.catatan && (sertakanCatatan ?? catatanWajib(e)) ? `\nCatatan: ${e.catatan}` : "";
  const m = e.meta || {};
  switch (e.jenis) {
    case "acc":
      return `${halo}pengajuan ${proyek}${p.jumlah ? `, ${p.jumlah} soal,` : ""} sudah disetujui dan bisa mulai dikerjakan.${p.deadline ? ` Deadline: ${tanggalPendek(p.deadline)}.` : ""}${catatan}\nLapor progres dan kumpulkan hasil lewat menu Proyek saya. Selamat mengerjakan!`;
    case "tolak":
      return `${halo}mohon maaf, pengajuan ${proyek} belum bisa kami setujui.${e.catatan ? `\nAlasan: ${e.catatan}` : ""}\nSilakan pilih proyek lain yang masih tersedia di halaman proyek. Terima kasih.`;
    case "dicek":
      return `${halo}laporan progres ${e.persen}% ${proyek} sudah kami periksa dan tidak ada yang perlu diperbaiki. Silakan lanjutkan sampai selesai.${catatan}\nTerima kasih.`;
    case "minta_revisi":
      return `${halo}laporan progres ${e.persen}% ${proyek} perlu diperbaiki (${judulKeputusan(e)}).${catatan}\nSilakan perbaiki lalu kirim ulang lewat menu Proyek saya. Terima kasih.`;
    default:
      break;
  }
  if (m.koreksi) {
    const diterima = (p.tepat || 0) + (p.telat || 0);
    const ditolak = (p.tolakBuka || 0) + (p.tolakHangus || 0);
    return `${halo}hasil akhir ${proyek} kami koreksi.${e.catatan ? `\nAlasan: ${e.catatan}` : ""}\nHasil akhir sekarang: ${diterima} soal diterima${p.telat ? ` (${p.telat} di antaranya dibayar 75% karena revisi lewat batas)` : ""}${ditolak ? `, ${ditolak} soal ditolak` : ""}.\n${diterima ? "Fee mengikuti jumlah terbaru ini. " : ""}Terima kasih.`;
  }
  if (m.dihentikan) {
    const diterima = (p.tepat || 0) + (p.telat || 0);
    const ditolak = (p.tolakBuka || 0) + (p.tolakHangus || 0);
    return `${halo}pengambilan ${proyek} kami hentikan.${e.catatan ? `\nAlasan: ${e.catatan}` : ""}\nHasil akhir: ${diterima} soal diterima${ditolak ? `, ${ditolak} soal tidak dilanjutkan` : ""}.\n${diterima ? "Fee untuk soal yang diterima masuk ke pembayaran bulan ini. " : ""}Terima kasih atas kerja samanya.`;
  }
  if (m.revisi) {
    return `${halo}hasil review ${proyek}: ${judulKeputusan(e)}.\nHasil review ini: ${m.setuju || 0} disetujui, ${m.revisi} perlu revisi${m.tolak ? `, ${m.tolak} ditolak` : ""}.${catatan}${m.batas ? `\nBatas kirim revisi: ${m.batas} WIB. Revisi yang dikirim lewat batas dibayar 75% untuk soal itu.` : ""}\nKirim revisi lewat menu Proyek saya. Terima kasih.`;
  }
  // Pekerjaan selesai: jumlah akhir semua ronde (bukan hanya ronde terakhir).
  const akhir = p.status === ST.selesai;
  const setuju = akhir ? (p.tepat || 0) + (p.telat || 0) : m.setuju || 0;
  const telat = akhir ? p.telat || 0 : 0;
  const tolak = akhir ? (p.tolakBuka || 0) + (p.tolakHangus || 0) : m.tolak || 0;
  const hasil = [setuju ? `${setuju} soal disetujui${telat ? ` (${telat} di antaranya dibayar 75% karena revisi lewat batas)` : ""}` : "", tolak ? `${tolak} soal ditolak` : ""].filter(Boolean).join(", ");
  return `${halo}pekerjaan ${proyek} telah selesai.${hasil ? ` Hasil review akhir: ${hasil}.` : ""}${p.denda ? " Fee proyek ini dikenai potongan 25% (review gagal lebih dari 3×)." : ""}${catatan}\n${setuju ? "Fee akan masuk ke pembayaran bulan ini. " : ""}Terima kasih atas kerja samanya!`;
}
