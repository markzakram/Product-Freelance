// ============================================================================
//  RUANG KERJA PENGAMBILAN GURU (v3.14.0) — antrean tugas per tim, alur
//  ACC → 30% → 50% → 100% → QC, satu label status, tenggat, dan saringan tabel.
//  Murni (tanpa React) supaya halaman dan uji memakai hitungan yang sama.
//  Data per baris: barisPantauan() di lib/pantauanOpsi.js.
// ============================================================================

import { ST, belumSelesai, hitungMundur, sisaWaktu, titikBerikut, laporanBaru, revisiProgres, siklusRevisi, tahapPengambilan, msWaktu } from "./pengerjaanOpsi";
import { progresBelumDiperiksa, proyekButuhGuru } from "./pantauanOpsi";
import { cocokFokusKerja, soalDisetujui } from "./pengambilanDashboard";
import { kelompokkan, sejak, TAWARAN, BATAS_HARI } from "./reachoutOpsi";

const HARI = 86400000;
const TUTUP = new Set([ST.ditolak, ST.dibatalkan]);

// Urutan jenis tugas; di dalam satu jenis, yang paling lama menunggu di atas.
const URUT = { ulang: 0, qc: 1, progres: 2, acc: 3, kabar: 0, reminder: 1 };
const urutkan = (xs) => xs.sort((a, b) => URUT[a.jenis] - URUT[b.jenis] || (a.t || 0) - (b.t || 0));

/** Tugas RAD: QC ulang kiriman revisi, QC hasil akhir pertama, laporan progres baru, ACC pengajuan. */
export function tugasRad(baris) {
  const out = [];
  for (const { p } of baris) {
    if (p.status === ST.diajukan) out.push({ key: `acc:${p.id}`, jenis: "acc", p, t: msWaktu(p.diajukan) });
    if (p.status === ST.review) out.push({ key: `qc:${p.id}`, jenis: p.ronde ? "ulang" : "qc", p, t: p.tDikumpulkan || 0 });
    for (const l of progresBelumDiperiksa(p)) out.push({ key: `progres:${p.id}:${l.laporanId}:${l.versi}`, jenis: "progres", p, laporan: l, t: l.t || 0 });
  }
  return urutkan(out);
}

/** Tugas CLO: hasil RAD yang belum dikabari, lalu reminder yang belum dikirim hari ini (yang lewat dulu). */
export function tugasClo(baris) {
  const out = [];
  for (const r of baris) {
    for (const e of r.siap) out.push({ key: `kabar:${r.p.id}:${e.id}`, jenis: "kabar", p: r.p, keputusan: e, t: e.t || 0 });
    for (const i of r.pengingat) if (!i.terkirim) out.push({ key: `ingat:${r.p.id}:${i.key}`, jenis: "reminder", p: r.p, pengingat: i, t: i.lewat ? 0 : 1 });
  }
  return urutkan(out);
}

/** Proyek dengan kuota terbuka + ringkasan tawaran bulan ini: sudah ditawari, belum dibalas > BATAS_HARI hari, bersedia. */
export function kuotaButuhGuru(projects, daftar, kontak = [], bulan = "", kini = Date.now()) {
  const tawaran = kelompokkan(kontak.filter((k) => k.tujuan === TAWARAN && k.bulan === bulan));
  return proyekButuhGuru(projects, daftar)
    .map((p) => {
      const tw = tawaran.filter((x) => x.idProyek === p.id);
      return {
        ...p,
        ditawari: tw.length,
        menunggu: tw.filter((x) => !x.hasil && kini - (x.terakhir || 0) > BATAS_HARI * HARI).length,
        bersedia: tw.filter((x) => x.hasil === "Bersedia").length,
        terakhir: Math.max(0, ...tw.map((x) => x.terakhir || 0)),
      };
    })
    .sort((a, b) => b.tersedia - a.tersedia || String(a.id).localeCompare(String(b.id), "id", { numeric: true }));
}

/**
 * Lima titik alur. s: "ok" selesai · "cek" masuk, menunggu diperiksa RAD · "now" sedang
 * dikerjakan guru · "late" sedang dikerjakan dan lewat tanggal · "rev" revisi ·
 * "x" ditolak/batal · "skip" tidak wajib · "" belum sampai.
 */
export function alurPengambilan(p, kini = Date.now()) {
  const tutup = TUTUP.has(p.status);
  const mulai = !tutup && p.status !== ST.diajukan;
  const berikut = p.status === ST.running ? titikBerikut(p, kini) : null;
  const titik = (n) => {
    if (!mulai) return { s: "", ket: p.status === ST.diajukan ? "Belum mulai" : "—" };
    const t = tahapPengambilan(p, n);
    if (t.label === "Tidak wajib") return { s: "skip", ket: "Tidak wajib lapor" };
    if (t.label === "Revisi") return { s: "rev", ket: "Revisi diminta" };
    if (t.label === "Baru") return { s: "cek", ket: "Laporan masuk, menunggu diperiksa RAD" };
    if (t.label === "Menunggu") return berikut?.persen === n ? { s: berikut.lewat ? "late" : "now", ket: `Menunggu laporan · ${berikut.h}` } : { s: "", ket: "Belum dilaporkan" };
    return { s: "ok", ket: t.label === "Diperiksa" ? "Sudah diperiksa" : t.label };
  };
  const t100 = mulai ? tahapPengambilan(p, 100) : null;
  let akhir = { s: "", ket: "Belum dikumpulkan" };
  if (t100 && t100.label !== "Menunggu") akhir = { s: "ok", ket: "Hasil akhir dikumpulkan" };
  else if (p.status === ST.running && !berikut) {
    const d = hitungMundur(p.deadline, kini);
    akhir = { s: d.lewat ? "late" : "now", ket: `Menunggu hasil akhir · deadline ${d.teks}` };
  }
  const qc = p.status === ST.review ? { s: "cek", ket: p.ronde ? "Menunggu QC ulang" : "Menunggu QC" } : p.status === ST.revisi ? { s: "rev", ket: "Revisi hasil akhir" } : p.status === ST.selesai ? { s: "ok", ket: "QC selesai" } : { s: "", ket: "Belum QC" };
  return [
    { k: "acc", label: "ACC", ...(p.status === ST.diajukan ? { s: "now", ket: "Menunggu ACC" } : tutup ? { s: "x", ket: p.status } : { s: "ok", ket: "Di-ACC" }) },
    { k: 30, label: "30", ...titik(30) },
    { k: 50, label: "50", ...titik(50) },
    { k: 100, label: "100", ...akhir },
    { k: "qc", label: "QC", ...qc },
  ];
}

/** Satu label untuk keadaan sekarang. kelas = kelas pill (qc/run/rev/appr/batal plain). */
export function statusRingkas(p, kini = Date.now()) {
  switch (p.status) {
    case ST.diajukan: return { label: "Menunggu ACC", kelas: "qc" };
    case ST.ditolak: return { label: "Ditolak", kelas: "rev" };
    case ST.dibatalkan: return { label: "Dibatalkan", kelas: "batal plain" };
    case ST.review: return { label: p.ronde ? `QC ulang · revisi ${siklusRevisi(p, 100).dikirim || p.ronde}` : "Menunggu QC", kelas: "qc" };
    case ST.revisi: return { label: `Revisi ${siklusRevisi(p, 100).diminta} · ${belumSelesai(p)} soal`, kelas: "rev" };
    case ST.selesai: return { label: `Selesai · ${soalDisetujui(p)}/${p.jumlah} lolos`, kelas: "appr" };
    default: {
      const baru = laporanBaru(p);
      if (baru.length) return { label: `Laporan ${baru[baru.length - 1].persen}% perlu diperiksa`, kelas: "qc" };
      const rev = revisiProgres(p);
      if (rev.length) return { label: `Revisi laporan ${rev[0].persen}%`, kelas: "rev" };
      const t = titikBerikut(p, kini);
      return { label: t ? `Dikerjakan · lapor ${t.persen}%` : "Dikerjakan · menuju 100%", kelas: "run" };
    }
  }
}

/** Tenggat terdekat: batas revisi, titik lapor berikutnya, atau deadline. null bila tidak ada. kelas: rev (mendesak) / qc (dekat) / "". */
export function tenggatPengambilan(p, kini = Date.now()) {
  if (p.status === ST.revisi && p.tBatas) {
    const s = sisaWaktu(p.tBatas, kini);
    return { ket: "Batas revisi", teks: s.teks, kelas: s.lewat || p.tBatas - kini < HARI ? "rev" : "qc", lewat: s.lewat };
  }
  if (p.status === ST.review) return { ket: "Dikumpulkan", teks: sejak(p.tDikumpulkan, kini), kelas: "", lewat: false };
  if (p.status === ST.running) {
    const t = titikBerikut(p, kini);
    if (t) return { ket: `Lapor ${t.persen}%`, teks: t.hm.teks, kelas: t.lewat || t.hm.hari === 0 ? "rev" : t.hm.hari <= 2 ? "qc" : "", lewat: t.lewat };
  }
  if ([ST.running, ST.diajukan].includes(p.status) && p.deadline) {
    const d = hitungMundur(p.deadline, kini);
    return { ket: "Deadline", teks: d.teks, kelas: p.status === ST.diajukan ? "" : d.lewat || d.hari === 0 ? "rev" : d.hari <= 2 ? "qc" : "", lewat: p.status === ST.running && d.lewat };
  }
  return null;
}

/** Saringan status tabel (satu pilihan). r = barisPantauan(). */
export const SARING_TABEL = [
  ["semua", "Semua", () => true],
  ["tindakan", "Perlu tindakan RAD", (r) => cocokFokusKerja(r, "tugas")],
  ["kabar", "Belum dikabari", (r) => r.siap.length > 0],
  ["guru", "Menunggu guru", (r) => [ST.running, ST.revisi].includes(r.p.status) && !cocokFokusKerja(r, "tugas")],
  ["lewat", "Lewat tenggat", (r) => r.pengingat.some((i) => i.lewat)],
  ["selesai", "Selesai", (r) => r.p.status === ST.selesai],
  ["tolak", "Ditolak & batal", (r) => TUTUP.has(r.p.status)],
];
export const cocokSaringTabel = (r, key) => (SARING_TABEL.find(([k]) => k === key) || SARING_TABEL[0])[2](r);
