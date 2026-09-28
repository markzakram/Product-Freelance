// ============================================================================
//  PENDAFTARAN GURU — jawaban Google Form "Pendataan Guru Freelance
//  PT.Cerebrum" (spreadsheet terpisah, hanya DIBACA).
//
//  Dua verifikasi:
//   1. Masuk Data guru — jawaban disalin ke "Data guru freelance" dengan ID
//      guru baru (yang selama ini dikerjakan manual). Belum bisa buka /open.
//   2. Akses proyek — dibuatkan akun login (lib/akun.js). Guru baru baru
//      diberi akses setelah sampelnya lolos QC (lib/seleksi.js).
//  Kolom dicocokkan lewat JUDUL, bukan urutan — kalau form mendapat
//  pertanyaan baru, kolom sheet jawaban ikut bergeser.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite, sheetMeta } from "./gauth";
import { getTeachers, nextIdGuru, lupakanGuru, TAB_GURU } from "./teachers";
import { bacaAkun, buatAkun, rapikanEmail } from "./akun";
import { bacaSeleksi } from "./seleksi";
import { norm } from "./format";

const REG = SHEET_IDS.pendaftaran;
const TAB_JAWABAN = process.env.TAB_PENDAFTARAN || "Form responses 1";

const kunci = (h) => norm(h).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cari = (head, re) => head.findIndex((h) => re.test(norm(h)));
const tautan = (v) => (/^https?:\/\//i.test(norm(v)) ? norm(v).split(/[\s,]+/).filter((x) => /^https?:/i.test(x)) : []);

// "20/05/2026 10:30:37" -> angka untuk mengurutkan
function waktuAngka(s) {
  const m = norm(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : 0;
}

// Jawaban form hanya bertambah saat ada yang mendaftar: cache 30 detik cukup.
let cacheJawaban = null;
async function bacaJawaban() {
  if (cacheJawaban && Date.now() - cacheJawaban.at < 30000) return cacheJawaban.isi;
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google belum diset.");
  let tab = TAB_JAWABAN;
  const tabs = await sheetMeta(REG, ap);
  if (!tabs.some((t) => t.title === tab)) tab = tabs[0]?.title; // form dipindah/diubah namanya
  // FORMATTED: tanggal & angka persis seperti yang terlihat di sheet — itu
  // pula yang disalin ke Data guru (angka mentah = nomor seri tanggal).
  const [rows] = await batchRead(REG, [`'${tab}'!A1:BZ3000`], ap, "FORMATTED_VALUE");
  const isi = { head: (rows || [])[0] || [], data: (rows || []).slice(1) };
  cacheJawaban = { at: Date.now(), isi };
  return isi;
}

/**
 * Status pendaftar dari tiga sumber: ada di Data guru? punya akun aktif?
 * tahap seleksi?
 *   belum di Data guru : Menunggu / Tinjau / Ditolak
 *   sudah di Data guru : Sampel / Lolos sampel / Siap akses / Ditolak
 *   punya akun aktif   : Punya akses
 */
export function statusPendaftar({ diDataGuru, punyaAkses, tahap }) {
  if (tahap === "Ditolak") return "Ditolak";
  if (diDataGuru && punyaAkses) return "Punya akses";
  if (diDataGuru) return tahap === "Sampel" || tahap === "Lolos sampel" ? tahap : "Siap akses";
  // (Sampel/Lolos sampel sebelum masuk Data guru = alur lama v2.3.0; tetap ditampilkan)
  return ["Tinjau", "Sampel", "Lolos sampel"].includes(tahap) ? tahap : "Menunggu";
}

/** Guru baru (atau status form kosong) wajib sampel; guru lama tidak. */
export const perluSampel = (statusForm) => !/lama/i.test(String(statusForm || ""));

/** Semua pendaftar (satu per email, jawaban terbaru) + statusnya. */
export async function daftarPendaftar() {
  const [{ head, data }, guru, seleksi, akun] = await Promise.all([bacaJawaban(), getTeachers(), bacaSeleksi(), bacaAkun()]);
  const akses = new Map(akun.filter((a) => a.hash && a.status === "Aktif").map((a) => [a.email, a]));
  const i = {
    waktu: cari(head, /^timestamp|stempel waktu/i),
    email: cari(head, /e-?mail/i),
    wa: cari(head, /whatsapp/i),
    nama: cari(head, /^nama lengkap/i),
    pendidikan: cari(head, /^pendidikan/i),
    jurusan: cari(head, /^jurusan/i),
    universitas: cari(head, /universitas/i),
    pekerjaan: cari(head, /^pekerjaan/i),
    pengalaman: cari(head, /pengalaman/i),
    statusForm: head.findIndex((h) => /^status$/i.test(norm(h))),
    instansi: cari(head, /^nama instansi/i),
    live: cari(head, /bersedia.*live/i),
    jadwal: cari(head, /ketersediaan/i),
    catatan: cari(head, /^catatan/i),
    teknis: cari(head, /kesiapan teknis/i),
    bidang: cari(head, /^bidang/i),
    jenisProyek: cari(head, /^jenis proyek/i),
    kapasitas: cari(head, /kapasitas/i),
    cv: cari(head, /cv/i),
    portofolio: cari(head, /portofolio/i),
    video: head.findIndex((h, k) => /video/i.test(h) && k > 0),
  };
  const emailGuru = new Map((guru.rows || []).filter((g) => g.email).map((g) => [rapikanEmail(g.email), g]));

  const perEmail = new Map();
  data.forEach((r, k) => {
    const email = rapikanEmail(r[i.email]);
    if (!email) return;
    const p = {
      baris: k + 2,
      waktu: norm(r[i.waktu]),
      urut: waktuAngka(r[i.waktu]),
      email,
      wa: norm(r[i.wa]),
      nama: norm(r[i.nama]),
      pendidikan: norm(r[i.pendidikan]),
      jurusan: norm(r[i.jurusan]),
      universitas: norm(r[i.universitas]),
      pekerjaan: norm(r[i.pekerjaan]),
      pengalaman: norm(r[i.pengalaman]).slice(0, 1200),
      statusForm: norm(r[i.statusForm]),
      instansi: norm(r[i.instansi]).slice(0, 300),
      live: norm(r[i.live]),
      jadwal: norm(r[i.jadwal]),
      catatanForm: norm(r[i.catatan]).slice(0, 600),
      teknis: norm(r[i.teknis]).slice(0, 300),
      bidang: norm(r[i.bidang]).slice(0, 300),
      jenisProyek: norm(r[i.jenisProyek]),
      kapasitas: norm(r[i.kapasitas]),
      berkas: [
        ...tautan(r[i.cv]).map((u) => ({ label: "CV", u })),
        ...tautan(r[i.portofolio]).map((u) => ({ label: "Portofolio", u })),
        ...(i.video >= 0 ? tautan(r[i.video]).map((u) => ({ label: "Video", u })) : []),
      ],
      jumlahKirim: 1,
    };
    const lama = perEmail.get(email);
    if (lama) {
      p.jumlahKirim = lama.jumlahKirim + 1;
      if (lama.urut > p.urut) return perEmail.set(email, { ...lama, jumlahKirim: p.jumlahKirim });
    }
    perEmail.set(email, p);
  });

  return Array.from(perEmail.values())
    .map((p) => {
      const g = emailGuru.get(p.email);
      const sel = seleksi.get(p.email) || null;
      const a = akses.get(p.email);
      const status = statusPendaftar({ diDataGuru: Boolean(g), punyaAkses: Boolean(a), tahap: sel?.tahap || "" });
      return {
        ...p,
        status,
        idGuru: g?.idGuru || "",
        perluSampel: perluSampel(p.statusForm),
        akun: a ? { wajibGanti: a.wajibGanti, loginTerakhir: a.loginTerakhir } : null,
        seleksi: sel ? { tahap: sel.tahap, skor: sel.skor, catatan: sel.catatan, diubah: sel.diubah, qc: sel.qc } : null,
      };
    })
    .sort((a, b) => b.urut - a.urut);
}

// Isi bebas dari form tidak boleh sampai dibaca sebagai rumus/angka oleh
// Sheets: "=IMPORTXML(...)" jadi rumus, NIK 16 digit kehilangan presisi,
// "+62..." kehilangan tanda plus, "08..." kehilangan nol.
const KOLOM_IDENTITAS = /whatsapp|nik|nomor induk|rekening|npwp/i;
function amankan(judul, v) {
  const s = norm(v);
  if (!s) return "";
  if (KOLOM_IDENTITAS.test(judul) || /^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

/**
 * VERIFIKASI 1: salin jawaban terbarunya ke "Data guru freelance" dengan ID
 * guru baru. Belum membuat akun — akses proyek adalah verifikasi 2.
 */
export async function masukkanDataGuru(email) {
  const e = rapikanEmail(email);
  const ap = await authParams();
  const [{ head, data }, guru, [headGuru]] = await Promise.all([
    bacaJawaban(),
    getTeachers(),
    batchRead(SHEET_IDS.master, [`'${TAB_GURU}'!A1:AC1`], ap),
  ]);
  const rows = guru.rows || [];
  if (rows.some((g) => rapikanEmail(g.email) === e)) throw galat(400, "Email ini sudah ada di Data guru (verifikasi 1 sudah dilakukan).");

  const iEmail = cari(head, /e-?mail/i);
  const semua = data.filter((r) => rapikanEmail(r[iEmail]) === e);
  if (!semua.length) throw galat(404, "Pendaftar dengan email ini tidak ditemukan.");
  const iWaktu = cari(head, /^timestamp|stempel waktu/i);
  const jawab = semua.reduce((a, b) => (waktuAngka(b[iWaktu]) >= waktuAngka(a[iWaktu]) ? b : a));

  // Kolom Data guru diisi dari kolom jawaban berjudul sama (kolom A = ID guru).
  const posisiJawab = new Map(head.map((h, k) => [kunci(h), k]).reverse()); // judul ganda -> ambil yang pertama
  const judulGuru = (headGuru?.[0] || []).map(norm);
  const id = nextIdGuru(rows);
  const baris = (rows.length ? Math.max(...rows.map((x) => x.row)) : 1) + 1;
  const nilai = judulGuru.map((h, k) => {
    if (k === 0) return "'" + id;
    const src = posisiJawab.get(kunci(h));
    return src === undefined ? "" : amankan(h, jawab[src]);
  });
  const terisi = nilai.filter((v, k) => k > 0 && v).length;
  if (terisi < 5) throw new Error("Judul kolom Data guru tidak cocok dengan form — salin manual dulu.");
  await batchWrite(SHEET_IDS.master, [{ range: `'${TAB_GURU}'!A${baris}`, values: [nilai] }], "USER_ENTERED");
  lupakanGuru();

  return {
    email: e,
    idGuru: id,
    baris,
    nama: norm(jawab[cari(head, /^nama lengkap/i)]),
    statusForm: norm(jawab[head.findIndex((h) => /^status$/i.test(norm(h)))]),
  };
}

const galat = (status, pesan, extra = {}) => Object.assign(new Error(pesan), { status, ...extra });

/**
 * VERIFIKASI 2: akses halaman proyek = akun login berpassword acak.
 * Syarat: sudah di Data guru, belum punya akun aktif, tidak ditolak, dan —
 * untuk guru baru — sampelnya sudah lolos QC (kecuali `paksa`).
 */
export async function beriAkses(email, { paksa = false } = {}) {
  const e = rapikanEmail(email);
  const [{ rows = [] }, akun, seleksi] = await Promise.all([getTeachers(), bacaAkun({ segar: true }), bacaSeleksi()]);
  const g = rows.find((x) => rapikanEmail(x.email) === e);
  if (!g) throw galat(400, "Belum masuk Data guru — lakukan verifikasi 1 dulu.");
  if (akun.some((a) => a.email === e && a.hash && a.status === "Aktif")) {
    throw galat(400, "Guru ini sudah punya akses. Untuk password baru, pakai Reset password di tab Akun guru.");
  }
  const tahap = seleksi.get(e)?.tahap || "";
  if (tahap === "Ditolak") throw galat(400, "Pendaftar ini ditolak — batalkan penolakan dulu.");
  if (perluSampel(g.status) && tahap !== "Lolos sampel" && !paksa) {
    throw galat(409, "Sampel guru baru ini belum lolos QC.", { perluKonfirmasi: true });
  }
  return buatAkun([{ email: g.email, idGuru: g.idGuru, nama: g.nama, wa: g.wa }]);
}
