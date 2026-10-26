"use client";

// ============================================================================
//  DASHBOARD ADMIN — kendali penuh atas tab "Juli_Proyek ASN & Bappenas".
//
//  Semua perubahan ditulis balik ke Google Sheets (spreadsheet tetap jadi
//  sumber kebenaran). Kolom turunan — Sisa, Fee, Bulan — dihitung oleh formula
//  di sheet, jadi di sini sifatnya baca-saja; menimpanya dengan angka statis
//  akan merusak formula sheet.
//
//  Tabel sengaja dibuat FIXED (tanpa geser horizontal): kolom memakai lebar
//  persen + teks membungkus, dan kolom yang bisa diturunkan digabung
//  (Bulan menyatu ke Tanggal, ID Guru ke Guru, PIC Soal+Video jadi satu).
//  Edit/tambah dilakukan lewat popup, bukan input di dalam baris.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rupiah, numberID, norm, parseNum, parseHarga, formatHarga, cekHargaBulanan, isBatal, STATUS_BATAL } from "@/lib/format";
import PrintArea from "./Receipts";
import Icon from "./Icon";
import Brand from "./Brand";
import Drawer, { Dialog } from "./Drawer";
import Combobox from "./Combobox";
import MasterPicker, { aktifkanKembali } from "./MasterPicker";
import ThemeToggle from "./ThemeToggle";
import PageActions from "./PageActions";
import DataBanner from "./DataBanner";
import { APP_VERSION } from "@/lib/versi";
import MasterPanel from "./MasterPanel";
import NewMonthPanel from "./NewMonthPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import GuruPanel from "./GuruPanel";
import PasangApp from "./PasangApp";
import AksesPanel, { DALAM_PROSES } from "./AksesPanel";
import CariGuru from "./CariGuru";
import PantauReachout from "./PantauReachout";
import CorongRekrutmen from "./CorongRekrutmen";
import { EVENT_REACHOUT, aturPelaku } from "@/lib/kontakWa";
import TimPanel from "./TimPanel";
import PusatPengambilan from "./PusatPengambilan";
import NotifikasiClo from "./NotifikasiClo";
import { ringkasanLog } from "@/lib/ringkasanLog";
import { bacaApi, buatAntrianSinkron, jadwalkanSinkron } from "@/lib/sinkronisasi";
import { bolehTim } from "@/lib/peranTim";
import DemoPanel from "./DemoPanel";
import { MODE_DEMO } from "@/lib/demo";
import { ST as ST_PJ, hitungMundur, laporanBaru, labelH, tanggalPendek } from "@/lib/pengerjaanOpsi";
import { isiPaket, rincianPaket, ISI_MIN, ISI_MAKS, TIPE_PROYEK } from "@/lib/paket";
import { barisRekap, bankDanRekening, judulRekap, unduhExcel, salinRekap } from "@/lib/rekapFee";
import { susunLaporan, unduhLaporan } from "@/lib/laporanPengambilan";

const STATUS_KNOWN = ["Running Soal", "QC Soal", "Revisi Soal", "Approved", "Running Video", STATUS_BATAL];
const SEMUA = "Semua";
// Sinkron berkala 60 detik (v3.16.1): kuota baca Google 60/menit dipakai bersama
// seluruh tim dan halaman guru. Simpan & tombol Segarkan tetap langsung.
const POLL_MS = 60000;
const LOGIN_URL = "/admin/login?next=%2Fadmin";

const F0 = { q: "", from: "", to: "", platform: SEMUA, guru: SEMUA, subtes: SEMUA, status: SEMUA, pic: SEMUA };

// Halaman yang isinya terikat satu bulan -> perlu pemilih bulan.
// (Master, Proyek Baru, dan Analisis tidak: master bersifat lintas bulan dan
// Analisis punya filter bulannya sendiri.)
const PERBULAN = new Set(["katalog", "ambil", "log", "bayar", "laporan"]);
// Halaman Laporan (khusus Pemilik): tiga pantauan lama jadi tab di dalamnya.
const LAPORAN = [
  ["analisis", "Analisis lintas bulan", "chart"],
  ["reachout", "Reachout", "send"],
  ["corong", "Corong rekrutmen", "filter"],
];

const tglID = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
};
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));

// Cookie sesi = hash dari INTERNAL_PASSWORD. Kalau password diganti atau cookie
// kedaluwarsa (12 jam), tab yang masih terbuka akan dapat 401 — itu bukan error
// data, jadi ditangani khusus: polling dihentikan dan user diminta login ulang.
class SesiBerakhir extends Error {
  constructor() {
    super("Sesi berakhir");
    this.expired = true;
  }
}

async function apiGet(bulan, segar = false) {
  return bacaApi("/api/admin/board?bulan=" + encodeURIComponent(bulan || "") + (segar ? "&segar=1" : ""));
}

async function apiPost(payload) {
  const res = await fetch("/api/admin/board", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (res.status === 401) throw new SesiBerakhir();
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal menyimpan (HTTP ${res.status})`);
  return j;
}

function statusPill(s) {
  const t = (s || "").toLowerCase();
  let cls = "run";
  if (t.includes("appro")) cls = "appr";
  else if (t.includes("revisi")) cls = "rev";
  else if (t.includes("qc")) cls = "qc";
  else if (t.includes("paid")) cls = "paid";
  if (isBatal(s)) cls = "batal";
  return <span className={"pill " + cls}>{s || "—"}</span>;
}

const Cols = ({ widths }) => (
  <colgroup>
    {widths.map((w, i) => (
      <col key={i} style={{ width: w + "%" }} />
    ))}
  </colgroup>
);

// ============================================================================
const PENGGUNA_BAWAAN = { nama: "Admin", email: "", peran: ["Pemilik"], pemilik: true, akunTim: false };
// Sama dengan bolehPeran di lib/authServer (server tetap memeriksa ulang).
export const bolehP = bolehTim;

export default function AdminBoard({ initial, brand = "Cerebrum", peringatanPassword = false, pengguna = PENGGUNA_BAWAAN }) {
  const akademik = bolehP(pengguna, ["Akademik"]);
  const operasional = bolehP(pengguna, ["Akademik", "Seleksi"]);
  const pemilikP = bolehP(pengguna, ["Pemilik"]);
  const clo = bolehP(pengguna, ["Seleksi"]);
  const [board, setBoard] = useState(initial);
  // Satu ruang kerja: dashboard dan matriks ada di Pengambilan Guru.
  const [tab, setTab] = useState("ambil");
  const [laporanSub, setLaporanSub] = useState("analisis");
  const [f, setF] = useState(F0);
  const [err, setErr] = useState("");
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [print, setPrint] = useState(null);
  const [navOpen, setNavOpen] = useState(false); // sidebar di layar sempit
  // Wadah tombol utama di header halaman; panel mengisinya lewat portal.
  const [aksiEl, setAksiEl] = useState(null);
  // Bulan yang sedang dikelola. Kosong = bulan terbaru (ditentukan server).
  const [bulanAktif, setBulanAktif] = useState("");
  // data tambahan: katalog master & seluruh bulan (untuk Master/Proyek Baru/Analisis)
  const [master, setMaster] = useState({ rows: [] });
  const [allMonths, setAllMonths] = useState({ months: [], catalog: [], log: [] });
  const [guru, setGuru] = useState({ rows: [] });
  const [akses, setAkses] = useState(null); // pendaftar & akun guru
  const [reachout, setReachout] = useState(null); // kontak WA admin -> guru (tab Reachout)
  const [pengerjaan, setPengerjaan] = useState(null); // pengambilan guru bulan aktif + aturan (deadline)
  const [fokusNotifikasi, setFokusNotifikasi] = useState(null);
  // Lompatan dari halaman lain ke Pendaftaran & akun: { email?, tampil, saringA?, tinjau? }
  const [fokusAkses, setFokusAkses] = useState(null);
  const [extraLoaded, setExtraLoaded] = useState(false);
  const [syncInfo, setSyncInfo] = useState({ board: { at: initial.at || 0, error: initial.error || (initial.tertunda ? "Pembaruan spreadsheet tertunda." : "") } });
  const syncInfoRef = useRef(syncInfo);
  syncInfoRef.current = syncInfo;
  const pembaca = useRef(null);
  if (!pembaca.current) pembaca.current = buatAntrianSinkron();
  const waktuData = useRef(new Map(initial.at ? [[`board:${initial.tab}`, initial.at]] : []));
  const bulanDiminta = useRef(bulanAktif);
  bulanDiminta.current = bulanAktif;
  const bulanTerlihat = useRef(board.tab);
  bulanTerlihat.current = board.tab;
  const catatSukses = useCallback((key, data, scope = key) => {
    const at = data.at || Date.now();
    if (at < (waktuData.current.get(scope) || 0)) return false;
    waktuData.current.set(scope, at);
    setSyncInfo((s) => ({ ...s, [key]: { at, error: data.tertunda ? "Pembaruan spreadsheet tertunda; masih memakai data terakhir." : "" } }));
    return true;
  }, []);
  const catatGagal = useCallback((key, e) => {
    if (e.expired || e.status === 401) { setExpired(true); return; }
    setSyncInfo((s) => ({ ...s, [key]: { ...s[key], error: e.message || "Koneksi pembaruan terputus." } }));
  }, []);

  const { projects = [], assignments = [], teachers = [], source, canWrite, diag, sheetWritable, serviceAccount } = board;
  const readOnly = !canWrite;
  // Kredensial ada & data terbaca, tapi spreadsheet hanya dibagikan sebagai
  // Viewer -> kasus khusus yang perlu instruksi, bukan sekadar "baca-saja".
  const kurangIzin = source === "live" && sheetWritable === false;

  const permintaanBoard = useRef(0);
  const refresh = useCallback(async (segar = true) => {
    const requestId = ++permintaanBoard.current;
    setSyncing(true);
    try {
      const j = await pembaca.current(`board:${bulanAktif}`, () => apiGet(bulanAktif, segar !== false), segar !== false);
      if (requestId !== permintaanBoard.current || bulanDiminta.current !== bulanAktif) return true;
      if (board.source === "live" && j.source === "sample") throw new Error("Koneksi spreadsheet belum tersedia. Data terakhir tetap ditampilkan.");
      if (catatSukses("board", j, `board:${j.tab}`)) { setBoard(j); setSyncedAt(new Date(j.at || Date.now())); }
      return !j.tertunda;
    } catch (e) {
      if (requestId !== permintaanBoard.current) return;
      if (e.expired) setExpired(true);
      else catatGagal("board", e);
      return false;
    } finally {
      if (requestId === permintaanBoard.current) setSyncing(false);
    }
  }, [bulanAktif, board.source, catatSukses, catatGagal]);

  // Sekali sesi habis, berhenti polling — kalau tidak, banner error akan
  // muncul berulang tiap 45 detik tanpa pernah bisa berhasil.
  // Master & data lintas bulan ditarik terpisah, hanya sekali di awal dan
  // setiap ada perubahan — supaya polling 45 detik tetap ringan.
  const refreshExtra = useCallback(async (segar = true, keys) => {
    const hasil = await Promise.allSettled([["master", setMaster], ["months", setAllMonths], ["teachers", setGuru], ["akun", setAkses]].filter(([key]) => !keys || keys.includes(key)).map(async ([key, setData]) => {
      try {
        const j = await pembaca.current(key, () => bacaApi(`/api/admin/${key}${segar ? "?segar=1" : ""}`), Boolean(segar));
        if (catatSukses(key, j)) setData(j);
        return !j.tertunda;
      } catch (e) { catatGagal(key, e); return false; }
    }));
    setExtraLoaded(true);
    return hasil.every((r) => r.status === "fulfilled" && r.value);
  }, [catatSukses, catatGagal]);

  useEffect(() => {
    if (!expired) refreshExtra(false);
  }, [refreshExtra, expired]);

  // Pengambilan guru & deadline per proyek untuk bulan yang sedang dibuka.
  const tabBoard = board.tab;
  const permintaanPengerjaan = useRef(0);
  const muatPengerjaan = useCallback(async (segar = false) => {
    const requestId = ++permintaanPengerjaan.current;
    if (!tabBoard) { setPengerjaan({ pengerjaan: [], canWrite: false, canKabari: false }); return; }
    try {
      const j = await pembaca.current(`pengerjaan:${tabBoard}`, () => bacaApi("/api/admin/pengerjaan?bulan=" + encodeURIComponent(tabBoard) + (segar === true ? "&segar=1" : "")), segar === true);
      if (requestId !== permintaanPengerjaan.current || bulanTerlihat.current !== tabBoard) return true;
      if (catatSukses("pengerjaan", j, `pengerjaan:${tabBoard}`)) setPengerjaan({ ...j, bulan: tabBoard });
      return !j.tertunda;
    } catch (e) {
      if (requestId !== permintaanPengerjaan.current || bulanTerlihat.current !== tabBoard) return true;
      catatGagal("pengerjaan", e);
      setPengerjaan((p) => p?.bulan === tabBoard && !p.error && e.status !== 403 ? p : { bulan: tabBoard, pengerjaan: [], aturan: {}, error: e.message });
      return false;
    }
  }, [tabBoard, catatSukses, catatGagal]);

  const muatReachout = useCallback(async (segar = true) => {
    try {
      const j = await pembaca.current("reachout", () => bacaApi(`/api/admin/reachout${segar ? "?segar=1" : ""}`), Boolean(segar));
      if (catatSukses("reachout", j)) setReachout(j);
      return !j.tertunda;
    } catch (e) {
      catatGagal("reachout", e);
      setReachout((r) => r && !r.error && e.status !== 403 ? r : { kontak: [], error: e.message });
      return false;
    }
  }, [catatSukses, catatGagal]);
  useEffect(() => {
    if (!expired) muatReachout(false);
  }, [muatReachout, expired]);

  useEffect(() => {
    aturPelaku(pengguna.nama);
  }, [pengguna.nama]);

  useEffect(() => {
    setPengerjaan((p) => p?.bulan === tabBoard ? p : null);
    setSyncInfo((s) => { const { pengerjaan: _, ...lain } = s; return lain; });
    if (!expired && operasional) muatPengerjaan();
  }, [muatPengerjaan, expired, operasional]);

  useEffect(() => {
    if (expired || !operasional) return;
    return jadwalkanSinkron(async () => {
      const gagalExtra = ["master", "months", "teachers", "akun"].filter((k) => syncInfoRef.current[k]?.error);
      // Reachout tidak ikut setiap sinkron — dibaca saat halaman yang memakainya dibuka.
      const hasil = await Promise.allSettled([refresh(false), muatPengerjaan(false), ...(gagalExtra.length ? [refreshExtra(false, gagalExtra)] : [])]);
      return hasil.every((r) => r.status === "fulfilled" && r.value !== false);
    }, { interval: POLL_MS });
  }, [refresh, muatPengerjaan, refreshExtra, expired, operasional]);

  // Halaman yang menampilkan kontak/tawaran membaca reachout saat dibuka (cache server 1 menit).
  useEffect(() => {
    if (!expired && (tab === "katalog" || (tab === "laporan" && ["reachout", "corong"].includes(laporanSub)))) muatReachout(false);
  }, [tab, laporanSub, expired, muatReachout]);

  // Tombol WA di mana pun (Cari guru, Tinjau, kirim akun, profil) mengumumkan
  // kontak barunya lewat event — lihat lib/kontakWa.js.
  useEffect(() => {
    const dengar = (e) => {
      const d = e.detail || {};
      if (d.jenis === "gagal" || d.jenis === "galat") setErr(d.pesan);
      setReachout((r) => {
        const kontak = r?.kontak || [];
        if (d.jenis === "tambah") return { ...r, kontak: [...kontak, d.kontak] };
        if (d.jenis === "tersimpan") return { ...r, kontak: kontak.map((k) => (k.kid === d.kid ? { ...k, sementara: false } : k)) };
        if (d.jenis === "gagal") return { ...r, kontak: kontak.filter((k) => k.kid !== d.kid) };
        if (d.jenis === "hasil") return { ...r, kontak: kontak.map((k) => (k.kid === d.kid ? { ...k, hasil: d.hasil, tHasil: d.tHasil } : k)) };
        return r;
      });
    };
    window.addEventListener(EVENT_REACHOUT, dengar);
    return () => window.removeEventListener(EVENT_REACHOUT, dengar);
  }, []);

  // Data sudah dibaca server saat halaman dibuka — itu sinkron pertama. Diset
  // setelah mount, bukan nilai awal state, supaya jam server & browser tidak
  // bentrok saat hidrasi.
  useEffect(() => { if (initial.source !== "error") setSyncedAt(new Date(initial.at || Date.now())); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ganti bulan -> muat ulang papan untuk bulan itu.
  const pertama = useRef(true);
  useEffect(() => {
    if (pertama.current) { pertama.current = false; return; }
    refresh();
  }, [bulanAktif]); // eslint-disable-line react-hooks/exhaustive-deps

  const segarkanSemua = useCallback(async () => {
    await Promise.allSettled([refresh(true), muatPengerjaan(true), muatReachout(true), refreshExtra(true)]);
  }, [refresh, muatPengerjaan, muatReachout, refreshExtra]);

  const run = useCallback(
    async (payload) => {
      setBusy(true);
      setErr("");
      try {
        // sertakan bulan aktif supaya tulisan mendarat di sheet yang dibuka,
        // bukan selalu di bulan terbaru
        await apiPost({ bulan: board.tab || bulanAktif, ...payload });
        await refresh();
        return true;
      } catch (e) {
        if (e.expired) setExpired(true);
        else setErr(e.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh, board.tab, bulanAktif]
  );

  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const teacherById = useMemo(() => new Map(teachers.map((t) => [String(t.idGuru), t])), [teachers]);
  const teacherByName = useMemo(() => {
    const m = new Map();
    teachers.forEach((t) => m.set(t.nama.toLowerCase(), t));
    return m;
  }, [teachers]);

  const platformOf = useCallback((a) => projById.get(a.idProject)?.platform || "", [projById]);

  // Cocokkan baris log ke data guru: ID Guru dulu (paling andal), lalu nama.
  const teacherOf = useCallback(
    (a) => {
      const byId = teacherById.get(String(a.idGuru));
      if (byId) return byId;
      const n = (a.guru || "").toLowerCase();
      if (!n) return null;
      return teacherByName.get(n) || teachers.find((t) => t.nama.toLowerCase().startsWith(n)) || null;
    },
    [teacherById, teacherByName, teachers]
  );

  const opts = useMemo(
    () => ({
      platform: uniq(projects.map((p) => p.platform)),
      guru: uniq(assignments.map((a) => a.guru)),
      subtes: uniq(assignments.map((a) => a.subtes)),
      status: uniq([...assignments.map((a) => a.status), ...STATUS_KNOWN]),
      pic: uniq([...assignments.map((a) => a.picSoal), ...assignments.map((a) => a.picVideo)]),
      // Untuk saran saat mengisi: PIC yang sama dipakai lintas bulan, jadi
      // ambil dari seluruh bulan — kalau hanya bulan berjalan, PIC yang belum
      // kebagian tugas bulan ini tidak akan pernah muncul sebagai pilihan.
      // (opts.pic tetap sebatas bulan berjalan supaya filter tidak menawarkan
      // nama yang pasti menghasilkan tabel kosong.)
      picSemua: uniq([
        ...assignments.map((a) => a.picSoal),
        ...assignments.map((a) => a.picVideo),
        ...(allMonths.log || []).map((a) => a.picSoal),
        ...(allMonths.log || []).map((a) => a.picVideo),
      ]),
    }),
    [projects, assignments, allMonths]
  );

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return assignments.filter((a) => {
      if (f.from && (!a.tanggal || a.tanggal < f.from)) return false;
      if (f.to && (!a.tanggal || a.tanggal > f.to)) return false;
      if (f.platform !== SEMUA && platformOf(a) !== f.platform) return false;
      if (f.guru !== SEMUA && a.guru !== f.guru) return false;
      if (f.subtes !== SEMUA && a.subtes !== f.subtes) return false;
      if (f.status !== SEMUA && (a.status || "") !== f.status) return false;
      if (f.pic !== SEMUA && a.picSoal !== f.pic && a.picVideo !== f.pic) return false;
      if (q && !`${a.idProject} ${a.guru} ${a.subtes} ${a.status} ${a.picSoal} ${a.picVideo}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [assignments, f, platformOf]);

  const filterAktif = JSON.stringify(f) !== JSON.stringify(F0);
  const statLog = useMemo(() => ringkasanLog(rows, projects, filterAktif), [rows, projects, filterAktif]);

  const stat = useMemo(() => {
    const kebutuhan = projects.reduce((a, p) => a + p.kebutuhan, 0);
    const sisa = projects.reduce((a, p) => a + p.sisa, 0);
    const diambil = kebutuhan - sisa;
    const anggaran = projects.reduce((a, p) => a + p.harga * p.kebutuhan, 0);
    const anggaranSisa = projects.reduce((a, p) => a + p.harga * Math.max(0, p.sisa), 0);
    const feeTotal = assignments.reduce((a, x) => a + x.fee, 0);
    const byStatus = {};
    assignments.forEach((a) => {
      const k = a.status || "(kosong)";
      byStatus[k] = byStatus[k] || { fee: 0, jumlah: 0, n: 0 };
      byStatus[k].fee += a.fee;
      byStatus[k].jumlah += a.jumlah;
      byStatus[k].n += 1;
    });
    const byGuru = {};
    assignments.forEach((a) => {
      if (a.guru) byGuru[a.guru] = (byGuru[a.guru] || 0) + a.fee;
    });
    const byPlat = {};
    projects.forEach((p) => {
      const k = p.platform || "Lainnya";
      byPlat[k] = byPlat[k] || { keb: 0, sisa: 0 };
      byPlat[k].keb += p.kebutuhan;
      byPlat[k].sisa += p.sisa;
    });
    return {
      kebutuhan,
      sisa,
      diambil,
      anggaran,
      anggaranSisa,
      feeTotal,
      byStatus,
      byGuru,
      byPlat,
      pct: kebutuhan ? Math.round((diambil / kebutuhan) * 100) : 0,
      // Hanya yang benar-benar mengerjakan: baris cadangan berisi 0 soal
      // (mis. kode "xx" untuk guru yang belum dapat proyek) dan baris Cancel
      // tidak dihitung — dulu keduanya ikut, sehingga 15 guru terbaca 36.
      guruAktif: new Set(assignments.filter((a) => a.jumlah > 0 && !isBatal(a.status)).map((a) => a.guru).filter(Boolean)).size,
      habis: projects.filter((p) => p.sisa <= 0).length,
      negatif: projects.filter((p) => p.sisa < 0).length,
    };
  }, [projects, assignments]);

  const groups = useMemo(() => {
    const m = new Map();
    rows.forEach((a) => {
      // Cancel tidak dibayar, dan baris cadangan tanpa pekerjaan (0 soal, Rp0 —
      // mis. kode "xx" untuk guru yang belum dapat proyek) bukan tagihan:
      // dulu keduanya ikut, jadi admin mencetak puluhan kwitansi Rp0.
      if (!a.guru || isBatal(a.status) || (!a.jumlah && !a.fee)) return;
      if (!m.has(a.guru)) m.set(a.guru, { guru: a.guru, teacher: teacherOf(a), items: [], total: 0, soal: 0 });
      const g = m.get(a.guru);
      g.items.push(a);
      g.total += a.fee;
      g.soal += a.jumlah;
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [rows, teacherOf]);

  const periode = f.from || f.to ? `${f.from ? tglID(f.from) : "awal"} — ${f.to ? tglID(f.to) : "kini"}` : "Semua periode";

  // Fee per guru dari SELURUH bulan (untuk halaman Database Guru).
  // Sheet Juni tidak punya kolom ID Guru, jadi baris tanpa ID dicocokkan lewat
  // nama: log memakai nama pendek ("Ariq") sedangkan master memakai nama
  // lengkap bergelar, karena itu dipakai pencocokan awalan.
  const feeSemuaBulan = useMemo(() => {
    const m = new Map();
    const daftar = guru.rows || [];
    const tambah = (k, v) => k && m.set(k, (m.get(k) || 0) + v);
    (allMonths.log || []).forEach((l) => {
      if (l.idGuru) return tambah(String(l.idGuru), l.fee);
      const n = (l.guru || "").toLowerCase();
      if (!n) return;
      const t =
        daftar.find((x) => x.nama.toLowerCase() === n) ||
        daftar.find((x) => x.nama.toLowerCase().startsWith(n));
      if (t) tambah(String(t.idGuru), l.fee);
    });
    return m;
  }, [allMonths, guru]);

  const doPrint = useCallback((gs, mode) => {
    if (!gs.length) return;
    setPrint({ groups: gs, mode });
    setTimeout(() => {
      window.print();
      setPrint(null);
    }, 60);
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  if (expired) return <SessionExpired />;

  const info = PAGE[tab] || {};
  const namaBulan = (board.months || []).find((m) => m.tab === board.tab)?.bulan || "";
  const months = board.months || [];
  const bulanTab = board.tab || bulanAktif || "";
  // pendaftar yang masih perlu ditindaklanjuti (menunggu, ditinjau, sampel, lolos sampel)
  // Penanda "ada yang perlu dikerjakan" hanya untuk tim yang berwenang:
  // pendaftar -> tim seleksi; ajuan perubahan data (rekening dll.) -> tim akademik.
  const pendaftarBaru = bolehP(pengguna, ["Seleksi"]) ? (akses?.pendaftar || []).filter((p) => DALAM_PROSES.has(p.status)).length : 0;
  const ajuanData = akademik ? (akses?.perubahan || []).length : 0;
  // Pindah halaman selalu mulai dari atas — di HP halaman sebelumnya
  // biasanya sudah tergulir jauh.
  const pilihTab = (k) => {
    // Kunci menu lama (sebelum v3.14.0) tetap mengarah ke tempat barunya.
    if (LAPORAN.some(([s]) => s === k)) {
      setLaporanSub(k);
      k = "laporan";
    }
    setTab(k === "ringkasan" ? "ambil" : k);
    setNavOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <div className="admin-shell">
        <SideNav
          tab={tab}
          setTab={pilihTab}
          counts={{
            log: assignments.length,
            katalog: projects.length,
            master: master.rows?.length || 0,
            guru: (guru.rows || []).length || teachers.length,
            // yang menunggu tindakan tim: pengajuan baru + pengumpulan yang belum direview
            ambil: (pengerjaan?.pengerjaan || []).filter((x) => x.status === ST_PJ.diajukan || x.status === ST_PJ.review || laporanBaru(x).length).length || null,
            pendaftar: pendaftarBaru || null,
            guruAjuan: ajuanData,
          }}
          open={navOpen}
          setOpen={setNavOpen}
          months={months}
          bulanTab={bulanTab}
          setBulan={setBulanAktif}
          kunciBulan={syncing || busy}
          syncedAt={syncedAt}
          syncing={syncing}
          refresh={segarkanSemua}
          pengguna={pengguna}
        />

        <div className="admin-col">
          {/* Layar sempit (HP/tablet): bilah atas + menu bawah menggantikan
              sidebar. Pemilih bulan pindah ke sini karena paling sering
              diganti, dan hanya tampil di halaman yang memang per bulan. */}
          <div className="mobile-bar">
            <Brand size={28} row versi={APP_VERSION} />
            {PERBULAN.has(tab) && months.length ? (
              <label className="mb-month">
                <span className="sr-only">Bulan yang dikelola</span>
                <select value={bulanTab} onChange={(e) => setBulanAktif(e.target.value)} disabled={syncing || busy}>
                  {months.map((m) => (
                    <option key={m.tab} value={m.tab}>
                      {m.bulan}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" />
              </label>
            ) : null}
          </div>

          <main className="admin-main">
            <div className="page-head">
              <div>
                <div className="page-crumb">
                  {info.crumb}
                  {PERBULAN.has(tab) && namaBulan ? ` · ${namaBulan}` : ""}
                </div>
                <h1 className="page-title">{info.judul}</h1>
              </div>
              <div className="head-actions">
                {clo ? <NotifikasiClo key={`${pengguna.email}:${board.tab}`} data={pengerjaan?.bulan === board.tab ? pengerjaan : null} bulan={board.tab} namaBulan={namaBulan} onPilih={(n) => { pilihTab("ambil"); setFokusNotifikasi({ ...n, token: {} }); }} /> : null}
                <div className="head-actions" ref={setAksiEl} />
              </div>
            </div>

            {peringatanPassword ? (
              <div className="banner sample">
                <Icon name="alert" />
                <div>
                  Area internal belum dilindungi password. Set <b>INTERNAL_PASSWORD</b> di Environment Variables.
                </div>
              </div>
            ) : null}
            <DataBanner source={source} />
            {Object.values(syncInfo).some((s) => s.error) ? <div className="banner sync-warning" role="status"><Icon name="alert" /><div><b>Sinkronisasi tertunda</b><p>Data terakhir yang berhasil dibaca tetap ditampilkan. Pembaruan akan dicoba kembali saat halaman aktif.</p><ul>{Object.entries(syncInfo).filter(([, s]) => s.error).map(([key, s]) => <li key={key}><b>{{ board: "Katalog & log", pengerjaan: "Pengambilan Guru", reachout: "Reachout", master: "Master subtes", months: "Laporan lintas bulan", teachers: "Database guru", akun: "Pendaftaran & akun" }[key]}</b>: {s.error}<small>{s.at ? `Terakhir berhasil ${new Date(s.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB` : "Belum ada data yang berhasil dibaca untuk bagian ini."}</small></li>)}</ul></div><button type="button" className="btn btn-ghost sm" onClick={segarkanSemua} disabled={syncing}><Icon name="refresh" />Coba lagi</button></div> : null}
            {kurangIzin ? (
              <div className="banner err">
                <Icon name="lock" />
                <div>
                  <b>Belum punya izin menulis ke spreadsheet.</b> Data terbaca, tapi setiap penyimpanan akan ditolak Google.
                  <div className="banner-detail">
                    Perbaiki sekali saja: buka spreadsheet di Google Sheets → <b>Bagikan</b> → tambahkan{" "}
                    <b>{serviceAccount || "service account"}</b> dengan akses <b>Editor</b> (sekarang masih Pembaca), lalu
                    segarkan halaman ini. Data yang sudah ada tidak terpengaruh.
                  </div>
                </div>
              </div>
            ) : readOnly && source === "live" ? (
              <div className="banner sample">
                <Icon name="lock" />
                <div>
                  Mode baca-saja — butuh GOOGLE_SERVICE_ACCOUNT_JSON dengan akses Editor agar bisa menyimpan.
                  {diag && !diag.ok ? (
                    <div className="banner-detail">
                      <b>Penyebab:</b> {diag.msg}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : source === "sample" && diag && !diag.ok ? (
              <div className="banner sample">
                <Icon name="info" />
                <div>
                  <b>Penyebab data contoh:</b> {diag.msg}
                </div>
              </div>
            ) : null}
            {err ? (
              <div className="banner err" role="alert">
                <Icon name="alert" />
                <div>{err}</div>
                <button type="button" className="btn-link" onClick={() => setErr("")}>
                  tutup
                </button>
              </div>
            ) : null}
            {/* Tab yang mirip sheet bulanan tapi tidak dipakai. Tanpa ini sebuah
                bulan bisa hilang dari pilihan tanpa penjelasan apa pun. */}
            {(board.tabDiabaikan || []).length ? (
              <div className="banner sample">
                <Icon name="info" />
                <div>
                  Ada tab yang tidak dibaca sebagai sheet bulanan:
                  <ul className="dup-list">
                    {board.tabDiabaikan.map((d) => (
                      <li key={d.tab}>
                        <b>{d.tab}</b> — {d.alasan}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {tab === "log" && <StatBulan stat={statLog} teachers={teachers} tersaring={filterAktif} />}

            {(tab === "log" || tab === "bayar") && (
              <Filters f={f} set={set} setF={setF} opts={opts} reset={() => setF(F0)} aktif={filterAktif} n={rows.length} stat={stat} total={assignments.length} />
            )}

            {tab === "log" && (
              <LogTable
                rows={rows}
                projects={projects}
                teachers={teachers}
                opts={opts}
                stat={stat}
                run={run}
                busy={busy}
                readOnly={readOnly}
                master={master.rows || []}
                aksiEl={aksiEl}
                namaBulan={namaBulan}
                aturan={pengerjaan?.aturan || {}}
                pengerjaan={pengerjaan?.pengerjaan || []}
                filterAktif={filterAktif}
              />
            )}
            {tab === "katalog" && (
              <KatalogTable
                projects={projects}
                run={run}
                busy={busy}
                readOnly={readOnly || !akademik}
                master={master.rows || []}
                aksiEl={aksiEl}
                namaBulan={namaBulan}
                setErr={setErr}
                onMasterChanged={refreshExtra}
                guruDb={guru.rows || []}
                log={assignments}
                riwayat={allMonths.log || []}
                akun={akses?.akun || []}
                wajibLogin={Boolean(akses?.wajibLogin)}
                bulan={board.tab}
                kontak={reachout?.kontak || []}
                penanda={akses?.penanda || {}}
                aturan={pengerjaan?.aturan || {}}
                dipesan={(pengerjaan?.pengerjaan || []).reduce((m, x) => (x.status === ST_PJ.diajukan ? { ...m, [x.idProyek]: (m[x.idProyek] || 0) + x.jumlah } : m), {})}
                onAturan={muatPengerjaan}
              />
            )}

            {tab === "laporan" && pemilikP ? (
              <div className="seg-tab laporan-tab" role="group" aria-label="Jenis laporan">
                {LAPORAN.map(([k, label, ikon]) => (
                  <button key={k} type="button" className={laporanSub === k ? "on" : ""} aria-pressed={laporanSub === k} onClick={() => setLaporanSub(k)}>
                    <Icon name={ikon} size={16} />
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {tab === "laporan" && pemilikP && laporanSub === "reachout" &&
              (extraLoaded ? (
                <PantauReachout
                  data={reachout}
                  projects={projects}
                  assignments={assignments}
                  bulan={board.tab}
                  namaBulan={namaBulan}
                  guruDb={guru.rows || []}
                  master={master.rows || []}
                  riwayat={allMonths.log || []}
                  akun={akses?.akun || []}
                  wajibLogin={Boolean(akses?.wajibLogin)}
                  namaSaya={pengguna.nama}
                  penanda={akses?.penanda || {}}
                  aksiEl={aksiEl}
                  muatUlang={muatReachout}
                />
              ) : (
                <div className="card empty">Memuat reachout…</div>
              ))}

            {tab === "tim" && pengguna.pemilik && <TimPanel aksiEl={aksiEl} setErr={setErr} emailSaya={pengguna.email} />}

            {tab === "demo" && MODE_DEMO && <DemoPanel />}

            {tab === "ambil" && (
              <PusatPengambilan
                data={pengerjaan}
                bulan={board.tab}
                namaBulan={namaBulan}
                projects={projects}
                guruDb={guru.rows || []}
                muatUlang={muatPengerjaan}
                setErr={setErr}
                aksiEl={aksiEl}
                onBerubah={refresh}
                pengguna={pengguna}
                master={master.rows || []}
                log={assignments}
                riwayat={allMonths.log || []}
                akun={akses?.akun || []}
                kontak={reachout?.kontak || []}
                penanda={akses?.penanda || {}}
                wajibLogin={Boolean(akses?.wajibLogin)}
                muatReachout={muatReachout}
                pilihTab={pilihTab}
                fokusNotifikasi={fokusNotifikasi?.bulan === board.tab ? fokusNotifikasi : null}
                onNotifikasiDibuka={() => setFokusNotifikasi(null)}
              />
            )}

            {tab === "laporan" && pemilikP && laporanSub === "corong" &&
              (extraLoaded ? (
                <CorongRekrutmen
                  akses={akses}
                  log={allMonths.log || []}
                  kontak={reachout?.kontak || []}
                  projects={projects}
                  bukaAkses={(f) => {
                    setFokusAkses(f);
                    pilihTab("akses");
                  }}
                />
              ) : (
                <div className="card empty">Memuat corong…</div>
              ))}

            {tab === "master" &&
              (extraLoaded ? (
                <MasterPanel
                  rows={master.rows || []}
                  readOnly={readOnly || !master.canWrite}
                  busy={busy}
                  setBusy={setBusy}
                  setErr={setErr}
                  onChanged={refreshExtra}
                  aksiEl={aksiEl}
                />
              ) : (
                <div className="card empty">Memuat master…</div>
              ))}

            {tab === "baru" &&
              (extraLoaded ? (
                <NewMonthPanel
                  master={master.rows || []}
                  months={allMonths.months || []}
                  semuaBulan={allMonths.semuaBulan || []}
                  readOnly={readOnly || !allMonths.canWrite}
                  busy={busy}
                  setBusy={setBusy}
                  setErr={setErr}
                  onDone={async () => {
                    await refreshExtra();
                    await refresh();
                  }}
                />
              ) : (
                <div className="card empty">Memuat data bulan…</div>
              ))}

            {tab === "laporan" && pemilikP && laporanSub === "analisis" &&
              (extraLoaded ? (
                <AnalyticsPanel data={allMonths} master={master.rows || []} />
              ) : (
                <div className="card empty">Memuat analisis…</div>
              ))}
            {tab === "bayar" && (
              <Bayar groups={groups} periode={periode} doPrint={doPrint} rows={rows} aksiEl={aksiEl} namaBulan={namaBulan} filterTanggal={Boolean(f.from || f.to)} setErr={setErr} />
            )}

            {tab === "akses" &&
              (extraLoaded ? (
                <AksesPanel
                  pemilik={pengguna.pemilik}
                  data={akses}
                  busy={busy}
                  setBusy={setBusy}
                  setErr={setErr}
                  onChanged={refreshExtra}
                  aksiEl={aksiEl}
                  keDatabaseGuru={() => pilihTab("guru")}
                  picList={opts.picSemua || []}
                  fokus={fokusAkses}
                  fokusDipakai={() => setFokusAkses(null)}
                />
              ) : (
                <div className="card empty">Memuat pendaftaran & akun…</div>
              ))}

            {tab === "guru" &&
              (extraLoaded ? (
                <GuruPanel
                  rows={guru.rows || []}
                  feeByGuru={feeSemuaBulan}
                  readOnly={readOnly || !guru.canWrite}
                  busy={busy}
                  setBusy={setBusy}
                  setErr={setErr}
                  onChanged={refreshExtra}
                  aksiEl={aksiEl}
                  perubahan={akademik ? akses?.perubahan || [] : []}
                />
              ) : (
                <div className="card empty">Memuat data guru…</div>
              ))}
          </main>
        </div>
      </div>

      <TabBar tab={tab} pilihTab={pilihTab} bukaMenu={() => setNavOpen(true)} menuTerbuka={navOpen} adaBaru={pendaftarBaru > 0 || ajuanData > 0} item={akademik ? TABBAR : TABBAR_CLO} />

      {print ? <PrintArea groups={print.groups} mode={print.mode} brand={brand} periode={periode} /> : null}
    </>
  );
}

/* ============================ NAVIGASI SAMPING ============================ */
// Menu disusun mengikuti urutan kerja sebenarnya: subtes didaftarkan di
// master dulu, baru dianggarkan jadi katalog bulan itu, baru dicatat siapa
// yang mengambil, baru dibayar. Nomor langkah terpisah dari judul supaya
// judul halaman tetap bersih.
const NAV = [
  {
    grup: "Alur kerja",
    item: [
      { k: "master", label: "Master subtes", judul: "Master Subtes", langkah: 1, hitung: "master", peran: ["Akademik"] },
      { k: "baru", label: "Proyek bulan baru", judul: "Proyek Bulan Baru", langkah: 2, peran: ["Akademik"] },
      { k: "katalog", label: "Katalog bulan ini", judul: "Katalog Bulan Ini", langkah: 3, hitung: "katalog", peran: ["Akademik", "Seleksi"] },
      { k: "ambil", label: "Pengambilan guru", judul: "Pengambilan Guru", langkah: 4, hitung: "ambil", peran: ["Akademik", "Seleksi"] },
      { k: "log", label: "Log pengambilan", judul: "Log Pengambilan", langkah: 5, hitung: "log", peran: ["Akademik"] },
      { k: "bayar", label: "Pembayaran & kwitansi", judul: "Pembayaran & Kwitansi", langkah: 6, peran: ["Akademik"] },
    ],
  },
  // Pantauan lama (analisis, reachout, corong) tidak dipakai tim RAD/CLO:
  // pekerjaannya ada di Pengambilan Guru. Disatukan di satu halaman Pemilik.
  {
    grup: "Laporan",
    item: [{ k: "laporan", label: "Laporan & analisis", judul: "Laporan & Analisis", ikon: "chart", peran: ["Pemilik"] }],
  },
  {
    grup: "Data pendukung",
    item: [
      // hitungan = pendaftar yang menunggu verifikasi (kosong bila tidak ada)
      { k: "akses", label: "Pendaftaran & akun", judul: "Pendaftaran & Akun Guru", ikon: "userCheck", hitung: "pendaftar", peran: ["Seleksi"] },
      { k: "guru", label: "Database guru", judul: "Database Guru", ikon: "users", hitung: "guru" },
      { k: "tim", label: "Akun tim", judul: "Akun Tim", ikon: "kunci", peran: ["Pemilik"] },
      // situs demo saja: skenario, akun contoh, tombol pulihkan data (semua anggota tim)
      ...(MODE_DEMO ? [{ k: "demo", label: "Data demo", judul: "Data Demo", ikon: "refresh" }] : []),
    ],
  },
];
const JUMLAH_LANGKAH = NAV[0].item.length;

// Judul & jejak halaman di atas konten.
const PAGE = {};
NAV.forEach((g) =>
  g.item.forEach((it) => {
    PAGE[it.k] = {
      judul: it.judul,
      crumb: it.k === "ambil" ? "Ruang kerja RAD & CLO" : it.langkah ? `Alur kerja · Langkah ${it.langkah} dari ${JUMLAH_LANGKAH}` : g.grup,
    };
  })
);

// Menu bawah di HP: halaman yang dipakai sehari-hari. Master & Proyek bulan
// baru (dikerjakan sebulan sekali, di laptop) ada di "Lainnya" bersama
// Pembayaran dan Database guru.
const TABBAR = [
  { k: "ambil", label: "Pengambilan", ikon: "home" },
  { k: "katalog", label: "Katalog", ikon: "layers" },
  { k: "baru", label: "Proyek", ikon: "plus" },
  { k: "log", label: "Log", ikon: "clipboard" },
];

// Menu harian CLO: Pengambilan (kabar, reminder, butuh guru), pendaftar, guru.
const TABBAR_CLO = [
  { k: "ambil", label: "Pengambilan", ikon: "home" },
  { k: "akses", label: "Pendaftar", ikon: "userCheck" },
  { k: "guru", label: "Guru", ikon: "users" },
  { k: "katalog", label: "Katalog", ikon: "layers" },
];

function TabBar({ tab, pilihTab, bukaMenu, menuTerbuka, adaBaru, item = TABBAR }) {
  const lainnya = !item.some((t) => t.k === tab);
  return (
    <nav className="tabbar" aria-label="Menu utama">
      {item.map((t) => (
        <button
          key={t.k}
          type="button"
          className={"tb-item" + (tab === t.k && !menuTerbuka ? " active" : "")}
          aria-current={tab === t.k ? "page" : undefined}
          onClick={() => pilihTab(t.k)}
        >
          <Icon name={t.ikon} size={22} />
          <span>{t.label}</span>
        </button>
      ))}
      <button type="button" className={"tb-item" + (lainnya || menuTerbuka ? " active" : "")} onClick={bukaMenu} aria-expanded={menuTerbuka}>
        <Icon name="menu" size={22} />
        {adaBaru ? <i className="tb-dot" aria-label="ada pendaftar baru" /> : null}
        <span>Lainnya</span>
      </button>
    </nav>
  );
}

const inisial = (n) =>
  String(n || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
const labelTim = (pg) =>
  pg.pemilik ? "Divisi Produk" : bolehTim(pg, ["Seleksi"]) && bolehTim(pg, ["Akademik"]) ? "Tim RAD & CLO" : bolehTim(pg, ["Seleksi"]) ? "Tim CLO" : "Tim RAD";

function SideNav({ tab, setTab, counts, open, setOpen, months, bulanTab, setBulan, kunciBulan, syncedAt, syncing, refresh, pengguna = PENGGUNA_BAWAAN }) {
  const grup = NAV.map((g) => ({ ...g, item: g.item.filter((it) => bolehP(pengguna, it.peran)) })).filter((g) => g.item.length);
  const adaPerBulan = grup.some((g) => g.item.some((it) => PERBULAN.has(it.k)));
  return (
    <>
      {open ? <div className="nav-scrim" onClick={() => setOpen(false)} /> : null}
      <nav className={"admin-side" + (open ? " open" : "")} aria-label="Menu admin">
        <div className="side-scroll">
          <div className="side-brand">
            <Brand size={34} versi={APP_VERSION} sub={labelTim(pengguna)} />
            <button type="button" className="icon-x side-close" onClick={() => setOpen(false)} aria-label="Tutup menu">
              <Icon name="x" />
            </button>
          </div>

          {months.length && adaPerBulan ? (
            <div className="side-month">
              <label>
                <Icon name="calendar" />
                <span className="sr-only">Bulan yang dikelola</span>
                <select value={bulanTab} onChange={(e) => setBulan(e.target.value)} disabled={kunciBulan}>
                  {months.map((m) => (
                    <option key={m.tab} value={m.tab}>
                      {m.bulan}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" />
              </label>
              <small>Bulan untuk katalog, log &amp; pembayaran</small>
            </div>
          ) : null}

          {grup.map((g) => (
            <div className="side-group" key={g.grup}>
              <div className="side-label">{g.grup}</div>
              {g.item.map((it) => (
                <button
                  key={it.k}
                  type="button"
                  className={"side-item" + (tab === it.k ? " active" : "")}
                  aria-current={tab === it.k ? "page" : undefined}
                  onClick={() => setTab(it.k)}
                >
                  {it.langkah ? <span className="si-step">{it.langkah}</span> : <Icon name={it.ikon} size={18} />}
                  <span className="si-label">{it.label}</span>
                  {it.k === "guru" && counts.guruAjuan ? (
                    <span className="si-count baru" title="ajuan perubahan data menunggu persetujuan">
                      {numberID(counts.guruAjuan)}
                    </span>
                  ) : it.hitung && counts[it.hitung] != null ? (
                    <span className={"si-count" + (it.hitung === "pendaftar" ? " baru" : "")}>{numberID(counts[it.hitung])}</span>
                  ) : null}
                </button>
              ))}
              {g.grup === "Data pendukung" ? (
                <>
                  <a className="side-item" href="/open" target="_blank" rel="noopener noreferrer">
                    <Icon name="external" size={18} />
                    <span className="si-label">Halaman guru</span>
                  </a>
                  <PasangApp className="side-item" labelClass="si-label" iconSize={18} nama="dashboard admin" />
                </>
              ) : null}
            </div>
          ))}
        </div>

        <div className="side-foot">
          <span className="avatar" aria-hidden="true">{inisial(pengguna.nama)}</span>
          <div className="who">
            <b title={pengguna.email || "masuk dengan password internal"}>{pengguna.nama}</b>
            <span>
              {pengguna.akunTim ? (
                <a href="/admin/ganti-password" className="who-link" title="Ganti password">
                  Ganti sandi
                </a>
              ) : syncing ? (
                "Menyinkronkan…"
              ) : syncedAt ? (
                `Sinkron ${syncedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
              ) : (
                "Tersambung"
              )}
            </span>
          </div>
          {bolehP(pengguna, ["Akademik"]) ? (
            <button type="button" className="ibtn" onClick={refresh} disabled={syncing} aria-label="Segarkan data" title="Segarkan data">
              <Icon name="refresh" />
            </button>
          ) : null}
          <ThemeToggle />
          {/* Logout lewat form POST, bukan <Link>: Next.js mem-prefetch <Link>
              di production begitu terlihat, dan user jadi ter-logout sendiri. */}
          <form method="POST" action="/api/logout">
            <button type="submit" className="ibtn" aria-label="Keluar" title="Keluar">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}

/* ========================= SESI BERAKHIR ================================== */
function SessionExpired() {
  return (
    <div className="card expired">
      <span className="expired-ico">
        <Icon name="lock" size={24} />
      </span>
      <h2>Sesi kamu sudah berakhir</h2>
      <p>
        Ini terjadi kalau password internal baru saja diganti, atau sesi sudah lewat 12 jam. Datanya aman — cukup login
        ulang untuk melanjutkan.
      </p>
      <a className="btn btn-blue" href={LOGIN_URL}>
        Login ulang
      </a>
    </div>
  );
}

/* ====================== ANGKA BULAN BERJALAN (log) ======================== */
function StatBulan({ stat, teachers, tersaring }) {
  return (
    <section className="log-summary" aria-label="Ringkasan log pengambilan">
    <p className="log-summary-scope">{tersaring ? `Ringkasan hasil filter · ${numberID(stat.baris)} baris tampil` : "Ringkasan seluruh log bulan ini"}</p>
    <div className="grid stat-grid">
      <div className="card stat">
        <span className="label">{tersaring ? "Fee hasil filter" : "Fee bulan ini"}</span>
        <span className="value">{rupiah(stat.feeTotal)}</span>
        <span className="sub">{tersaring ? "Baris tampil" : "Seluruh log"} · Cancel tidak dihitung</span>
      </div>
      <div className="card stat">
        <span className="label">Soal diambil</span>
        <span className="value">
          {numberID(stat.diambil)} <small>/ {numberID(stat.kebutuhan)}</small>
        </span>
        <div className="meter" aria-label={`${stat.pct}% terserap`}>
          <i style={{ width: Math.max(0, Math.min(100, stat.pct)) + "%" }} />
        </div>
        <span className="sub">{tersaring ? "Soal tampil / target proyek terkait" : "Soal log / target katalog"} · tanpa Cancel</span>
      </div>
      <div className="card stat">
        <span className="label">{tersaring ? "Sisa kuota proyek terkait" : "Sisa kuota"}</span>
        <span className="value">{numberID(stat.sisa)} soal</span>
        <span className="sub">
          {numberID(stat.habis)} dari {numberID(stat.proyek)} proyek sudah habis · kuota aktual katalog
        </span>
      </div>
      <div className="card stat">
        <span className="label">Guru aktif</span>
        <span className="value">{numberID(stat.guruAktif)}</span>
        <span className="sub">{tersaring ? "Pada hasil filter · punya soal aktif" : teachers.length ? `dari ${numberID(teachers.length)} guru terdaftar` : "Punya soal aktif di log"}</span>
      </div>
    </div>
    </section>
  );
}

/* =============================== FILTER =================================== */
// Status dipajang sebagai chip (paling sering dipakai: "mana yang perlu
// revisi?"), filter lain disimpan di "Filter lanjutan" supaya tidak memenuhi
// layar — tapi otomatis terbuka bila ada yang sedang aktif, supaya tabel yang
// tersaring tidak pernah terlihat "hilang" tanpa alasan.
function Filters({ f, set, setF, opts, reset, aktif, n, stat, total }) {
  const [lanjut, setLanjut] = useState(false);
  const nLanjut = [f.from, f.to].filter(Boolean).length + ["platform", "guru", "pic", "subtes"].filter((k) => f[k] !== SEMUA).length;
  const buka = lanjut || nLanjut > 0;
  const statusAda = opts.status.filter((s) => stat.byStatus[s]?.n);
  const kosong = stat.byStatus["(kosong)"]?.n || 0;

  const sel = (k, list, label) => (
    <label className="fl">
      <span>{label}</span>
      <select className="select" value={f[k]} onChange={set(k)}>
        <option>{SEMUA}</option>
        {list.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="filters" style={{ alignItems: "center" }}>
        <label className="search sm" style={{ flex: 1, minWidth: 220 }}>
          <Icon name="search" />
          <input type="search" placeholder="Cari kode, guru, subtes, status, PIC" aria-label="Cari" value={f.q} onChange={set("q")} />
        </label>
        <button type="button" className={"btn sm " + (buka ? "btn-blue" : "btn-ghost")} onClick={() => setLanjut((v) => !v)} aria-expanded={buka}>
          <Icon name="filter" />
          Filter lanjutan{nLanjut ? ` · ${nLanjut}` : ""}
        </button>
        <span className="muted">{numberID(n)} baris</span>
        {aktif ? (
          <button type="button" className="btn-link" onClick={reset}>
            Hapus semua filter
          </button>
        ) : null}
      </div>

      <div className="chips geser" role="group" aria-label="Saring status">
        <button type="button" className={"chip" + (f.status === SEMUA ? " active" : "")} aria-pressed={f.status === SEMUA} onClick={() => setF((p) => ({ ...p, status: SEMUA }))}>
          Semua <span className="n">{numberID(total)}</span>
        </button>
        {statusAda.map((s) => (
          <button key={s} type="button" className={"chip" + (f.status === s ? " active" : "")} aria-pressed={f.status === s} onClick={() => setF((p) => ({ ...p, status: s }))}>
            {s} <span className="n">{numberID(stat.byStatus[s].n)}</span>
          </button>
        ))}
        {kosong ? <span className="muted">· {numberID(kosong)} baris tanpa status</span> : null}
      </div>

      {buka ? (
        <div className="filters">
          <label className="fl">
            <span>Tanggal dari</span>
            <input className="input" type="date" value={f.from} onChange={set("from")} />
          </label>
          <label className="fl">
            <span>sampai</span>
            <input className="input" type="date" value={f.to} onChange={set("to")} />
          </label>
          {sel("platform", opts.platform, "Platform")}
          {sel("guru", opts.guru, "Guru")}
          {sel("pic", opts.pic, "PIC QC")}
          {sel("subtes", opts.subtes, "Subtes")}
        </div>
      ) : null}
    </div>
  );
}

/* ====================== PANEL SAMPING TAMBAH/EDIT ========================= */
function FormDrawer({ title, sub, children, onCancel, onSave, busy, saveLabel = "Simpan", bisaSimpan = true, ringkasan, wide }) {
  return (
    <Drawer
      wide={wide}
      title={title}
      sub={sub}
      onClose={onCancel}
      busy={busy}
      foot={
        <>
          {ringkasan}
          <div className="drawer-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              Batal
            </button>
            <button type="button" className="btn btn-blue" onClick={onSave} disabled={busy || !bisaSimpan}>
              {busy ? "Menyimpan…" : saveLabel}
            </button>
          </div>
        </>
      }
    >
      {children}
    </Drawer>
  );
}

// Dengan `htmlFor` label berdiri sendiri — wajib untuk kotak pencarian, yang
// berisi beberapa tombol (token) dan tidak boleh dibungkus <label>.
const Field = ({ label, children, hint, wide, htmlFor, err }) =>
  htmlFor ? (
    <div className={"ffield" + (wide ? " wide" : "")}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <small className={err ? "cbx-hint err" : "cbx-hint"}>{hint}</small> : null}
    </div>
  ) : (
    <label className={"ffield" + (wide ? " wide" : "")}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );

function AssignmentModal({ mode, draft, onDraft, projects, teachers, opts, onSave, onCancel, busy, master, namaBulan }) {
  const proj = projects.find((p) => p.id === draft.idProject);
  const picList = opts.picSemua || opts.pic || [];
  const bulan = /^(\d{4})-(\d{2})/.exec(draft.tanggal || "");

  // Dua tarif diambil dari master: batas ATAS = normal, batas BAWAH = terlambat.
  const m = master.find((x) => x.id === proj?.idSubtes);
  const rentang = parseHarga(hargaRawMaster(m, proj?.output));
  const tarifNormal = proj?.harga || rentang.max || 0;
  const tarifTelat = rentang.tentatif ? rentang.min : 0;
  const adaTarifTelat = tarifTelat > 0 && tarifTelat !== tarifNormal;

  // Kolom Tarif kosong = pakai harga katalog (normal).
  const mode2 = parseNum(draft.tarif) > 0 ? "telat" : "normal";
  const tarifDipakai = mode2 === "telat" ? parseNum(draft.tarif) : tarifNormal;
  // Sama dengan rumus sheet: pekerjaan batal tidak dibayar.
  const batal = isBatal(draft.status);
  const jml = parseInt(draft.jumlah, 10) || 0;
  const fee = batal ? 0 : tarifDipakai * jml;

  const pilihTarif = (v) => {
    if (v === "normal") {
      onDraft("tarif", "");
      onDraft("ketTarif", "");
    } else {
      onDraft("tarif", String(tarifTelat));
      onDraft("ketTarif", "Terlambat");
    }
  };

  const opsiProyek = useMemo(
    () =>
      projects.map((p) => ({
        value: p.id,
        code: p.id,
        label: p.subtes,
        meta: `${p.output || "—"} · ${rupiah(p.harga)}/soal`,
        side: p.sisa > 0 ? `sisa ${numberID(p.sisa)}` : "habis",
        sideOff: p.sisa <= 0,
        search: `${p.id} ${p.subtes} ${p.output} ${p.platform}`,
      })),
    [projects]
  );
  // Merah HANYA bila ketikan tidak cocok dengan proyek mana pun. Selama daftar
  // saran masih menemukan sesuatu, admin sedang mencari — bukan salah isi.
  // (Peringatan yang muncul saat orang masih mengetik membuat peringatan lain
  // ikut diabaikan.) Kode yatim seperti P08-29 tetap tertangkap.
  const ketik = norm(draft.idProject).toLowerCase().split(/\s+/).filter(Boolean);
  const adaCocok = opsiProyek.some((o) => ketik.every((w) => o.search.toLowerCase().includes(w)));
  const kodeAsing = ketik.length > 0 && !proj && !adaCocok;
  const opsiGuru = useMemo(
    () => teachers.map((t) => ({ value: t.nama, label: t.nama, meta: t.idGuru ? `ID ${t.idGuru}` : "", search: `${t.nama} ${t.idGuru}` })),
    [teachers]
  );
  const opsiPic = useMemo(() => picList.map((p) => ({ value: p, label: p })), [picList]);

  return (
    <FormDrawer
      title={mode === "create" ? "Tambah log pengambilan" : "Edit log pengambilan"}
      sub={`${namaBulan ? namaBulan + " · " : ""}tersimpan langsung ke spreadsheet`}
      onCancel={onCancel}
      onSave={onSave}
      busy={busy}
      saveLabel={mode === "create" ? "Simpan log" : "Simpan perubahan"}
      ringkasan={
        <div className={"fee-box" + (batal ? " batal" : "")}>
          <span>
            {batal
              ? "Status Cancel — tidak dibayar, kuota kembali"
              : `${numberID(jml)} soal × ${rupiah(tarifDipakai)}${mode2 === "telat" ? " (terlambat)" : ""}`}
          </span>
          <b>{rupiah(batal ? tarifDipakai * jml : fee)}</b>
        </div>
      }
    >
      <Field
        label="Proyek"
        htmlFor="log-proyek"
        err={kodeAsing}
        hint={
          proj
            ? `${proj.subtes} · ${proj.output || "—"} · ${rupiah(proj.harga)}/soal · sisa ${numberID(proj.sisa)}`
            : kodeAsing
            ? "Tidak ada proyek dengan kode/nama ini di katalog bulan ini — Fee tidak akan terhitung sampai proyeknya dibuat."
            : norm(draft.idProject)
            ? "Pilih salah satu dari daftar."
            : "Ketik kode atau nama subtes; daftar menyaring sendiri."
        }
      >
        <Combobox
          id="log-proyek"
          icon="search"
          value={draft.idProject}
          onChange={(v) => onDraft("idProject", v)}
          options={opsiProyek}
          invalid={kodeAsing}
          placeholder="mis. P09-04 atau matematika"
        />
      </Field>

      <div className="form-grid">
        <Field label="Guru" htmlFor="log-guru" hint={draft.idGuru ? `ID guru ${draft.idGuru}` : "Pilih dari daftar agar ID guru terisi otomatis."}>
          <Combobox id="log-guru" value={draft.guru} onChange={(v) => onDraft("guru", v)} options={opsiGuru} placeholder="Nama guru" />
        </Field>
        <Field label="Tanggal" hint={bulan ? `Bulan tercatat ${bulan[1]}-${bulan[2]}` : null}>
          <input className="input" type="date" value={draft.tanggal} onChange={(e) => onDraft("tanggal", e.target.value)} />
        </Field>
      </div>

      <div className="ffield">
        <span>Tarif per soal</span>
        {adaTarifTelat ? (
          <div className="seg" role="radiogroup" aria-label="Tarif per soal">
            <button type="button" role="radio" aria-checked={mode2 === "normal"} className={"seg-btn" + (mode2 === "normal" ? " on" : "")} onClick={() => pilihTarif("normal")}>
              <b>Normal</b>
              <small>{rupiah(tarifNormal)}</small>
            </button>
            <button type="button" role="radio" aria-checked={mode2 === "telat"} className={"seg-btn" + (mode2 === "telat" ? " on" : "")} onClick={() => pilihTarif("telat")}>
              <b>Terlambat</b>
              <small>{rupiah(tarifTelat)}</small>
            </button>
          </div>
        ) : (
          // Tanpa dua tarif di master (atau proyeknya sudah dihapus), pilihan
          // tidak berguna — beri isian angka supaya Fee tetap bisa dibetulkan.
          <input
            className="input"
            inputMode="numeric"
            aria-label="Tarif khusus per soal"
            value={draft.tarif || ""}
            onChange={(e) => {
              onDraft("tarif", e.target.value);
              onDraft("ketTarif", e.target.value ? draft.ketTarif || "Tarif khusus" : "");
            }}
            placeholder={proj ? `kosong = pakai ${rupiah(tarifNormal)}` : kodeAsing ? "mis. 5000" : "pilih proyek dulu"}
            disabled={!proj && !kodeAsing}
          />
        )}
        <small>
          {adaTarifTelat
            ? "Guru yang lewat deadline dibayar dengan tarif terlambat."
            : proj
            ? "Master belum punya tarif terlambat untuk subtes ini. Isi angka bila tarifnya berbeda, atau kosongkan untuk memakai harga proyek."
            : kodeAsing
            ? "Harga normal tidak terbaca karena proyeknya tidak ada di katalog — isi tarif manual agar Fee tetap terhitung."
            : "Tarif mengikuti harga proyek yang dipilih."}
        </small>
      </div>

      <div className="form-grid">
        <Field label="Jumlah soal">
          <input className="input" type="number" inputMode="numeric" min={0} value={draft.jumlah} onChange={(e) => onDraft("jumlah", e.target.value)} />
        </Field>
        <Field label="Status">
          <select className="select" value={draft.status} onChange={(e) => onDraft("status", e.target.value)}>
            <option value="">—</option>
            {opts.status.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {/* Nama PIC baru boleh langsung diketik tanpa harus didaftarkan dulu. */}
        <Field label="PIC QC soal" htmlFor="log-pic1">
          <Combobox id="log-pic1" value={draft.picSoal} onChange={(v) => onDraft("picSoal", v)} options={opsiPic} placeholder="mis. Uma" />
        </Field>
        <Field label="PIC QC video" htmlFor="log-pic2">
          <Combobox id="log-pic2" value={draft.picVideo} onChange={(v) => onDraft("picVideo", v)} options={opsiPic} placeholder="opsional" />
        </Field>
      </div>

      <details className="card card-p" style={{ padding: "10px 14px" }}>
        <summary className="muted" style={{ cursor: "pointer", fontWeight: 700 }}>Isian lanjutan</summary>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label="ID guru" hint="Terisi otomatis saat guru dipilih dari daftar.">
            <input className="input" value={draft.idGuru} onChange={(e) => onDraft("idGuru", e.target.value)} />
          </Field>
          <Field label="Subtes" hint="Terisi otomatis dari proyek.">
            <input className="input" value={draft.subtes} onChange={(e) => onDraft("subtes", e.target.value)} />
          </Field>
        </div>
      </details>
    </FormDrawer>
  );
}

const OUTPUTS = ["Lengkap", "Video Pembahasan", "Soal & Pembahasan", "Liveclass"];
const hargaRawMaster = (m, output) =>
  ({ "Lengkap": m?.hargaLengkap, "Video Pembahasan": m?.hargaVideo, "Soal & Pembahasan": m?.hargaSoal, "Liveclass": m?.hargaLive }[output]) || "";
// Harga di master bisa rentang tentatif -> form diisi batas BAWAH, rentangnya
// ditampilkan sebagai petunjuk supaya admin sadar harganya belum pasti.
const hargaMaster = (m, output) => {
  const h = parseHarga(hargaRawMaster(m, output));
  return h.ada ? h.min : "";
};

// Sama seperti di "Proyek Bulan Baru": subtes selalu dipilih dari Master_Project
// supaya tautan ID Subtes terisi dan harga/platform ikut terbawa.
function ProjectModal({ mode, draft, onDraft, onPilih, onSave, onCancel, busy, master, namaBulan }) {
  const terpilih = master.find((m) => m.id === draft.idSubtes);
  const cekHarga = cekHargaBulanan(draft.harga);
  const rentangMaster = parseHarga(hargaRawMaster(terpilih, draft.output));
  const total = (cekHarga.ok ? cekHarga.nilai : 0) * (parseInt(draft.kebutuhan, 10) || 0);
  const petunjukHarga =
    !cekHarga.ok && !cekHarga.kosong
      ? cekHarga.pesan
      : rentangMaster.tentatif
      ? `Master punya dua tarif: ${formatHarga(hargaRawMaster(terpilih, draft.output))} — pilih satu angka untuk bulan ini`
      : rentangMaster.ada
      ? "Terisi dari master, boleh diubah untuk bulan ini"
      : "Master belum punya harga untuk output ini — isi manual";
  const bolehSimpan = cekHarga.ok && Boolean(draft.idSubtes);

  return (
    <FormDrawer
      title={mode === "create" ? "Tambah proyek ke katalog" : "Edit proyek katalog"}
      sub={`${namaBulan ? namaBulan + " · " : ""}subtes diambil dari master`}
      onCancel={onCancel}
      onSave={onSave}
      busy={busy}
      bisaSimpan={bolehSimpan}
      wide={!draft.idSubtes}
      saveLabel={mode === "create" ? "Tambah proyek" : "Simpan perubahan"}
      ringkasan={
        draft.idSubtes ? (
          <div className="fee-box">
            <span>
              Anggaran · kode {draft.id || "otomatis"} · sisa dihitung sheet
            </span>
            <b>{rupiah(total)}</b>
          </div>
        ) : null
      }
    >
      {!draft.idSubtes ? (
        <div className="ffield">
          <span>Pilih subtes dari master</span>
          {/* Slicer Jenis/Kategori/Platform + daftar yang selalu tampil: admin
              tidak perlu menebak kata kunci untuk menemukan subtes. */}
          <MasterPicker master={master} onPick={onPilih} autoFocus />
        </div>
      ) : (
        <>
          <div className="picked">
            <div>
              <b>{terpilih?.subtes || draft.subtes}</b>
              <div className="muted xs2">
                <span className="mono">{draft.idSubtes}</span>
                {terpilih?.jenis ? " · " + terpilih.jenis : ""}
                {terpilih?.kategori ? " · " + terpilih.kategori : ""}
              </div>
              {mode === "create" && terpilih?.status === "Arsip" ? (
                <div className="xs2 warn-text">Subtes ini diarsipkan — akan diaktifkan kembali di master saat disimpan.</div>
              ) : null}
            </div>
            {mode === "create" ? (
              <button type="button" className="btn btn-ghost xs" onClick={() => onPilih(null)}>
                Ganti
              </button>
            ) : null}
          </div>

          <div className="form-grid">
            <Field label="Platform">
              <input className="input" value={draft.platform} onChange={(e) => onDraft("platform", e.target.value)} />
            </Field>
            <Field label="Output">
              <select className="select" value={draft.output} onChange={(e) => onDraft("output", e.target.value)}>
                <option value="">— pilih —</option>
                {OUTPUTS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Harga per soal" hint={petunjukHarga}>
              {/* type="text", bukan number: kalau admin mengetik rentang di
                  input number, browser mengembalikan "" dan nilainya hilang
                  diam-diam. Dengan teks, kita bisa memberi tahu masalahnya. */}
              <input
                className={"input" + (cekHarga.ok || cekHarga.kosong ? "" : " input-err")}
                value={draft.harga}
                onChange={(e) => onDraft("harga", e.target.value)}
                placeholder="mis. 7000"
                inputMode="numeric"
              />
              {rentangMaster.tentatif ? (
                <span className="quickpick">
                  <span className="muted xs2">Pakai cepat:</span>
                  <button type="button" className="btn btn-ghost xs" onClick={() => onDraft("harga", String(rentangMaster.min))}>
                    {rupiah(rentangMaster.min)}
                  </button>
                  <button type="button" className="btn btn-ghost xs" onClick={() => onDraft("harga", String(rentangMaster.max))}>
                    {rupiah(rentangMaster.max)}
                  </button>
                </span>
              ) : null}
            </Field>
            <Field label="Kebutuhan (jumlah soal)">
              <input className="input" type="number" inputMode="numeric" min={0} value={draft.kebutuhan} onChange={(e) => onDraft("kebutuhan", e.target.value)} />
            </Field>
          </div>
        </>
      )}
    </FormDrawer>
  );
}

/* ========================= LOG PENGAMBILAN =============================== */
const BLANK_A = { tanggal: "", idProject: "", guru: "", idGuru: "", subtes: "", jumlah: "", status: "", picSoal: "", picVideo: "", tarif: "", ketTarif: "" };

function LogTable({ rows, projects, teachers, opts, stat, run, busy, readOnly, master, aksiEl, namaBulan, aturan = {}, pengerjaan = [], filterAktif = false }) {
  // Laporan Excel per guru (yang diambil, paket, soal, total) dari baris yang sedang tampil.
  const [buatLaporan, setBuatLaporan] = useState(false);
  const unduhLaporanExcel = async () => {
    setBuatLaporan(true);
    try {
      const grup = susunLaporan(rows, { projects, aturan, pengerjaan });
      const th = (() => {
        const c = {};
        rows.forEach((r) => /^\d{4}/.test(r.tanggal || "") && (c[r.tanggal.slice(0, 4)] = (c[r.tanggal.slice(0, 4)] || 0) + 1));
        return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || String(new Date().getFullYear());
      })();
      const sebagian = filterAktif ? " (sesuai saringan)" : "";
      await unduhLaporan(grup, {
        judul: `LAPORAN PENGAMBILAN FREELANCE ${String(namaBulan || "").toUpperCase()} ${th}${sebagian.toUpperCase()}`,
        namaTab: `Pengambilan ${namaBulan || ""}`.trim(),
        namaFile: `Laporan Pengambilan Freelance ${namaBulan || ""} ${th}${sebagian}.xlsx`,
      });
    } catch (e) {
      window.alert("Laporan gagal dibuat: " + e.message);
    } finally {
      setBuatLaporan(false);
    }
  };
  const [edit, setEdit] = useState(null); // { mode, row }
  const [draft, setDraft] = useState(BLANK_A);
  const [confirm, setConfirm] = useState(null);
  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const onDraft = (k, v) =>
    setDraft((d) => {
      const nd = { ...d, [k]: v };
      if (k === "idProject") {
        const p = projects.find((x) => x.id === v);
        if (p) nd.subtes = p.subtes;
      }
      if (k === "guru") {
        const t = teachers.find((x) => x.nama === v);
        if (t) nd.idGuru = t.idGuru;
      }
      return nd;
    });

  const save = async () => {
    const ok = await run(
      edit.mode === "create"
        ? { table: "assignments", action: "create", data: draft }
        : { table: "assignments", action: "update", row: edit.row, data: draft }
    );
    if (ok) setEdit(null);
  };

  const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  return (
    <>
      <PageActions el={aksiEl}>
        <span className="muted">
          Fee tampil <b>{rupiah(rows.filter((x) => !isBatal(x.status)).reduce((a, x) => a + x.fee, 0))}</b>
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={buatLaporan || !rows.length}
          onClick={unduhLaporanExcel}
          title="Unduh Excel per guru: yang diambil, jumlah paket, soal per paket, total soal, total semua (dari baris yang sedang tampil, tanpa baris Cancel)"
        >
          <Icon name="download" />
          {buatLaporan ? "Menyusun…" : "Laporan Excel"}
        </button>
        <button
          type="button"
          className="btn btn-blue fab"
          disabled={readOnly || busy}
          onClick={() => {
            setDraft({ ...BLANK_A, tanggal: hariIni() });
            setEdit({ mode: "create" });
          }}
        >
          <Icon name="plus" stroke={2.2} />
          Tambah log
        </button>
      </PageActions>

      <div className="table-wrap fixed">
        <table className="grid-table t-log">
          <Cols widths={[10, 10, 14, 25, 6, 11, 12, 7, 5]} />
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Proyek</th>
              <th>Guru</th>
              <th>Subtes</th>
              <th className="num">Jml</th>
              <th className="num">Fee</th>
              <th>Status</th>
              <th>PIC</th>
              <th className="act">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  Tidak ada baris yang cocok dengan filter.
                </td>
              </tr>
            ) : null}
            {rows.map((a) => {
              const p = projById.get(a.idProject);
              return (
                <tr key={a.row} className={isBatal(a.status) ? "row-dim" : ""}>
                  <td className="c-tgl" data-l="Tanggal">{tglID(a.tanggal) || "—"}</td>
                  <td className="c-proyek" data-l="Proyek">
                    <span className="code">
                      <b>{a.idProject || "—"}</b>
                      {p?.idSubtes ? <span>{p.idSubtes}</span> : null}
                    </span>
                    {/* Kode yang tidak ada di katalog -> Fee tidak bisa dihitung.
                        Biasanya karena baris katalognya dihapus belakangan. */}
                    {a.idProject && !p ? (
                      <div className="neg xs2" title="Baris katalog dengan kode ini sudah tidak ada, jadi Fee-nya tidak bisa dihitung">
                        proyek tak ditemukan
                      </div>
                    ) : null}
                  </td>
                  <td className="c-guru">
                    <b style={{ fontWeight: 600 }}>{a.guru || "—"}</b>
                    {a.idGuru ? <div className="muted xs2">ID {a.idGuru}</div> : null}
                  </td>
                  <td className="wrap c-subtes">
                    {a.subtes || "—"}
                    {p?.output ? <div className="muted xs2">{p.output}</div> : null}
                  </td>
                  <td className="num c-jml" data-l="Jumlah">{a.jumlah ? numberID(a.jumlah) : "—"}</td>
                  <td className="num c-fee" data-l="Fee">
                    <b style={{ textDecoration: isBatal(a.status) ? "line-through" : "none" }}>{a.fee ? rupiah(a.fee) : "—"}</b>
                    {a.tarif ? (
                      <div className="tentatif xs2" title={`Tarif khusus ${rupiah(a.tarif)}/soal — ${a.ketTarif || "di luar tarif normal"}`}>
                        {a.ketTarif || "tarif khusus"}
                      </div>
                    ) : null}
                  </td>
                  <td className="c-status">{statusPill(a.status)}</td>
                  <td className="xs2 c-pic" data-l="PIC QC">
                    {a.picSoal ? <div title="PIC QC soal">{a.picSoal}</div> : null}
                    {a.picVideo ? <div className="muted" title="PIC QC video">{a.picVideo} · video</div> : null}
                    {!a.picSoal && !a.picVideo ? "—" : null}
                  </td>
                  <td className="act">
                    <RowMenu
                      label={`${a.guru || a.idProject || "baris"}`}
                      disabled={readOnly || busy}
                      onEdit={() => {
                        setDraft({
                          tanggal: a.tanggal,
                          idProject: a.idProject,
                          guru: a.guru,
                          idGuru: a.idGuru,
                          subtes: a.subtes,
                          jumlah: a.jumlah || "",
                          status: a.status,
                          picSoal: a.picSoal,
                          picVideo: a.picVideo,
                          tarif: a.tarif || "",
                          ketTarif: a.ketTarif || "",
                        });
                        setEdit({ mode: "edit", row: a.row });
                      }}
                      onDelete={() => setConfirm(a)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit ? (
        <AssignmentModal
          mode={edit.mode}
          draft={draft}
          onDraft={onDraft}
          projects={projects}
          teachers={teachers}
          opts={opts}
          onSave={save}
          onCancel={() => setEdit(null)}
          busy={busy}
          master={master}
          namaBulan={namaBulan}
        />
      ) : null}

      {confirm ? (
        <ConfirmDelete
          title="Hapus baris log ini?"
          detail={`${confirm.guru || "(tanpa guru)"} · ${confirm.subtes || confirm.idProject} · ${confirm.jumlah || 0} soal · ${rupiah(confirm.fee)}`}
          onCancel={() => setConfirm(null)}
          onOk={async () => {
            const ok = await run({ table: "assignments", action: "delete", row: confirm.row });
            if (ok) setConfirm(null);
          }}
          busy={busy}
        />
      ) : null}
    </>
  );
}

/* ========================= PANEL "ATUR" PROYEK ============================ */
// Semua aturan satu baris katalog dalam satu panel: tipe pembuatan, satuan
// pengambilan, deadline, dan tanggal lapor progres. Disimpan sekali (aksi
// "aturan") supaya kombinasinya divalidasi bersama di server.
function AturanDrawer({ p, nilai, bulan, readOnly, onClose, onTersimpan }) {
  const titik = nilai.titik || [];
  const tglLapor = (n) => titik.find((t) => t.persen === n)?.tanggal || "";
  const [f, setF] = useState(() => ({
    tipe: nilai.tipe || "",
    mode: nilai.isiPaket ? "paket" : "soal",
    isi: nilai.isiPaket ? String(nilai.isiPaket) : "",
    deadline: nilai.deadline || "",
    lapor30: tglLapor(30),
    lapor50: tglLapor(50),
  }));
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const isi = f.mode === "paket" ? isiPaket(f.isi) : 0;
  const masalah =
    f.mode === "paket" && !isi
      ? `Isi dulu jumlah soal per paket (${ISI_MIN}–${ISI_MAKS}).`
      : f.lapor30 && f.lapor50 && f.lapor30 > f.lapor50
        ? "Tanggal lapor 30% harus sebelum (atau sama dengan) tanggal lapor 50%."
        : f.deadline && [f.lapor30, f.lapor50].some((t) => t && t > f.deadline)
          ? "Tanggal lapor progres tidak boleh setelah deadline."
          : "";

  const simpan = async () => {
    setBusy(true);
    setGalat("");
    try {
      const res = await fetch("/api/admin/pengerjaan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "aturan",
          bulan,
          idProyek: p.id,
          aturan: { tipe: f.tipe, isi, deadline: f.deadline, lapor30: f.lapor30, lapor50: f.lapor50 },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      onTersimpan(j);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tanggal = (k, label, maks) => {
    const hm = hitungMundur(f[k]);
    return (
      <div className="ffield">
        <span>{label}</span>
        <div className="atur-tgl">
          <input type="date" className="input" value={f[k]} max={maks || undefined} disabled={busy || readOnly} onChange={(e) => set(k, e.target.value)} aria-label={label} />
          {f[k] ? (
            <>
              <b className={"dl-" + hm.kelas} title={hm.teks}>
                {k === "deadline" ? hm.teks : labelH(hm)}
              </b>
              <button type="button" className="ibtn" onClick={() => set(k, "")} disabled={busy || readOnly} aria-label={`Kosongkan ${label}`} title="Kosongkan">
                <Icon name="x" />
              </button>
            </>
          ) : (
            <small className="muted">{k === "deadline" ? "belum diatur" : "tidak wajib"}</small>
          )}
        </div>
      </div>
    );
  };

  return (
    <Drawer
      title="Aturan proyek"
      sub={`${p.id} · ${p.subtes}`}
      onClose={onClose}
      busy={busy}
      foot={
        <div className="drawer-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="button" className="btn btn-blue" onClick={simpan} disabled={busy || readOnly || Boolean(masalah)}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      }
    >
      <div className="atur-form">
        <div className="ffield">
          <span>Tipe pembuatan</span>
          <div className="seg" role="radiogroup" aria-label="Tipe pembuatan">
            {TIPE_PROYEK.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={f.tipe === t}
                className={"seg-btn" + (f.tipe === t ? " on" : "")}
                disabled={busy || readOnly}
                onClick={() => set("tipe", f.tipe === t ? "" : t)}
              >
                <b>{t}</b>
                <small>{t === "TO" ? "Soal untuk tryout" : "Latihan soal"}</small>
              </button>
            ))}
          </div>
          <small>Tampil sebagai label di halaman guru, dan guru bisa menyaring katalog per tipe. Klik pilihan yang aktif untuk mengosongkan.</small>
        </div>

        <div className="ffield">
          <span>Satuan pengambilan</span>
          <div className="seg" role="radiogroup" aria-label="Satuan pengambilan">
            <button type="button" role="radio" aria-checked={f.mode === "soal"} className={"seg-btn" + (f.mode === "soal" ? " on" : "")} disabled={busy || readOnly} onClick={() => set("mode", "soal")}>
              <b>Per soal</b>
              <small>Guru bebas memilih jumlah soal</small>
            </button>
            <button type="button" role="radio" aria-checked={f.mode === "paket"} className={"seg-btn" + (f.mode === "paket" ? " on" : "")} disabled={busy || readOnly} onClick={() => set("mode", "paket")}>
              <b>Per paket</b>
              <small>Guru mengambil kelipatan paket</small>
            </button>
          </div>
          {f.mode === "paket" ? (
            <div className="atur-isi">
              <input
                type="number"
                inputMode="numeric"
                className="input"
                min={ISI_MIN}
                max={ISI_MAKS}
                placeholder="mis. 10"
                value={f.isi}
                disabled={busy || readOnly}
                onChange={(e) => set("isi", e.target.value)}
                aria-label="Jumlah soal per paket"
              />
              <span>soal per paket</span>
            </div>
          ) : null}
          {isi ? (
            <small>
              {rupiah(p.harga * isi)}/paket ({rupiah(p.harga)}/soal) · sisa sekarang {rincianPaket(p.sisa, isi) || "habis"}
              {p.sisa > isi && p.sisa % isi ? " — paket terakhir lebih kecil" : ""}
            </small>
          ) : f.mode === "paket" ? (
            <small className="neg">Isi dulu jumlah soal per paket ({ISI_MIN}–{ISI_MAKS}).</small>
          ) : (
            <small>Harga tetap per soal; review hasil tetap per soal.</small>
          )}
        </div>

        {tanggal("deadline", "Deadline")}
        {tanggal("lapor30", "Lapor progres 30%", f.deadline)}
        {tanggal("lapor50", "Lapor progres 50%", f.deadline)}
        <small className="muted atur-catatan">Kosongkan tanggal lapor bila tidak wajib. Tanggal lapor harus sebelum deadline, dan lapor 30% tidak boleh setelah lapor 50%.</small>

        {masalah ? (
          <div className="banner err" role="alert" style={{ margin: 0 }}>
            <Icon name="alert" />
            <div>{masalah}</div>
          </div>
        ) : null}
        {galat ? (
          <div className="banner err" role="alert" style={{ margin: 0 }}>
            <Icon name="alert" />
            <div>{galat}</div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

/* ============================== KATALOG ================================== */
const BLANK_P = { id: "", idSubtes: "", platform: "", subtes: "", output: "", harga: "", kebutuhan: "" };

function KatalogTable({ projects, run, busy, readOnly, master, aksiEl, namaBulan, setErr, onMasterChanged, guruDb, log, riwayat, akun, wajibLogin, bulan, kontak, penanda, aturan = {}, dipesan = {}, onAturan }) {
  // Aturan proyek (tipe, satuan, deadline, lapor) diubah lewat panel "Atur".
  // `atLokal` = hasil simpan dari server; dipakai terus selama halaman terbuka
  // (pembacaan ulang bisa dilayani instans lain yang cache-nya belum segar).
  const [atLokal, setAtLokal] = useState({});
  const [atur, setAtur] = useState(null); // proyek yang panel Atur-nya terbuka
  const aturanDari = (p) => {
    const id = String(p.id).toUpperCase();
    return atLokal[id] || aturan[id] || {};
  };
  const [edit, setEdit] = useState(null);
  const [cari, setCari] = useState(null); // proyek yang sedang dicarikan guru
  const [draft, setDraft] = useState(BLANK_P);
  const [confirm, setConfirm] = useState(null);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length
      ? projects.filter((p) => words.every((w) => `${p.id} ${p.idSubtes} ${p.platform} ${p.subtes} ${p.output}`.toLowerCase().includes(w)))
      : projects;
  }, [projects, q]);

  // Ganti output -> harga ikut default master (kalau ada), tapi tetap bisa diubah.
  const onDraft = (k, v) =>
    setDraft((d) => {
      const nd = { ...d, [k]: v };
      if (k === "output") {
        const m = master.find((x) => x.id === d.idSubtes);
        const h = hargaMaster(m, v);
        if (h) nd.harga = h;
      }
      return nd;
    });

  // Pilih subtes dari master -> subtes/platform/output/harga ikut terbawa.
  const onPilih = (m) => {
    if (!m) return setDraft((d) => ({ ...d, idSubtes: "", subtes: "" }));
    const output = (m.output || "").split(",")[0].trim() || "Lengkap";
    setDraft((d) => ({
      ...d,
      idSubtes: m.id,
      subtes: m.subtes,
      platform: d.platform || m.platform || "",
      output,
      harga: hargaMaster(m, output) || d.harga || "",
    }));
  };

  const save = async () => {
    const ok = await run(
      edit.mode === "create"
        ? { table: "projects", action: "create", data: draft }
        : { table: "projects", action: "update", row: edit.row, data: draft }
    );
    if (!ok) return;
    setEdit(null);
    // Subtes arsip yang dipakai lagi diaktifkan kembali di master — SETELAH
    // proyeknya tersimpan, supaya gagal mengaktifkan tidak menggagalkan proyek.
    const m = master.find((x) => x.id === draft.idSubtes);
    if (edit.mode === "create" && m?.status === "Arsip") {
      try {
        await aktifkanKembali([m]);
        await onMasterChanged?.();
      } catch (e) {
        setErr?.(e.message);
      }
    }
  };

  return (
    <>
      <PageActions el={aksiEl}>
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Cari kode, subtes, platform" aria-label="Cari katalog" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-blue fab"
          disabled={readOnly || busy}
          onClick={() => {
            setDraft(BLANK_P);
            setEdit({ mode: "create" });
          }}
        >
          <Icon name="plus" stroke={2.2} />
          Tambah proyek
        </button>
      </PageActions>

      <div className="table-wrap fixed">
        <table className="grid-table t-kat">
          <Cols widths={[8, 8, 22, 10, 9, 9, 9, 19, 6]} />
          <thead>
            <tr>
              <th>Kode</th>
              <th>Platform</th>
              <th>Subtes</th>
              <th>Output</th>
              <th className="num">Harga</th>
              <th className="num">Kebutuhan</th>
              <th className="num">Sisa</th>
              <th>Aturan proyek</th>
              <th className="act">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  {projects.length ? "Tidak ada proyek yang cocok." : "Katalog bulan ini masih kosong."}
                </td>
              </tr>
            ) : null}
            {list.map((p) => (
              <tr key={p.row} className={p.sisa <= 0 ? "row-dim" : ""}>
                <td className="c-kode" data-l="Kode">
                  <span className="code">
                    <b>{p.id}</b>
                    {/* tautan ke katalog permanen supaya kaitannya terlihat */}
                    {p.idSubtes ? <span>{p.idSubtes}</span> : <span className="neg">tanpa master</span>}
                  </span>
                </td>
                <td className="wrap c-plat" data-l="Platform">{p.platform || "—"}</td>
                <td className="wrap c-subtes">
                  <b style={{ fontWeight: 600, color: "var(--text)" }}>{p.subtes}</b>
                </td>
                <td className="wrap c-output" data-l="Output">{p.output || "—"}</td>
                <td className="num c-harga" data-l="Harga">{rupiah(p.harga)}</td>
                <td className="num c-keb" data-l="Kebutuhan">{numberID(p.kebutuhan)}</td>
                <td className={"num c-sisa" + (p.sisa < 0 ? " neg" : "")} data-l="Sisa">
                  <b>{numberID(p.sisa)}</b>
                  {/* Halaman guru hanya menampilkan yang sisanya > 0. Ditandai di
                      sini supaya admin tidak bingung kenapa proyeknya tak muncul. */}
                  {p.sisa <= 0 ? (
                    <div className="muted xs2">tak tampil di halaman guru</div>
                  ) : (
                    <button type="button" className="cari-guru" onClick={() => setCari(p)} disabled={!guruDb.length} title="Cari guru yang cocok untuk proyek ini">
                      <Icon name="users" size={13} />
                      Cari guru
                    </button>
                  )}
                  {dipesan[String(p.id).toUpperCase()] ? (
                    <div className="muted xs2">{numberID(dipesan[String(p.id).toUpperCase()])} menunggu acc</div>
                  ) : null}
                </td>
                <td className="c-deadline" data-l="Aturan">
                  {(() => {
                    const at = aturanDari(p);
                    const isi = at.isiPaket || 0;
                    const hm = hitungMundur(at.deadline);
                    return (
                      <div className="atur-ringkas">
                        <div className="atur-chips">
                          {at.tipe ? <span className={"mini tipe tipe-" + at.tipe.toLowerCase()}>{at.tipe}</span> : <span className="mini kosong">tipe —</span>}
                          <span className="mini">{isi ? `Per paket ${isi} soal` : "Per soal"}</span>
                        </div>
                        <small>
                          Deadline{" "}
                          {at.deadline ? (
                            <b className={"dl-" + hm.kelas} title={hm.teks}>
                              {tanggalPendek(at.deadline)} · {labelH(hm)}
                            </b>
                          ) : (
                            <b className="muted">belum diatur</b>
                          )}
                        </small>
                        <small>
                          Lapor{" "}
                          {(at.titik || []).length ? (
                            (at.titik || []).map((t) => {
                              const h = hitungMundur(t.tanggal);
                              return (
                                <b key={t.persen} className={"dl-" + h.kelas + " atur-titik"} title={tanggalPendek(t.tanggal)}>
                                  {t.persen}% {labelH(h)}
                                </b>
                              );
                            })
                          ) : (
                            <b className="muted">tidak wajib</b>
                          )}
                        </small>
                        {isi ? (
                          <small className="muted">
                            {rupiah(p.harga * isi)}/paket · sisa {rincianPaket(p.sisa, isi) || "habis"}
                          </small>
                        ) : null}
                        {!readOnly ? (
                          <button type="button" className="btn btn-ghost xs" onClick={() => setAtur(p)} aria-label={`Atur ${p.subtes}`}>
                            <Icon name="edit" size={13} /> Atur
                          </button>
                        ) : null}
                      </div>
                    );
                  })()}
                </td>
                <td className="act">
                  <RowMenu
                    label={p.id}
                    disabled={readOnly || busy}
                    onEdit={() => {
                      setDraft({
                        id: p.id,
                        idSubtes: p.idSubtes,
                        platform: p.platform,
                        subtes: p.subtes,
                        output: p.output,
                        harga: p.harga,
                        kebutuhan: p.kebutuhan,
                      });
                      setEdit({ mode: "edit", row: p.row });
                    }}
                    onDelete={() => setConfirm(p)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit ? (
        <ProjectModal
          mode={edit.mode}
          draft={draft}
          onDraft={onDraft}
          onPilih={onPilih}
          onSave={save}
          onCancel={() => setEdit(null)}
          busy={busy}
          master={master}
          namaBulan={namaBulan}
        />
      ) : null}

      {cari ? (
        <CariGuru proyek={cari} bulan={bulan} kontak={kontak} penanda={penanda} master={master} guru={guruDb} log={log} riwayat={riwayat} akun={akun} wajibLogin={wajibLogin} onClose={() => setCari(null)} />
      ) : null}

      {confirm ? (
        <ConfirmDelete
          title="Hapus proyek dari katalog?"
          detail={`${confirm.id} · ${confirm.subtes} · kebutuhan ${numberID(confirm.kebutuhan)}`}
          warn="Baris log yang memakai kode ini tidak ikut terhapus, dan Fee-nya akan jadi 0 karena harganya tidak lagi ditemukan."
          onCancel={() => setConfirm(null)}
          onOk={async () => {
            const ok = await run({ table: "projects", action: "delete", row: confirm.row });
            if (ok) setConfirm(null);
          }}
          busy={busy}
        />
      ) : null}
      {atur ? (
        <AturanDrawer
          p={atur}
          nilai={aturanDari(atur)}
          bulan={bulan}
          readOnly={readOnly}
          onClose={() => setAtur(null)}
          onTersimpan={(j) => {
            setAtLokal((m) => ({ ...m, [String(atur.id).toUpperCase()]: { deadline: j.deadline, titik: j.titik, isiPaket: j.isiPaket, tipe: j.tipe } }));
            setAtur(null);
            onAturan?.();
          }}
        />
      ) : null}
    </>
  );
}

/* ====================== PEMBAYARAN & KWITANSI ============================= */
function Bayar({ groups, periode, doPrint, rows, aksiEl, namaBulan, filterTanggal, setErr }) {
  const total = groups.reduce((a, g) => a + g.total, 0);
  const tanpaRek = groups.filter((g) => !g.teacher?.rekening);
  const [proses, setProses] = useState(""); // "salin" | "excel" | "tersalin"
  const sibuk = proses === "salin" || proses === "excel";

  // Rekap format "Rekapitulasi Fee Freelance Produk" (lib/rekapFee.js).
  const rekap = useMemo(() => barisRekap(groups), [groups]);
  const tahun = useMemo(() => {
    const c = {};
    rows.forEach((r) => {
      const y = String(r.tanggal || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) c[y] = (c[y] || 0) + 1;
    });
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || String(new Date().getFullYear());
  }, [rows]);
  const judul = judulRekap(namaBulan, tahun, filterTanggal ? periode : "");
  const tidakCocok = rekap.filter((r) => !r.cocok);
  const bankTakDikenal = rekap.filter((r) => r.cocok && r.bank === "?");
  const tanpaNik = rekap.filter((r) => r.cocok && r.nik === "-");

  const salin = async () => {
    setProses("salin");
    try {
      await salinRekap(rekap, judul);
      setProses("tersalin");
      setTimeout(() => setProses(""), 2500);
    } catch (e) {
      setErr("Gagal menyalin: " + e.message);
      setProses("");
    }
  };
  const excel = async () => {
    setProses("excel");
    try {
      await unduhExcel(rekap, { judul, namaTab: `Freelance ${namaBulan}`, namaFile: `Rekap Fee Freelance ${namaBulan} ${tahun}${filterTanggal ? " (sebagian)" : ""}.xlsx` });
    } catch (e) {
      setErr("Gagal membuat file Excel: " + e.message);
    } finally {
      setProses("");
    }
  };

  return (
    <>
      <PageActions el={aksiEl}>
        <button type="button" className="btn btn-ghost" onClick={salin} disabled={!groups.length || sibuk} title="Salin tabel rekap untuk ditempel ke Google Sheets">
          <Icon name={proses === "tersalin" ? "check" : "salin"} />
          {proses === "tersalin" ? "Tersalin" : "Salin rekap"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={excel} disabled={!groups.length || sibuk}>
          <Icon name="download" />
          {proses === "excel" ? "Menyiapkan…" : "Unduh Excel"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => doPrint(groups, "summary")} disabled={!groups.length}>
          <Icon name="printer" />
          Cetak rekap
        </button>
        <button type="button" className="btn btn-blue" onClick={() => doPrint(groups, "each")} disabled={!groups.length}>
          <Icon name="printer" />
          Cetak semua kwitansi ({groups.length})
        </button>
      </PageActions>

      <div className="grid stat-grid">
        <div className="card stat hi">
          <div className="label">Total dibayar</div>
          <div className="value">{rupiah(total)}</div>
          <div className="sub">{periode} · tanpa status Cancel</div>
        </div>
        <div className="card stat">
          <div className="label">Jumlah guru</div>
          <div className="value">{numberID(groups.length)}</div>
          <div className="sub">{numberID(rows.length)} baris log</div>
        </div>
        <div className="card stat">
          <div className="label">Total soal</div>
          <div className="value">{numberID(groups.reduce((a, g) => a + g.soal, 0))}</div>
          <div className="sub">pada periode terpilih</div>
        </div>
        <div className="card stat">
          <div className="label">Rekening belum ada</div>
          <div className={"value " + (tanpaRek.length ? "red" : "green")}>{numberID(tanpaRek.length)}</div>
          <div className="sub">guru perlu dilengkapi</div>
        </div>
      </div>

      {tanpaRek.length ? (
        <div className="banner err">
          <Icon name="alert" />
          <div>
            Belum ada nomor rekening untuk <b>{tanpaRek.map((g) => g.teacher?.nama || g.guru).join(", ")}</b>. Lengkapi di
            Database guru sebelum transfer.
          </div>
        </div>
      ) : null}
      {tidakCocok.length || bankTakDikenal.length || tanpaNik.length ? (
        <div className="banner info">
          <Icon name="info" />
          <div>
            Untuk rekap Excel:{" "}
            {tidakCocok.length ? (
              <>
                <b>{tidakCocok.map((r) => r.nama).join(", ")}</b> tidak ditemukan di Database guru (nama di log berbeda), jadi telepon, NIK, dan
                rekeningnya kosong.{" "}
              </>
            ) : null}
            {bankTakDikenal.length ? (
              <>
                nama bank <b>{bankTakDikenal.map((r) => r.nama).join(", ")}</b> tidak dikenali dari isian rekeningnya (tertulis "?").{" "}
              </>
            ) : null}
            {tanpaNik.length ? (
              <>
                NIK <b>{tanpaNik.map((r) => r.nama).join(", ")}</b> belum ada.{" "}
              </>
            ) : null}
            Lengkapi di Database guru — rekening berisi angka saja dianggap BSI; bank lain ditulis bersama nomornya, mis. "Muamalat 1035867526".
          </div>
        </div>
      ) : null}

      <div className="table-wrap fixed">
        <table className="grid-table">
          <Cols widths={[26, 17, 18, 7, 8, 13, 11]} />
          <thead>
            <tr>
              <th>Guru</th>
              <th>Nomor rekening</th>
              <th>Atas nama</th>
              <th className="num">Baris</th>
              <th className="num">Soal</th>
              <th className="num">Total fee</th>
              <th className="act">Kwitansi</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  Tidak ada pembayaran pada filter ini.
                </td>
              </tr>
            ) : null}
            {groups.map((g) => (
              <tr key={g.guru}>
                <td className="wrap c-title">
                  <b style={{ color: "var(--text)" }}>{g.teacher?.nama || g.guru}</b>
                  {g.teacher?.nama && g.teacher.nama !== g.guru ? <div className="muted xs2">di log: {g.guru}</div> : null}
                </td>
                <td className="mono wrap" data-l="Nomor rekening">
                  {(() => {
                    const { bank, nomor } = bankDanRekening(g.teacher?.rekening);
                    if (!nomor) return <span className="neg">belum ada</span>;
                    return (
                      <>
                        {nomor}
                        <div className={"xs2 " + (bank ? "muted" : "warn-text")} style={{ fontFamily: "var(--font)" }}>
                          {bank || "bank tidak dikenali"}
                        </div>
                      </>
                    );
                  })()}
                </td>
                <td className="wrap" data-l="Atas nama">{g.teacher?.pemilikRekening || "—"}</td>
                <td className="num" data-l="Baris">{numberID(g.items.length)}</td>
                <td className="num" data-l="Soal">{numberID(g.soal)}</td>
                <td className="num" data-l="Total fee">
                  <b>{rupiah(g.total)}</b>
                </td>
                <td className="act">
                  <button type="button" className="btn btn-ghost xs" onClick={() => doPrint([g], "each")}>
                    <Icon name="printer" size={14} />
                    Cetak
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {groups.length ? (
            <tfoot>
              <tr>
                <td colSpan={5}>
                  <b>Total</b>
                </td>
                <td className="num">
                  <b>{rupiah(total)}</b>
                </td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}

/* ============================== AKSI BARIS =============================== */
function RowMenu({ onEdit, onDelete, disabled, label = "baris" }) {
  return (
    <div className="rowmenu">
      <button type="button" className="ibtn" onClick={onEdit} disabled={disabled} aria-label={`Edit ${label}`} title="Edit">
        <Icon name="edit" />
      </button>
      <button type="button" className="ibtn danger" onClick={onDelete} disabled={disabled} aria-label={`Hapus ${label}`} title="Hapus">
        <Icon name="trash" />
      </button>
    </div>
  );
}

/* ============================ KONFIRMASI ================================== */
function ConfirmDelete({ title, detail, warn, onCancel, onOk, busy }) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      busy={busy}
      foot={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button type="button" className="btn btn-red solid" onClick={onOk} disabled={busy}>
            {busy ? "Menghapus…" : "Ya, hapus"}
          </button>
        </>
      }
    >
      <p className="modal-sub">
        <b style={{ color: "var(--text)" }}>{detail}</b>
      </p>
      <p className="modal-sub">Baris akan dihapus dari spreadsheet dan baris di bawahnya digeser naik. Tindakan ini tidak bisa dibatalkan dari sini.</p>
      {warn ? (
        <div className="banner sample" style={{ margin: 0 }}>
          <Icon name="alert" />
          <div>{warn}</div>
        </div>
      ) : null}
    </Dialog>
  );
}
