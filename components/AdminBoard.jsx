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

const STATUS_KNOWN = ["Running Soal", "QC Soal", "Revisi Soal", "Approved", "Running Video", STATUS_BATAL];
const SEMUA = "Semua";
const POLL_MS = 45000;
const LOGIN_URL = "/admin/login?next=%2Fadmin";

const F0 = { q: "", from: "", to: "", platform: SEMUA, guru: SEMUA, subtes: SEMUA, status: SEMUA, pic: SEMUA };

// Halaman yang isinya terikat satu bulan -> perlu pemilih bulan.
// (Master, Proyek Baru, dan Analisis tidak: master bersifat lintas bulan dan
// Analisis punya filter bulannya sendiri.)
const PERBULAN = new Set(["ringkasan", "katalog", "log", "bayar"]);

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

async function apiGet(bulan) {
  const qs = bulan ? "?bulan=" + encodeURIComponent(bulan) : "";
  const res = await fetch("/api/admin/board" + qs, { cache: "no-store" });
  if (res.status === 401) throw new SesiBerakhir();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

function Bars({ data, fmt = numberID, color }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <div className="empty">Belum ada data.</div>;
  return (
    <div>
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="lbl" title={d.label}>
            {d.label}
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: (d.value / max) * 100 + "%", background: color || undefined }} />
          </div>
          <div className="val">{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

const Cols = ({ widths }) => (
  <colgroup>
    {widths.map((w, i) => (
      <col key={i} style={{ width: w + "%" }} />
    ))}
  </colgroup>
);

// ============================================================================
export default function AdminBoard({ initial, brand = "Cerebrum", peringatanPassword = false }) {
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState("ringkasan");
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
  const [extraLoaded, setExtraLoaded] = useState(false);

  const { projects = [], assignments = [], teachers = [], source, canWrite, diag, sheetWritable, serviceAccount } = board;
  const readOnly = !canWrite;
  // Kredensial ada & data terbaca, tapi spreadsheet hanya dibagikan sebagai
  // Viewer -> kasus khusus yang perlu instruksi, bukan sekadar "baca-saja".
  const kurangIzin = source === "live" && sheetWritable === false;

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const j = await apiGet(bulanAktif);
      setBoard(j);
      setSyncedAt(new Date());
      setErr("");
    } catch (e) {
      if (e.expired) setExpired(true);
      else setErr("Gagal menyegarkan data: " + e.message);
    } finally {
      setSyncing(false);
    }
  }, [bulanAktif]);

  // Sekali sesi habis, berhenti polling — kalau tidak, banner error akan
  // muncul berulang tiap 45 detik tanpa pernah bisa berhasil.
  // Master & data lintas bulan ditarik terpisah, hanya sekali di awal dan
  // setiap ada perubahan — supaya polling 45 detik tetap ringan.
  const refreshExtra = useCallback(async () => {
    try {
      const [m, mo, gu] = await Promise.all([
        fetch("/api/admin/master", { cache: "no-store" }),
        fetch("/api/admin/months", { cache: "no-store" }),
        fetch("/api/admin/teachers", { cache: "no-store" }),
      ]);
      if (m.status === 401 || mo.status === 401 || gu.status === 401) return setExpired(true);
      if (m.ok) setMaster(await m.json());
      if (mo.ok) setAllMonths(await mo.json());
      if (gu.ok) setGuru(await gu.json());
      setExtraLoaded(true);
    } catch (e) {
      setErr("Gagal memuat master/analisis: " + e.message);
    }
  }, []);

  useEffect(() => {
    if (!expired) refreshExtra();
  }, [refreshExtra, expired]);

  // Data sudah dibaca server saat halaman dibuka — itu sinkron pertama. Diset
  // setelah mount, bukan nilai awal state, supaya jam server & browser tidak
  // bentrok saat hidrasi.
  useEffect(() => setSyncedAt(new Date()), []);

  // Ganti bulan -> muat ulang papan untuk bulan itu.
  const pertama = useRef(true);
  useEffect(() => {
    if (pertama.current) { pertama.current = false; return; }
    refresh();
  }, [bulanAktif]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (expired) return undefined;
    const id = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, expired]);

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

  return (
    <>
      <div className="admin-shell">
        <SideNav
          tab={tab}
          setTab={setTab}
          counts={{
            log: assignments.length,
            katalog: projects.length,
            master: master.rows?.length || 0,
            guru: (guru.rows || []).length || teachers.length,
          }}
          open={navOpen}
          setOpen={setNavOpen}
          months={board.months || []}
          bulanTab={bulanAktif || board.tab || ""}
          setBulan={setBulanAktif}
          kunciBulan={syncing || busy}
          syncedAt={syncedAt}
          syncing={syncing}
          refresh={refresh}
        />

        <div className="admin-col">
          <div className="mobile-bar">
            <button type="button" className="navburger" onClick={() => setNavOpen(true)} aria-label="Buka menu">
              <Icon name="menu" size={20} />
            </button>
            <Brand size={28} row />
            <span style={{ width: 40 }} />
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
              <div className="head-actions" ref={setAksiEl} />
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

            {tab === "ringkasan" && <Ringkasan stat={stat} projects={projects} />}

            {tab === "log" && <StatBulan stat={stat} projects={projects} teachers={teachers} />}

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
              />
            )}
            {tab === "katalog" && (
              <KatalogTable
                projects={projects}
                run={run}
                busy={busy}
                readOnly={readOnly}
                master={master.rows || []}
                aksiEl={aksiEl}
                namaBulan={namaBulan}
                setErr={setErr}
                onMasterChanged={refreshExtra}
              />
            )}

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

            {tab === "analisis" &&
              (extraLoaded ? (
                <AnalyticsPanel data={allMonths} master={master.rows || []} />
              ) : (
                <div className="card empty">Memuat analisis…</div>
              ))}
            {tab === "bayar" && <Bayar groups={groups} periode={periode} doPrint={doPrint} rows={rows} aksiEl={aksiEl} />}

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
                />
              ) : (
                <div className="card empty">Memuat data guru…</div>
              ))}
          </main>
        </div>
      </div>

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
      { k: "master", label: "Master subtes", judul: "Master Subtes", langkah: 1, hitung: "master" },
      { k: "baru", label: "Proyek bulan baru", judul: "Proyek Bulan Baru", langkah: 2 },
      { k: "katalog", label: "Katalog bulan ini", judul: "Katalog Bulan Ini", langkah: 3, hitung: "katalog" },
      { k: "log", label: "Log pengambilan", judul: "Log Pengambilan", langkah: 4, hitung: "log" },
      { k: "bayar", label: "Pembayaran & kwitansi", judul: "Pembayaran & Kwitansi", langkah: 5 },
    ],
  },
  {
    grup: "Pantauan",
    item: [
      { k: "ringkasan", label: "Ringkasan", judul: "Ringkasan", ikon: "home" },
      { k: "analisis", label: "Analisis lintas bulan", judul: "Analisis Lintas Bulan", ikon: "chart" },
    ],
  },
  {
    grup: "Data pendukung",
    item: [{ k: "guru", label: "Database guru", judul: "Database Guru", ikon: "users", hitung: "guru" }],
  },
];
const JUMLAH_LANGKAH = NAV[0].item.length;

// Judul & jejak halaman di atas konten.
const PAGE = {};
NAV.forEach((g) =>
  g.item.forEach((it) => {
    PAGE[it.k] = {
      judul: it.judul,
      crumb: it.langkah ? `Alur kerja · Langkah ${it.langkah} dari ${JUMLAH_LANGKAH}` : g.grup,
    };
  })
);

function SideNav({ tab, setTab, counts, open, setOpen, months, bulanTab, setBulan, kunciBulan, syncedAt, syncing, refresh }) {
  return (
    <>
      {open ? <div className="nav-scrim" onClick={() => setOpen(false)} /> : null}
      <nav className={"admin-side" + (open ? " open" : "")} aria-label="Menu admin">
        <div className="side-scroll">
          <div className="side-brand">
            <Brand size={34} versi={APP_VERSION} sub="Divisi Produk" />
            <button type="button" className="icon-x side-close" onClick={() => setOpen(false)} aria-label="Tutup menu">
              <Icon name="x" />
            </button>
          </div>

          {months.length ? (
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

          {NAV.map((g) => (
            <div className="side-group" key={g.grup}>
              <div className="side-label">{g.grup}</div>
              {g.item.map((it) => (
                <button
                  key={it.k}
                  type="button"
                  className={"side-item" + (tab === it.k ? " active" : "")}
                  aria-current={tab === it.k ? "page" : undefined}
                  onClick={() => {
                    setTab(it.k);
                    setOpen(false);
                  }}
                >
                  {it.langkah ? <span className="si-step">{it.langkah}</span> : <Icon name={it.ikon} size={18} />}
                  <span className="si-label">{it.label}</span>
                  {it.hitung && counts[it.hitung] != null ? <span className="si-count">{numberID(counts[it.hitung])}</span> : null}
                </button>
              ))}
              {g.grup === "Data pendukung" ? (
                <a className="side-item" href="/open" target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={18} />
                  <span className="si-label">Halaman guru</span>
                </a>
              ) : null}
            </div>
          ))}
        </div>

        <div className="side-foot">
          <span className="avatar" aria-hidden="true">AD</span>
          <div className="who">
            <b>Admin</b>
            <span>{syncing ? "Menyinkronkan…" : syncedAt ? `Sinkron ${syncedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Tersambung"}</span>
          </div>
          <button type="button" className="ibtn" onClick={refresh} disabled={syncing} aria-label="Segarkan data" title="Segarkan data">
            <Icon name="refresh" />
          </button>
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
function StatBulan({ stat, projects, teachers }) {
  return (
    <div className="grid stat-grid">
      <div className="card stat">
        <span className="label">Fee bulan ini</span>
        <span className="value">{rupiah(stat.feeTotal)}</span>
        <span className="sub">status Cancel tidak dihitung</span>
      </div>
      <div className="card stat">
        <span className="label">Soal diambil</span>
        <span className="value">
          {numberID(stat.diambil)} <small>/ {numberID(stat.kebutuhan)}</small>
        </span>
        <div className="meter" aria-label={`${stat.pct}% terserap`}>
          <i style={{ width: Math.min(100, stat.pct) + "%" }} />
        </div>
      </div>
      <div className="card stat">
        <span className="label">Sisa kuota</span>
        <span className="value">{numberID(stat.sisa)} soal</span>
        <span className="sub">
          {numberID(stat.habis)} dari {numberID(projects.length)} proyek sudah habis
        </span>
      </div>
      <div className="card stat">
        <span className="label">Guru aktif</span>
        <span className="value">{numberID(stat.guruAktif)}</span>
        <span className="sub">{teachers.length ? `dari ${numberID(teachers.length)} guru terdaftar` : "punya baris di log"}</span>
      </div>
    </div>
  );
}

/* ============================== RINGKASAN ================================= */
function Ringkasan({ stat, projects }) {
  const platBars = Object.entries(stat.byPlat).map(([label, v]) => ({ label, value: v.keb - v.sisa }));
  const statusBars = Object.entries(stat.byStatus).map(([label, v]) => ({ label, value: v.fee }));
  const guruBars = Object.entries(stat.byGuru)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  return (
    <>
      <div className="grid stat-grid">
        <div className="card stat">
          <div className="label">Total proyek</div>
          <div className="value">{numberID(projects.length)}</div>
          <div className="sub">{stat.habis} stok habis</div>
        </div>
        <div className="card stat">
          <div className="label">Kebutuhan soal</div>
          <div className="value">{numberID(stat.kebutuhan)}</div>
          <div className="sub">target seluruh katalog</div>
        </div>
        <div className="card stat">
          <div className="label">Sudah diambil</div>
          <div className="value green">{numberID(stat.diambil)}</div>
          <div className="meter">
            <i style={{ width: Math.min(100, stat.pct) + "%" }} />
          </div>
        </div>
        <div className="card stat">
          <div className="label">Sisa</div>
          <div className="value amber">{numberID(stat.sisa)}</div>
          <div className="sub">{stat.negatif ? `${stat.negatif} proyek kelebihan ambil` : "belum diambil"}</div>
        </div>
        <div className="card stat">
          <div className="label">Tampil di halaman guru</div>
          <div className={"value " + (projects.length - stat.habis > 0 ? "green" : "amber")}>{numberID(projects.length - stat.habis)}</div>
          <div className="sub">bisa diambil · {stat.habis} stok habis</div>
        </div>
        <div className="card stat">
          <div className="label">Guru aktif</div>
          <div className="value">{numberID(stat.guruAktif)}</div>
          <div className="sub">punya baris di log</div>
        </div>
      </div>

      <div className="grid stat-grid">
        <div className="card stat hi">
          <div className="label">Fee harus dibayar</div>
          <div className="value">{rupiah(stat.feeTotal)}</div>
          <div className="sub">total kolom Fee pada log · Cancel = 0</div>
        </div>
        <div className="card stat">
          <div className="label">Anggaran harus disiapkan</div>
          <div className="value">{rupiah(stat.anggaran)}</div>
          <div className="sub">harga × kebutuhan, seluruh katalog</div>
        </div>
        <div className="card stat">
          <div className="label">Sisa anggaran</div>
          <div className="value amber">{rupiah(stat.anggaranSisa)}</div>
          <div className="sub">harga × sisa yang belum diambil</div>
        </div>
      </div>

      <div className="split">
        <div className="card card-p">
          <div className="section-head">
            <h2>Progres per platform</h2>
            <span className="muted">soal selesai</span>
          </div>
          <Bars data={platBars} />
          <div className="muted" style={{ marginTop: 8 }}>
            {Object.entries(stat.byPlat)
              .map(([k, v]) => `${k}: ${numberID(v.keb - v.sisa)}/${numberID(v.keb)}`)
              .join("  ·  ")}
          </div>
        </div>
        <div className="card card-p">
          <div className="section-head">
            <h2>Fee per status</h2>
            <span className="muted">nilai pekerjaan</span>
          </div>
          <Bars data={statusBars} fmt={rupiah} color="var(--good)" />
        </div>
      </div>

      <div className="card card-p">
        <div className="section-head">
          <h2>10 guru dengan fee terbesar</h2>
          <span className="muted">bulan ini</span>
        </div>
        <Bars data={guruBars} fmt={rupiah} />
      </div>
    </>
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

      <div className="chips" role="group" aria-label="Saring status">
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

function LogTable({ rows, projects, teachers, opts, stat, run, busy, readOnly, master, aksiEl, namaBulan }) {
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
          Fee tampil <b>{rupiah(rows.reduce((a, x) => a + x.fee, 0))}</b>
        </span>
        <button
          type="button"
          className="btn btn-blue"
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
        <table className="grid-table">
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
                  <td>{tglID(a.tanggal) || "—"}</td>
                  <td>
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
                  <td>
                    <b style={{ fontWeight: 600 }}>{a.guru || "—"}</b>
                    {a.idGuru ? <div className="muted xs2">ID {a.idGuru}</div> : null}
                  </td>
                  <td className="wrap">
                    {a.subtes || "—"}
                    {p?.output ? <div className="muted xs2">{p.output}</div> : null}
                  </td>
                  <td className="num">{a.jumlah ? numberID(a.jumlah) : "—"}</td>
                  <td className="num">
                    <b style={{ textDecoration: isBatal(a.status) ? "line-through" : "none" }}>{a.fee ? rupiah(a.fee) : "—"}</b>
                    {a.tarif ? (
                      <div className="tentatif xs2" title={`Tarif khusus ${rupiah(a.tarif)}/soal — ${a.ketTarif || "di luar tarif normal"}`}>
                        {a.ketTarif || "tarif khusus"}
                      </div>
                    ) : null}
                  </td>
                  <td>{statusPill(a.status)}</td>
                  <td className="xs2">
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

/* ============================== KATALOG ================================== */
const BLANK_P = { id: "", idSubtes: "", platform: "", subtes: "", output: "", harga: "", kebutuhan: "" };

function KatalogTable({ projects, run, busy, readOnly, master, aksiEl, namaBulan, setErr, onMasterChanged }) {
  const [edit, setEdit] = useState(null);
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
          className="btn btn-blue"
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
        <table className="grid-table">
          <Cols widths={[10, 10, 28, 13, 10, 11, 11, 7]} />
          <thead>
            <tr>
              <th>Kode</th>
              <th>Platform</th>
              <th>Subtes</th>
              <th>Output</th>
              <th className="num">Harga</th>
              <th className="num">Kebutuhan</th>
              <th className="num">Sisa</th>
              <th className="act">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  {projects.length ? "Tidak ada proyek yang cocok." : "Katalog bulan ini masih kosong."}
                </td>
              </tr>
            ) : null}
            {list.map((p) => (
              <tr key={p.row} className={p.sisa <= 0 ? "row-dim" : ""}>
                <td>
                  <span className="code">
                    <b>{p.id}</b>
                    {/* tautan ke katalog permanen supaya kaitannya terlihat */}
                    {p.idSubtes ? <span>{p.idSubtes}</span> : <span className="neg">tanpa master</span>}
                  </span>
                </td>
                <td className="wrap">{p.platform || "—"}</td>
                <td className="wrap">
                  <b style={{ fontWeight: 600, color: "var(--text)" }}>{p.subtes}</b>
                </td>
                <td className="wrap">{p.output || "—"}</td>
                <td className="num">{rupiah(p.harga)}</td>
                <td className="num">{numberID(p.kebutuhan)}</td>
                <td className={"num" + (p.sisa < 0 ? " neg" : "")}>
                  <b>{numberID(p.sisa)}</b>
                  {/* Halaman guru hanya menampilkan yang sisanya > 0. Ditandai di
                      sini supaya admin tidak bingung kenapa proyeknya tak muncul. */}
                  {p.sisa <= 0 ? <div className="muted xs2">tak tampil di halaman guru</div> : null}
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
    </>
  );
}

/* ====================== PEMBAYARAN & KWITANSI ============================= */
function Bayar({ groups, periode, doPrint, rows, aksiEl }) {
  const total = groups.reduce((a, g) => a + g.total, 0);
  const tanpaRek = groups.filter((g) => !g.teacher?.rekening);

  return (
    <>
      <PageActions el={aksiEl}>
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
                <td className="wrap">
                  <b style={{ color: "var(--text)" }}>{g.teacher?.nama || g.guru}</b>
                  {g.teacher?.nama && g.teacher.nama !== g.guru ? <div className="muted xs2">di log: {g.guru}</div> : null}
                </td>
                <td className="mono wrap">{g.teacher?.rekening || <span className="neg">belum ada</span>}</td>
                <td className="wrap">{g.teacher?.pemilikRekening || "—"}</td>
                <td className="num">{numberID(g.items.length)}</td>
                <td className="num">{numberID(g.soal)}</td>
                <td className="num">
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
