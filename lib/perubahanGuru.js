// ============================================================================
//  PERUBAHAN DATA DARI GURU ("Profil saya") — tab "Perubahan data guru".
//
//  Data yang menyangkut uang & kontak (WA, rekening, pemilik rekening, NPWP)
//  TIDAK langsung ditulis: diajukan dulu, admin yang menyetujui. Kalau akun
//  guru dibobol, rekening pembayarannya tidak bisa diganti diam-diam.
//  Preferensi kerja (kapasitas, bidang, minat, live class) langsung tersimpan.
// ============================================================================

import { namaTab, bacaBaris, tambahBaris, ubahBaris } from "./tabSheet";
import { getTeachers, updateTeacher } from "./teachers";
import { BIDANG, JADWAL, MINAT_FORM, LIVE_FORM, pilihanTerpilih, gabungPilihan } from "./cocokGuru";
import { NAMA_BANK, bankDanRekening } from "./rekapFee";
import { norm } from "./format";

export const TAB_PERUBAHAN = namaTab("Perubahan data guru", "TAB_PERUBAHAN");
const H = ["Waktu", "ID guru", "Nama", "Email", "Kolom", "Nilai lama", "Nilai baru", "Status", "Diputuskan"];

export const KOLOM_UBAH = {
  wa: { label: "Nomor WhatsApp", setuju: true },
  rekening: { label: "Rekening", setuju: true },
  pemilikRekening: { label: "Nama pemilik rekening", setuju: true },
  npwp: { label: "NPWP", setuju: true },
  kapasitas: { label: "Kapasitas per minggu" },
  liveclass: { label: "Bersedia live class" },
  jadwalLive: { label: "Jadwal live class" },
  bidang: { label: "Bidang yang dikuasai" },
  jenisProyek: { label: "Jenis proyek diminati" },
};

const waktu = () =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date())
    .replace(/\./g, ":")
    .replace(",", "");

/** Bersihkan & periksa isian guru. Mengembalikan { nilai } atau { galat }. */
export function periksaIsian(kolom, isi, lama = "") {
  const s = norm(Array.isArray(isi) ? "" : isi);
  switch (kolom) {
    case "wa": {
      const d = s.replace(/\D/g, "");
      if (/[/,;]/.test(s) || d.length < 9 || d.length > 15) return { galat: "Isi satu nomor WhatsApp yang valid." };
      return { nilai: s.replace(/[^\d+]/g, "") };
    }
    case "rekening": {
      const { bank, nomor } = isi || {};
      if (!NAMA_BANK.includes(bank)) return { galat: "Pilih nama bank." };
      if (!/^\d{5,25}$/.test(String(nomor || "").replace(/[\s.-]/g, ""))) return { galat: "Nomor rekening hanya angka (5–25 digit)." };
      return { nilai: `${bank} ${String(nomor).replace(/[\s.-]/g, "")}` };
    }
    case "pemilikRekening":
      if (s.length < 2 || s.length > 100) return { galat: "Isi nama pemilik rekening." };
      return { nilai: s };
    case "npwp":
      if (s && !/^[\d.\-\s]{8,25}$/.test(s)) return { galat: "NPWP hanya angka, titik, dan strip." };
      return { nilai: s || "-" };
    case "kapasitas": {
      if (!s) return { nilai: "" };
      const n = parseInt(s, 10);
      if (!(n >= 0 && n <= 500)) return { galat: "Kapasitas berupa angka 0–500." };
      return { nilai: String(n) };
    }
    case "liveclass":
      if (!LIVE_FORM.includes(s)) return { galat: "Pilih Ya, Mungkin, atau Tidak." };
      return { nilai: s };
    case "jadwalLive":
      return { nilai: gabungPilihan([].concat(isi || []), JADWAL.map((j) => j.form)) };
    case "jenisProyek":
      return { nilai: gabungPilihan([].concat(isi || []), MINAT_FORM) };
    case "bidang": {
      const opsi = BIDANG.map((b) => b.form);
      const pilih = gabungPilihan([].concat(isi || []), opsi);
      // jawaban bebas lama di luar pilihan form (mis. "Manajemen") dipertahankan
      let sisa = String(lama || "");
      pilihanTerpilih(sisa, opsi).forEach((o) => (sisa = sisa.replace(o, "")));
      sisa = sisa.replace(/^[\s,]+|[\s,]+$/g, "").replace(/(,\s*){2,}/g, ", ");
      return { nilai: [pilih, sisa].filter(Boolean).join(", ") };
    }
    default:
      return { galat: "Kolom tidak boleh diubah." };
  }
}

const OPSI_DAFTAR = { bidang: BIDANG.map((b) => b.form), jadwalLive: JADWAL.map((j) => j.form), jenisProyek: MINAT_FORM };

/** Sama maknanya? ("7302…" = "BSI 7302…"; urutan pilihan tidak berpengaruh; "-" = kosong). */
export function samaNilai(kolom, lama, baru) {
  if (kolom === "rekening") {
    const a = bankDanRekening(lama);
    const b = bankDanRekening(baru);
    return a.nomor === b.nomor && (a.bank || "BSI") === (b.bank || "BSI");
  }
  if (OPSI_DAFTAR[kolom]) {
    const k = (x) => pilihanTerpilih(x, OPSI_DAFTAR[kolom]).sort().join("|");
    return k(lama) === k(baru);
  }
  const n = (x) => {
    const t = norm(x);
    return t === "-" || (kolom === "kapasitas" && t === "0") ? "" : t;
  };
  return n(lama) === n(baru);
}

function mapBaris({ row, v }) {
  return {
    row,
    waktu: norm(v[0]),
    idGuru: norm(v[1]),
    nama: norm(v[2]),
    email: norm(v[3]),
    kolom: norm(v[4]),
    label: KOLOM_UBAH[norm(v[4])]?.label || norm(v[4]),
    lama: norm(v[5]),
    baru: norm(v[6]),
    status: norm(v[7]) || "Menunggu",
    diputuskan: norm(v[8]),
  };
}

export async function daftarPerubahan({ idGuru, status } = {}) {
  return (await bacaBaris(TAB_PERUBAHAN, H))
    .filter(({ v }) => norm(v[4]))
    .map(mapBaris)
    .filter((p) => (!idGuru || p.idGuru === String(idGuru)) && (!status || p.status === status))
    .reverse(); // terbaru dulu
}

/**
 * Terapkan isian "Profil saya". `isian` = { kolom: nilai }.
 * Preferensi langsung ditulis ke Database guru; kolom sensitif diajukan.
 */
export async function ajukanPerubahan(guru, isian) {
  const langsung = {};
  const ajuan = [];
  const galat = [];
  for (const [kolom, isi] of Object.entries(isian || {})) {
    const def = KOLOM_UBAH[kolom];
    if (!def) continue;
    const lama = norm(guru[kolom]);
    const cek = periksaIsian(kolom, isi, lama);
    if (cek.galat) {
      galat.push(`${def.label}: ${cek.galat}`);
      continue;
    }
    if (samaNilai(kolom, lama, cek.nilai)) continue; // tidak berubah
    if (def.setuju) ajuan.push({ kolom, lama, baru: cek.nilai });
    else langsung[kolom] = cek.nilai;
  }
  if (galat.length) throw new Error(galat.join(" "));
  if (Object.keys(langsung).length) await updateTeacher(guru.row, langsung);
  if (ajuan.length) {
    // ajuan lama untuk kolom yang sama yang belum diputuskan: diganti yang baru
    const tunda = await daftarPerubahan({ idGuru: guru.idGuru, status: "Menunggu" });
    for (const t of tunda.filter((t) => ajuan.some((a) => a.kolom === t.kolom))) await ubahBaris(TAB_PERUBAHAN, t.row, { 7: "Diganti", 8: waktu() });
    await tambahBaris(
      TAB_PERUBAHAN,
      H,
      ajuan.map((a) => [waktu(), guru.idGuru, guru.nama, guru.email, a.kolom, a.lama, a.baru, "Menunggu", ""])
    );
  }
  return { langsung: Object.keys(langsung), menunggu: ajuan.map((a) => a.kolom) };
}

/** Keputusan admin atas satu ajuan. */
export async function putuskanPerubahan(row, setuju) {
  const semua = await daftarPerubahan();
  const p = semua.find((x) => x.row === Number(row));
  if (!p) throw new Error("Ajuan tidak ditemukan.");
  if (p.status !== "Menunggu") throw new Error(`Ajuan ini sudah ${p.status.toLowerCase()}.`);
  if (setuju) {
    const g = ((await getTeachers()).rows || []).find((x) => String(x.idGuru) === p.idGuru);
    if (!g) throw new Error("Guru dengan ID ini tidak ada di Database guru.");
    if (!KOLOM_UBAH[p.kolom]?.setuju) throw new Error("Kolom ini tidak lewat persetujuan.");
    await updateTeacher(g.row, { [p.kolom]: p.baru });
  }
  await ubahBaris(TAB_PERUBAHAN, p.row, { 7: setuju ? "Disetujui" : "Ditolak", 8: waktu() });
  return { ...p, status: setuju ? "Disetujui" : "Ditolak" };
}

/** Nilai isian awal "Profil saya" dari baris Database guru. */
export function isianAwal(g) {
  const { bank, nomor } = bankDanRekening(g.rekening);
  return {
    wa: g.wa || "",
    rekening: { bank: bank || "BSI", nomor: nomor || "" },
    pemilikRekening: g.pemilikRekening || "",
    npwp: g.npwp && g.npwp !== "-" ? g.npwp : "",
    kapasitas: g.kapasitas ? String(g.kapasitas) : "",
    liveclass: LIVE_FORM.includes(g.liveclass) ? g.liveclass : "",
    jadwalLive: pilihanTerpilih(g.jadwalLive, JADWAL.map((j) => j.form)),
    bidang: pilihanTerpilih(g.bidang, BIDANG.map((b) => b.form)),
    jenisProyek: pilihanTerpilih(g.jenisProyek, MINAT_FORM),
  };
}
