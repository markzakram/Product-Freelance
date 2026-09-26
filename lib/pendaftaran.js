// ============================================================================
//  PENDAFTARAN GURU — jawaban Google Form "Pendataan Guru Freelance
//  PT.Cerebrum" (spreadsheet terpisah, hanya DIBACA).
//
//  Verifikasi = yang selama ini dikerjakan manual: jawaban disalin ke tab
//  "Data guru freelance" dengan ID guru baru, lalu dibuatkan akun login.
//  Kolom dicocokkan lewat JUDUL, bukan urutan — kalau form mendapat
//  pertanyaan baru, kolom sheet jawaban ikut bergeser.
// ============================================================================

import { SHEET_IDS, authParams, batchRead, batchWrite, sheetMeta } from "./gauth";
import { getTeachers, nextIdGuru, TAB_GURU } from "./teachers";
import { bacaAkun, buatAkun, rapikanEmail, STATUS } from "./akun";
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

async function bacaJawaban() {
  const ap = await authParams();
  if (!ap) throw new Error("Kredensial Google belum diset.");
  let tab = TAB_JAWABAN;
  const tabs = await sheetMeta(REG, ap);
  if (!tabs.some((t) => t.title === tab)) tab = tabs[0]?.title; // form dipindah/diubah namanya
  // FORMATTED: tanggal & angka persis seperti yang terlihat di sheet — itu
  // pula yang disalin ke Data guru (angka mentah = nomor seri tanggal).
  const [rows] = await batchRead(REG, [`'${tab}'!A1:BZ3000`], ap, "FORMATTED_VALUE");
  return { head: (rows || [])[0] || [], data: (rows || []).slice(1) };
}

/** Semua pendaftar (satu per email, jawaban terbaru) + statusnya. */
export async function daftarPendaftar() {
  const [{ head, data }, guru, akun] = await Promise.all([bacaJawaban(), getTeachers(), bacaAkun({ segar: true })]);
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
    bidang: cari(head, /^bidang/i),
    jenisProyek: cari(head, /^jenis proyek/i),
    kapasitas: cari(head, /kapasitas/i),
    cv: cari(head, /cv/i),
    portofolio: cari(head, /portofolio/i),
    video: head.findIndex((h, k) => /video/i.test(h) && k > 0),
  };
  const emailGuru = new Map((guru.rows || []).filter((g) => g.email).map((g) => [rapikanEmail(g.email), g]));
  const keputusan = new Map(akun.map((a) => [a.email, a]));

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
      pengalaman: norm(r[i.pengalaman]).slice(0, 400),
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
      const a = keputusan.get(p.email);
      const status = g ? "Terverifikasi" : a?.status === STATUS.ditolak ? "Ditolak" : "Menunggu";
      return { ...p, status, idGuru: g?.idGuru || "" };
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
 * Verifikasi pendaftar: salin jawaban terbarunya ke "Data guru freelance"
 * (ID guru baru) lalu buat akun berpassword acak. Mengembalikan kredensial
 * untuk dikirim admin lewat WhatsApp.
 */
export async function verifikasiPendaftar(email) {
  const e = rapikanEmail(email);
  const ap = await authParams();
  const [{ head, data }, guru, [headGuru]] = await Promise.all([
    bacaJawaban(),
    getTeachers(),
    batchRead(SHEET_IDS.master, [`'${TAB_GURU}'!A1:AC1`], ap),
  ]);
  const rows = guru.rows || [];
  if (rows.some((g) => rapikanEmail(g.email) === e)) throw new Error("Email ini sudah ada di Database guru.");

  const iEmail = cari(head, /e-?mail/i);
  const semua = data.filter((r) => rapikanEmail(r[iEmail]) === e);
  if (!semua.length) throw new Error("Pendaftar dengan email ini tidak ditemukan.");
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

  const nama = norm(jawab[cari(head, /^nama lengkap/i)]);
  const wa = norm(jawab[cari(head, /whatsapp/i)]);
  const [kred] = await buatAkun([{ email: e, idGuru: id, nama, wa }]);
  return { ...kred, idGuru: id, baris };
}
