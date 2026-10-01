// ============================================================================
//  REACHOUT — pilihan & perhitungan yang dipakai server (lib/reachout.js) DAN
//  browser (halaman Pantau reachout, Cari guru). Tidak boleh mengimpor apa pun
//  yang hanya jalan di server.
//
//  Satu baris tab "Reachout" = satu kali admin menekan tombol WhatsApp.
//  Baris-baris itu dikelompokkan jadi PASANGAN:
//    Tawaran proyek : guru × proyek × bulan (chat ulang = kontak ke-2, ke-3, …)
//    tujuan lain    : guru × tujuan (sapa pendaftar, minta sampel, kirim akun, …)
// ============================================================================

export const TAWARAN = "Tawaran proyek";
export const TUJUAN = [TAWARAN, "Sapa pendaftar", "Minta sampel", "Hasil QC", "Kirim akun", "Ingatkan aktivasi", "Chat langsung"];
export const TUJUAN_REKRUT = new Set(["Sapa pendaftar", "Minta sampel", "Hasil QC", "Kirim akun", "Ingatkan aktivasi"]);

// Hasil yang ditandai admin. Kosong = belum ada balasan.
export const HASIL = ["Dibalas", "Bersedia", "Menolak", "Tak ada kabar"];
export const MENUNGGU = "Menunggu balasan";
export const AMBIL = "Mengambil"; // otomatis dari Log pengambilan, tidak pernah ditulis
const BERHENTI = new Set(["Menolak", "Tak ada kabar"]);

export const BATAS_HARI = 2; // belum dibalas selama ini -> masuk "Tindak lanjut"
export const MAKS_KONTAK = 3; // sudah dihubungi sebanyak ini tanpa balasan -> jangan chat lagi

export const kelasHasil = (h) =>
  ({ [AMBIL]: "appr", Bersedia: "appr", Dibalas: "run", Menolak: "rev", "Tak ada kabar": "batal plain" })[h] || "qc";

const low = (s) => String(s ?? "").trim().toLowerCase();

/** "01/10/2026 09:48" (WIB) -> milidetik epoch; 0 bila tidak terbaca. */
export function waktuKeMs(s) {
  const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2})[:.](\d{2})/);
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 7, +m[5]) : 0;
}

/** Milidetik epoch -> "01/10/2026 09:48" (WIB), format yang sama dengan tab lain. */
export function msKeWaktu(ms) {
  const d = new Date(ms + 7 * 3600000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** "baru saja", "3 jam lalu", "kemarin", "4 hari lalu". */
export function sejak(ms, kini = Date.now()) {
  if (!ms) return "—";
  const jam = Math.floor((kini - ms) / 3600000);
  if (jam < 1) return "baru saja";
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  return hari === 1 ? "kemarin" : `${hari} hari lalu`;
}

/** Kunci satu guru: ID guru bila ada, lalu email, lalu nama. */
export const kunciGuru = (k) => (k.idGuru ? "id:" + String(k.idGuru).trim() : k.email ? "e:" + low(k.email) : "n:" + low(k.nama));
export const kunciTawaran = (bulan, idProyek, guru) => `${bulan}|${idProyek}|${kunciGuru(guru)}`;
export const kunciPasangan = (k) => (k.tujuan === TAWARAN ? kunciTawaran(k.bulan, k.idProyek, k) : `${k.tujuan}|${kunciGuru(k)}`);

/**
 * Kelompokkan kontak per pasangan. Hasil pasangan = hasil terakhir yang
 * ditandai; kontak baru setelah "Menolak"/"Tak ada kabar" membukanya lagi
 * (menunggu balasan), sedangkan "Dibalas"/"Bersedia" tetap berlaku.
 */
export function kelompokkan(kontak) {
  const m = new Map();
  [...kontak]
    .sort((a, b) => a.t - b.t)
    .forEach((k) => {
      const key = kunciPasangan(k);
      let p = m.get(key);
      if (!p) {
        p = { key, tujuan: k.tujuan, bulan: k.bulan, idProyek: k.idProyek, kontak: [], hasil: "", tHasil: 0 };
        m.set(key, p);
      }
      Object.assign(p, { subtes: k.subtes || p.subtes, idGuru: k.idGuru || p.idGuru, nama: k.nama || p.nama, email: k.email || p.email, wa: k.wa || p.wa });
      p.kontak.push(k);
      p.terakhir = k.t;
      p.akhir = k; // kontak terbaru — penanda hasil menulis ke baris ini
      if (k.hasil) {
        p.hasil = k.hasil;
        p.tHasil = k.tHasil || k.t;
      } else if (BERHENTI.has(p.hasil)) {
        p.hasil = "";
        p.tHasil = 0;
      }
    });
  return [...m.values()];
}

/** Pesan WA untuk menindaklanjuti tawaran yang belum dibalas. */
export function pesanTindakLanjut(nama, p, asal) {
  return (
    `Halo ${nama || ""}, menindaklanjuti tawaran proyek *${p.subtes}*${p.output ? ` (${p.output})` : ""} sebelumnya — apakah berminat? ` +
    `Sisa kuota ${p.sisa} soal.\n\nLihat dan ambil di: ${asal}/open\nTerima kasih!`
  );
}

/** Pesan WA untuk guru yang sudah bersedia tapi belum mengambil kuota. */
export function pesanIngatkanAmbil(nama, p, asal) {
  return (
    `Halo ${nama || ""}, terima kasih sudah bersedia mengerjakan *${p.subtes}*. ` +
    `Silakan ambil kuotanya di ${asal}/open supaya tercatat atas nama Anda (sisa ${p.sisa} soal).\n\nTerima kasih!`
  );
}
