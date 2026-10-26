import { keputusanPengambilan, kabarKeputusan, judulKeputusan } from "./pantauanOpsi";
import { msWaktu } from "./pengerjaanOpsi";

// Versi 1 adalah kiriman awal. QC versi 2 memeriksa revisi 1 dan bisa
// menghasilkan permintaan revisi 2: kedua nomor ini tidak boleh tertukar.
export function labelPemeriksaan(e) {
  const revisi = Math.max(0, (Number(e.versi) || Number(e.meta?.ronde) || 1) - 1);
  const kiriman = revisi ? `revisi ${revisi}` : "kiriman awal";
  return e.jenis === "review" ? `QC ${kiriman} selesai` : `Pemeriksaan ${kiriman} · laporan ${e.noLaporan || "progres"} · ${e.persen}%`;
}

/** Hasil pemeriksaan terkini yang masih perlu dikabari, per hasil, bukan per guru. */
export function notifikasiClo(daftar = []) {
  const unik = new Map();
  for (const p of daftar) for (const e of keputusanPengambilan(p)) {
    if (!["review", "dicek", "minta_revisi"].includes(e.jenis) || kabarKeputusan(p, e)) continue;
    const key = `${p.id}:${e.id}`;
    unik.set(key, { key, id: p.id, keputusanId: e.id, bulan: p.bulan, nama: p.nama || p.email || "Guru", subtes: p.subtes, idProyek: p.idProyek, judul: labelPemeriksaan(e), hasil: judulKeputusan(e), waktu: e.waktu, oleh: e.oleh, t: e.t || msWaktu(e.waktu) || 0 });
  }
  return [...unik.values()].sort((a, b) => b.t - a.t || a.key.localeCompare(b.key));
}
