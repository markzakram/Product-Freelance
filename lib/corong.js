// ============================================================================
//  CORONG REKRUTMEN & AKTIVASI — hitungan murni (dipakai halaman "Corong
//  rekrutmen"; aman untuk browser, bisa diuji di Node). Sumbernya data yang
//  sudah dimuat dashboard: pendaftar (form + tab Seleksi guru + QC sampel),
//  tab Akun guru, Data guru, Log semua bulan, dan tab Reachout.
//
//  Setiap tahap corong = tahap sebelumnya ∩ syarat tahap itu, jadi angkanya
//  selalu menurun dan "% dari tahap sebelumnya" tidak pernah > 100%.
// ============================================================================

import { pemetaLog } from "./cocokGuru";
import { waktuKeMs } from "./reachoutOpsi";

const HARI = 86400000;
const BATAL = /cancel|batal/i;
const low = (s) => String(s ?? "").trim().toLowerCase();

// Berapa hari sebuah tahap boleh diam sebelum dianggap tertahan.
export const BATAS = { menunggu: 3, tinjau: 3, sampel: 5, revisi: 5, lolos: 2, siap: 2, login: 3, ganti: 1, proyek: 14 };

/** Cap waktu form ("24/09/2026 14:05:12", jam WIB) -> ms epoch. */
export const msDaftar = (p) => (p.urut ? p.urut - 7 * 3600000 : waktuKeMs(p.waktu));
const hari = (dari, kini) => (dari ? Math.floor((kini - dari) / HARI) : 0);
export const persen = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** idGuru -> { ada, terakhir } dari Log semua bulan (baris Cancel tidak dihitung). */
export function proyekPerGuru(log, guru) {
  const peta = pemetaLog(guru);
  const out = new Map();
  log.forEach((a) => {
    if (BATAL.test(a.status || "")) return;
    const g = peta(a);
    if (!g?.idGuru) return;
    const t = a.tanggal ? Date.parse(a.tanggal) : 0;
    const x = out.get(String(g.idGuru)) || { ada: true, terakhir: 0, soal: 0 };
    x.terakhir = Math.max(x.terakhir, Number.isFinite(t) ? t : 0);
    x.soal += a.jumlah || 0;
    out.set(String(g.idGuru), x);
  });
  return out;
}

/** Kontak terakhir per guru (dicari lewat ID guru DAN email — pendaftar belum punya ID). */
export function kontakTerakhir(kontak) {
  const perId = new Map();
  const perEmail = new Map();
  kontak.forEach((k) => {
    const simpan = (m, kunci) => kunci && (!m.get(kunci) || m.get(kunci).t < k.t) && m.set(kunci, k);
    simpan(perId, k.idGuru && String(k.idGuru));
    simpan(perEmail, low(k.email));
  });
  return ({ idGuru, email }, tujuan) => {
    const cari = (m, kunci) => {
      const k = kunci && m.get(kunci);
      return k && (!tujuan || tujuan.includes(k.tujuan)) ? k : null;
    };
    const a = cari(perId, idGuru && String(idGuru));
    const b = cari(perEmail, low(email));
    return !a ? b : !b ? a : a.t >= b.t ? a : b;
  };
}

// ----------------------------------------------------------------- REKRUTMEN
const LOLOS = new Set(["Lolos sampel", "Siap akses", "Punya akses"]);

/**
 * Corong pendaftar (kohort = yang mendaftar sejak `sejakMs`, 0 = semua).
 * Tahap: mendaftar -> ditinjau -> masuk Data guru -> lolos sampel (atau guru
 * lama tanpa sampel) -> punya akses -> mengambil proyek.
 */
export function corongRekrutmen(pendaftar, { log = [], guru = [], akun = [], sejakMs = 0 } = {}) {
  const kohort = pendaftar.filter((p) => !sejakMs || msDaftar(p) >= sejakMs);
  const proyek = proyekPerGuru(log, guru);
  const akunByEmail = new Map(akun.map((a) => [low(a.email), a]));

  const syarat = [
    ["daftar", "Mendaftar", "mengisi form pendaftaran", () => true],
    ["tinjau", "Ditinjau", "berkas sudah dilihat admin (termasuk ditolak)", (p) => p.status !== "Menunggu"],
    ["data", "Masuk Data guru", "verifikasi 1", (p) => Boolean(p.idGuru)],
    ["lolos", "Lolos sampel", "atau tanpa sampel (guru lama / data sebelum alur seleksi)", (p) => LOLOS.has(p.status)],
    ["akses", "Punya akses", "verifikasi 2 — akun login dibuat", (p) => p.status === "Punya akses"],
    ["ambil", "Mengambil proyek", "minimal satu baris di Log", (p) => proyek.has(String(p.idGuru))],
  ];
  let sisa = kohort;
  const tahap = syarat.map(([k, label, ket, f]) => {
    sisa = sisa.filter(f);
    return { k, label, ket, n: sisa.length, daftar: sisa };
  });

  // yang benar-benar masuk tahap sampel (guru baru di data lama tidak pernah diminta)
  const wajibSampel = kohort.filter((p) => p.perluSampel && (["Sampel", "Lolos sampel"].includes(p.seleksi?.tahap) || p.seleksi?.qc?.length));
  const kirim = wajibSampel.filter((p) => p.seleksi?.qc?.length);
  const lolosQc = kirim.filter((p) => p.seleksi.qc.some((q) => q.hasil === "Lolos"));
  const lamaAkses = kohort
    .filter((p) => p.status === "Punya akses")
    .map((p) => {
      const a = akunByEmail.get(low(p.email));
      const t = a ? waktuKeMs(a.dibuat) : 0;
      return t && msDaftar(p) ? (t - msDaftar(p)) / HARI : NaN;
    });

  return {
    kohort: kohort.length,
    tahap,
    ditolak: kohort.filter((p) => p.status === "Ditolak").length,
    diproses: kohort.filter((p) => p.status !== "Ditolak" && p.status !== "Punya akses").length,
    ambilTanpaAkun: kohort.filter((p) => p.status !== "Punya akses" && proyek.has(String(p.idGuru))).length,
    sampel: {
      diminta: wajibSampel.length,
      kirim: kirim.length,
      lolos: lolosQc.length,
      sesiSampaiLolos: median(lolosQc.map((p) => p.seleksi.qc.findIndex((q) => q.hasil === "Lolos") + 1)),
    },
    hariSampaiAkses: median(lamaAkses),
    nHariSampaiAkses: lamaAkses.filter(Number.isFinite).length,
  };
}

/** Pendaftar yang diam terlalu lama di tahapnya, paling lama di atas. */
export function tertahanRekrutmen(pendaftar, { kontak = [], kini = Date.now() } = {}) {
  const terakhir = kontakTerakhir(kontak);
  const out = [];
  pendaftar.forEach((p) => {
    const sel = p.seleksi || {};
    const qc = sel.qc || [];
    const qcAkhir = qc[qc.length - 1];
    const tSel = waktuKeMs(sel.diubah);
    const tQc = qcAkhir ? waktuKeMs(qcAkhir.waktu) : 0;
    // `sejak` menentukan kapan dianggap tertahan (pengingat WA menunda);
    // `dasar` = sejak kapan tahap ini sebenarnya diam (yang ditampilkan).
    const dorong = (jenis, alasan, sejak, batas, dasar = sejak) => {
      if (sejak && hari(sejak, kini) >= batas) out.push({ p, jenis, alasan, hari: hari(dasar, kini), kontak: terakhir(p) });
    };
    const minta = terakhir(p, ["Minta sampel"]);
    switch (p.status) {
      case "Menunggu":
        dorong("tinjau", "belum ditinjau sejak mendaftar", msDaftar(p), BATAS.menunggu);
        break;
      case "Tinjau":
        dorong("putuskan", "sudah ditinjau, belum diputuskan", tSel || msDaftar(p), BATAS.tinjau);
        break;
      case "Sampel":
        if (!qc.length)
          dorong(
            "sampel",
            minta ? "belum mengirim sampel" : "belum mengirim sampel — permintaan belum pernah dikirim lewat WA dashboard",
            Math.max(tSel, minta?.t || 0),
            BATAS.sampel,
            tSel || minta?.t
          );
        else if (qcAkhir.hasil === "Perlu revisi") dorong("revisi", `revisi sampel (QC sesi ${qcAkhir.sesi}) belum masuk`, Math.max(tQc, minta?.t || 0), BATAS.revisi, tQc);
        else if (qcAkhir.hasil === "Tidak lolos") dorong("putuskan", "sampel tidak lolos — putuskan tolak atau beri revisi", tQc, 0);
        break;
      case "Lolos sampel":
        dorong(p.idGuru ? "akses" : "data", p.idGuru ? "lolos sampel, belum diberi akses" : "lolos sampel, belum masuk Data guru", tQc || tSel, BATAS.lolos);
        break;
      case "Siap akses":
        // Hanya yang diverifikasi lewat dashboard (punya baris Seleksi). Guru
        // yang sudah ada di Data guru sebelum alur ini masuk corong aktivasi.
        if (tSel) dorong("akses", "sudah di Data guru, belum diberi akses", tSel, BATAS.siap);
        break;
      default:
    }
  });
  return out.sort((a, b) => b.hari - a.hari);
}

// ------------------------------------------------------------------ AKTIVASI
/**
 * Corong aktivasi seluruh Data guru: punya email -> akun dibuat -> pernah
 * login -> sudah ganti password -> mengambil proyek sejak punya akun.
 */
export function corongAktivasi(guru, { akun = [], log = [] } = {}) {
  const akunByEmail = new Map(akun.map((a) => [low(a.email), a]));
  const proyek = proyekPerGuru(log, guru);
  const baris = guru.map((g) => {
    const a = g.email ? akunByEmail.get(low(g.email)) : null;
    const pr = proyek.get(String(g.idGuru));
    const tAkun = a ? waktuKeMs(a.dibuat) : 0;
    // tanggal log per hari; tanpa tanggal dianggap baru (tidak bisa dibuktikan sebelumnya)
    const ambilSejakAkun = Boolean(pr && (!pr.terakhir || !tAkun || pr.terakhir + HARI > tAkun));
    return { g, a, pr, tAkun, ambilSejakAkun };
  });
  const syarat = [
    ["data", "Di Data guru", "semua guru terdaftar", () => true],
    ["email", "Punya email", "syarat membuat akun", (x) => Boolean(x.g.email)],
    ["akun", "Akun dibuat", "verifikasi 2 (akun aktif)", (x) => Boolean(x.a?.punyaPassword && x.a.status !== "Nonaktif")],
    ["login", "Pernah login", "masuk ke halaman proyek", (x) => Boolean(x.a.loginTerakhir)],
    ["ganti", "Sudah ganti password", "akun siap dipakai", (x) => !x.a.wajibGanti],
    ["ambil", "Mengambil proyek", "sejak punya akun", (x) => x.ambilSejakAkun],
  ];
  let sisa = baris;
  const tahap = syarat.map(([k, label, ket, f]) => {
    sisa = sisa.filter(f);
    return { k, label, ket, n: sisa.length, daftar: sisa };
  });
  return {
    tahap,
    baris,
    nonaktif: baris.filter((x) => x.a?.status === "Nonaktif").length,
    belumAkun: baris.filter((x) => x.g.email && !(x.a?.punyaPassword)).length,
    tanpaEmail: baris.filter((x) => !x.g.email).length,
  };
}

/** Guru ber-akun yang macet: terkunci, belum login, belum ganti password, belum ambil proyek. */
export function tertahanAktivasi(baris, { kontak = [], kini = Date.now() } = {}) {
  const terakhir = kontakTerakhir(kontak);
  const out = [];
  baris.forEach((x) => {
    const { a, g } = x;
    if (!a?.punyaPassword || a.status === "Nonaktif") return;
    const tLogin = waktuKeMs(a.loginTerakhir);
    const ingat = terakhir(g, ["Ingatkan aktivasi"])?.t || 0; // pengingat menunda, lihat tertahanRekrutmen
    const dorong = (jenis, alasan, dasar, batas) => {
      const sejak = Math.max(dasar || 0, ingat);
      if (dasar && hari(sejak, kini) >= batas) out.push({ ...x, jenis, alasan, hari: hari(dasar, kini), kontak: terakhir(g) });
    };
    if (a.terkunci) out.push({ ...x, jenis: "terkunci", alasan: "akun terkunci sementara (salah password berulang)", hari: 0, kontak: terakhir(g) });
    else if (!a.loginTerakhir) {
      const kirim = terakhir(g, ["Kirim akun"]);
      dorong("login", kirim ? `belum pernah login · akun dikirim ${hari(kirim.t, kini)} hari lalu` : "belum pernah login · pengiriman akun tidak tercatat di dashboard", x.tAkun, BATAS.login);
    } else if (a.wajibGanti) dorong("ganti", "sudah login, tapi belum membuat password baru", tLogin || x.tAkun, BATAS.ganti);
    else if (!x.ambilSejakAkun) dorong("proyek", "akun siap, tapi belum mengambil proyek", x.tAkun, BATAS.proyek);
  });
  const urut = { terkunci: 0, login: 1, ganti: 2, proyek: 3 };
  return out.sort((p, q) => urut[p.jenis] - urut[q.jenis] || q.hari - p.hari);
}

// ------------------------------------------------------------- pesan WA
const sapa = (nama) => `Halo ${nama || ""}`;
export const pesanIngatkanSampel = (p) =>
  `${sapa(p.nama)}, kami masih menunggu sampel soal Anda untuk seleksi freelance Cerebrum. ` +
  "Kirim tautan Google Drive-nya ke nomor ini ya. Kalau ada kendala atau butuh arahan lagi, balas saja pesan ini.\n\nTerima kasih!";
export const pesanIngatkanRevisi = (p, sesi) =>
  `${sapa(p.nama)}, kami menunggu revisi sampel Anda (QC sesi ${sesi}). Kirim tautan Google Drive revisinya ke nomor ini ya, nanti kami QC lagi.\n\nTerima kasih!`;
export const pesanIngatkanLogin = (g, asal) =>
  `${sapa(g.nama)}, akun Proyek Guru Cerebrum Anda sudah aktif. Silakan masuk di ${asal}/open/masuk dengan email ${g.email} ` +
  "dan password sementara yang sudah kami kirim — setelah itu Anda diminta membuat password baru.\n\n" +
  "Kalau password-nya hilang, balas pesan ini agar kami buatkan yang baru. Terima kasih!";
export const pesanIngatkanGanti = (g, asal) =>
  `${sapa(g.nama)}, tinggal satu langkah lagi: buat password baru di ${asal}/open/ganti-password supaya bisa melihat dan mengambil proyek.\n\nTerima kasih!`;
export const pesanAjakProyek = (g, asal, n) =>
  `${sapa(g.nama)}, ${n ? `bulan ini masih ada ${n} proyek yang butuh guru` : "ada proyek yang bisa diambil"}. ` +
  `Lihat dan ambil yang sesuai bidang Anda di ${asal}/open\n\nTerima kasih!`;
