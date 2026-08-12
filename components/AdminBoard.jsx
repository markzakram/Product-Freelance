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
import { rupiah, numberID, parseHarga, formatHarga, cekHargaBulanan } from "@/lib/format";
import PrintArea from "./Receipts";
import MasterPanel from "./MasterPanel";
import NewMonthPanel from "./NewMonthPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import GuruPanel from "./GuruPanel";

const STATUS_KNOWN = ["Running Soal", "QC Soal", "Revisi Soal", "Approved", "Running Video"];
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
export default function AdminBoard({ initial, brand = "Cerebrum" }) {
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
    }),
    [projects, assignments]
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
      guruAktif: new Set(assignments.map((a) => a.guru).filter(Boolean)).size,
      habis: projects.filter((p) => p.sisa <= 0).length,
      negatif: projects.filter((p) => p.sisa < 0).length,
    };
  }, [projects, assignments]);

  const groups = useMemo(() => {
    const m = new Map();
    rows.forEach((a) => {
      if (!a.guru) return;
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
            guru: teachers.length,
          }}
          open={navOpen}
          setOpen={setNavOpen}
        />

        <div className="admin-main">
          <div className="page-head">
            <button className="navburger" onClick={() => setNavOpen(true)} aria-label="Buka menu">☰</button>
            <div>
              <div className="page-crumb">{PAGE[tab]?.group}</div>
              <h1 className="page-title">{PAGE[tab]?.title}</h1>
            </div>
            <div className="page-sync">
              {PERBULAN.has(tab) && (board.months || []).length ? (
                <label className="bulan-pick">
                  <span>Bulan</span>
                  <select
                    className="select sm"
                    value={bulanAktif || board.tab || ""}
                    onChange={(e) => setBulanAktif(e.target.value)}
                    disabled={syncing || busy}
                  >
                    {(board.months || []).map((m) => (
                      <option key={m.tab} value={m.tab}>{m.bulan}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {syncedAt ? <span className="muted">Sinkron {syncedAt.toLocaleTimeString("id-ID")}</span> : null}
              <button className="btn btn-ghost sm" onClick={refresh} disabled={syncing}>
                {syncing ? "⏳ Menyegarkan…" : "⟳ Segarkan"}
              </button>
            </div>
          </div>

      {kurangIzin ? (
        <div className="banner err">
          <span>🔒</span>
          <div>
            <b>Belum punya izin menulis ke spreadsheet.</b> Data terbaca, tapi setiap penyimpanan akan ditolak Google.
            <div className="banner-detail">
              Perbaiki sekali saja: buka spreadsheet di Google Sheets → tombol <b>Bagikan</b> → tambahkan{" "}
              <b>{serviceAccount || "service account"}</b> dengan akses <b>Editor</b> (sekarang masih Pembaca), lalu
              tekan Segarkan di sini. Data yang sudah ada tidak terpengaruh.
            </div>
          </div>
        </div>
      ) : readOnly ? (
        <div className="banner sample">
          <span>🔒</span>
          <div>
            {source === "sample"
              ? "Menampilkan data contoh — perubahan tidak bisa disimpan ke spreadsheet."
              : "Mode baca-saja — butuh GOOGLE_SERVICE_ACCOUNT_JSON dengan akses Editor agar bisa menyimpan."}
            {diag && !diag.ok ? (
              <div className="banner-detail">
                <b>Penyebab:</b> {diag.msg}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {err ? (
        <div className="banner err">
          <span>⚠</span> {err}
          <button className="btn-link" onClick={() => setErr("")}>
            tutup
          </button>
        </div>
      ) : null}

      {tab === "ringkasan" && <Ringkasan stat={stat} projects={projects} />}

      {(tab === "log" || tab === "bayar") && (
        <Filters f={f} set={set} opts={opts} reset={() => setF(F0)} aktif={filterAktif} n={rows.length} />
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
          platformOf={platformOf}
          master={master.rows || []}
        />
      )}
      {tab === "katalog" && <KatalogTable projects={projects} run={run} busy={busy} readOnly={readOnly} master={master.rows || []} />}

      {tab === "master" &&
        (extraLoaded ? (
          <MasterPanel
            rows={master.rows || []}
            readOnly={readOnly || !master.canWrite}
            busy={busy}
            setBusy={setBusy}
            setErr={setErr}
            onChanged={refreshExtra}
          />
        ) : (
          <div className="empty">Memuat master…</div>
        ))}

      {tab === "baru" &&
        (extraLoaded ? (
          <NewMonthPanel
            master={master.rows || []}
            months={allMonths.months || []}
            readOnly={readOnly || !allMonths.canWrite}
            busy={busy}
            setBusy={setBusy}
            setErr={setErr}
            onDone={async () => { await refreshExtra(); await refresh(); }}
          />
        ) : (
          <div className="empty">Memuat data bulan…</div>
        ))}

      {tab === "analisis" &&
        (extraLoaded ? (
          <AnalyticsPanel data={allMonths} master={master.rows || []} />
        ) : (
          <div className="empty">Memuat analisis…</div>
        ))}
      {tab === "bayar" && <Bayar groups={groups} periode={periode} doPrint={doPrint} rows={rows} />}

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
          />
        ) : (
          <div className="empty">Memuat data guru…</div>
        ))}
        </div>
      </div>

      {print ? <PrintArea groups={print.groups} mode={print.mode} brand={brand} periode={periode} /> : null}
    </>
  );
}

/* ============================ NAVIGASI SAMPING ============================ */
// Menu dikelompokkan supaya admin tidak dihadapkan 8 tab sekaligus.
const NAV = [
  { grup: "Operasional", ikon: "📋", item: [
    ["ringkasan", "Ringkasan", "Angka utama bulan berjalan"],
    ["katalog", "Katalog Bulan Ini", "Anggaran soal bulan berjalan", "katalog"],
    ["log", "Log Pengambilan", "Siapa mengerjakan apa", "log"],
  ]},
  { grup: "Perencanaan", ikon: "🗂", item: [
    ["master", "Master Subtes", "Katalog permanen semua subtes", "master"],
    ["baru", "Proyek Bulan Baru", "Susun anggaran bulan depan"],
  ]},
  { grup: "Keuangan", ikon: "💰", item: [
    ["bayar", "Pembayaran & Kwitansi", "Rekap fee & cetak kwitansi"],
  ]},
  { grup: "Analisis & Data", ikon: "📊", item: [
    ["analisis", "Analisis Lintas Bulan", "Tren, produktivitas, anggaran"],
    ["guru", "Database Guru", "Data & rekening guru", "guru"],
  ]},
];

// Peta untuk judul halaman di kanan atas.
const PAGE = {};
NAV.forEach((g) => g.item.forEach(([k, title]) => (PAGE[k] = { title, group: g.grup })));

function SideNav({ tab, setTab, counts, open, setOpen }) {
  return (
    <>
      {open ? <div className="nav-scrim" onClick={() => setOpen(false)} /> : null}
      <nav className={"admin-side" + (open ? " open" : "")}>
        <div className="side-top">
          <span className="side-title">Menu Admin</span>
          <button className="icon-x side-close" onClick={() => setOpen(false)} aria-label="Tutup menu">✕</button>
        </div>

        <div className="side-scroll">
          {NAV.map((g) => (
            <div className="side-group" key={g.grup}>
              <div className="side-label"><span>{g.ikon}</span>{g.grup}</div>
              {g.item.map(([k, label, desc, countKey]) => (
                <button
                  key={k}
                  className={"side-item" + (tab === k ? " active" : "")}
                  onClick={() => { setTab(k); setOpen(false); }}
                >
                  <span className="si-main">
                    <span className="si-label">{label}</span>
                    {countKey && counts[countKey] != null ? <span className="si-count">{numberID(counts[countKey])}</span> : null}
                  </span>
                  <span className="si-desc">{desc}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

      </nav>
    </>
  );
}

/* ========================= SESI BERAKHIR ================================== */
function SessionExpired() {
  return (
    <div className="card card-p expired">
      <div className="expired-ico">🔒</div>
      <h2>Sesi kamu sudah berakhir</h2>
      <p className="muted">
        Ini terjadi kalau password internal baru saja diganti, atau sesi sudah lewat 12 jam. Datanya aman — cukup
        login ulang untuk melanjutkan.
      </p>
      <a className="btn btn-blue" href={LOGIN_URL}>
        Login ulang
      </a>
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
          <div className="label">Total Proyek</div>
          <div className="value blue">{numberID(projects.length)}</div>
          <div className="sub">{stat.habis} stok habis</div>
        </div>
        <div className="card stat">
          <div className="label">Kebutuhan Soal</div>
          <div className="value navy">{numberID(stat.kebutuhan)}</div>
          <div className="sub">target seluruh katalog</div>
        </div>
        <div className="card stat">
          <div className="label">Sudah Diambil</div>
          <div className="value green">{numberID(stat.diambil)}</div>
          <div className="sub">{stat.pct}% dari kebutuhan</div>
        </div>
        <div className="card stat">
          <div className="label">Sisa</div>
          <div className="value amber">{numberID(stat.sisa)}</div>
          <div className="sub">{stat.negatif ? `${stat.negatif} proyek kelebihan ambil` : "belum diambil"}</div>
        </div>
        <div className="card stat">
          <div className="label">Guru Aktif</div>
          <div className="value blue">{numberID(stat.guruAktif)}</div>
          <div className="sub">punya baris di log</div>
        </div>
      </div>

      <div className="grid stat-grid" style={{ marginTop: 14 }}>
        <div className="card stat hi">
          <div className="label">Fee Harus Dibayar</div>
          <div className="value green">{rupiah(stat.feeTotal)}</div>
          <div className="sub">total kolom Fee pada log</div>
        </div>
        <div className="card stat hi">
          <div className="label">Anggaran Harus Disiapkan</div>
          <div className="value navy">{rupiah(stat.anggaran)}</div>
          <div className="sub">harga × kebutuhan, seluruh katalog</div>
        </div>
        <div className="card stat hi">
          <div className="label">Sisa Anggaran</div>
          <div className="value amber">{rupiah(stat.anggaranSisa)}</div>
          <div className="sub">harga × sisa yang belum diambil</div>
        </div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="card card-p">
          <div className="section-head">
            <h2>Progress per Platform</h2>
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
            <h2>Fee per Status</h2>
            <span className="muted">nilai pekerjaan</span>
          </div>
          <Bars data={statusBars} fmt={rupiah} color="linear-gradient(90deg,#34d399,#059669)" />
        </div>
      </div>

      <div className="card card-p" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>10 Guru dengan Fee Terbesar</h2>
          <span className="muted">seluruh periode</span>
        </div>
        <Bars data={guruBars} fmt={rupiah} color="linear-gradient(90deg,#60a5fa,#2563eb)" />
      </div>
    </>
  );
}

/* =============================== FILTER =================================== */
function Filters({ f, set, opts, reset, aktif, n }) {
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
    <div className="card card-p filters">
      <div className="fl-row">
        <label className="fl grow">
          <span>Cari</span>
          <input className="input" placeholder="ID, guru, subtes, status, PIC…" value={f.q} onChange={set("q")} />
        </label>
        <label className="fl">
          <span>Tanggal dari</span>
          <input className="input" type="date" value={f.from} onChange={set("from")} />
        </label>
        <label className="fl">
          <span>sampai</span>
          <input className="input" type="date" value={f.to} onChange={set("to")} />
        </label>
      </div>
      <div className="fl-row">
        {sel("platform", opts.platform, "Platform")}
        {sel("guru", opts.guru, "Guru")}
        {sel("status", opts.status, "Status")}
        {sel("pic", opts.pic, "PIC QC")}
        {sel("subtes", opts.subtes, "Subtes")}
        <div className="fl fl-end">
          <span className="muted">{numberID(n)} baris</span>
          {aktif ? (
            <button className="btn btn-ghost sm" onClick={reset}>
              ✕ Reset filter
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =========================== POPUP EDIT/TAMBAH ============================ */
function Modal({ title, children, onCancel, onSave, busy, saveLabel = "Simpan", bisaSimpan = true }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  return (
    <div className="overlay" onClick={() => !busy && onCancel()}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-x" onClick={onCancel} disabled={busy} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button className="btn btn-blue" onClick={onSave} disabled={busy || !bisaSimpan}>
            {busy ? "Menyimpan…" : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children, hint, wide }) => (
  <label className={"ffield" + (wide ? " wide" : "")}>
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

function AssignmentModal({ mode, draft, onDraft, projects, teachers, opts, onSave, onCancel, busy, master }) {
  const proj = projects.find((p) => p.id === draft.idProject);
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
  const fee = tarifDipakai * (parseInt(draft.jumlah, 10) || 0);

  const pilihTarif = (v) => {
    if (v === "normal") { onDraft("tarif", ""); onDraft("ketTarif", ""); }
    else { onDraft("tarif", String(tarifTelat)); onDraft("ketTarif", "Terlambat"); }
  };

  return (
    <Modal
      title={mode === "create" ? "＋ Tambah Baris Log" : "✎ Edit Baris Log"}
      onCancel={onCancel}
      onSave={onSave}
      busy={busy}
    >
      <div className="form-grid">
        <Field label="Tanggal">
          <input className="input" type="date" value={draft.tanggal} onChange={(e) => onDraft("tanggal", e.target.value)} />
        </Field>
        <Field label="ID Project" hint={proj ? `Harga ${rupiah(proj.harga)} · sisa ${numberID(proj.sisa)}` : null}>
          <select className="select" value={draft.idProject} onChange={(e) => onDraft("idProject", e.target.value)}>
            <option value="">— pilih proyek —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.subtes}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Guru" hint="Pilih dari daftar agar ID Guru terisi otomatis">
          <input className="input" list="guru-list" value={draft.guru} onChange={(e) => onDraft("guru", e.target.value)} placeholder="Nama guru" />
          <datalist id="guru-list">
            {teachers.map((t) => (
              <option key={t.idGuru} value={t.nama} />
            ))}
          </datalist>
        </Field>
        <Field label="ID Guru">
          <input className="input" value={draft.idGuru} onChange={(e) => onDraft("idGuru", e.target.value)} />
        </Field>
        <Field label="Subtes" wide>
          <input className="input" value={draft.subtes} onChange={(e) => onDraft("subtes", e.target.value)} />
        </Field>
        <Field label="Jumlah soal">
          <input className="input" type="number" min={0} value={draft.jumlah} onChange={(e) => onDraft("jumlah", e.target.value)} />
        </Field>
        <Field
          label="Tarif per soal"
          hint={
            adaTarifTelat
              ? "Guru yang lewat deadline dibayar dengan tarif terlambat."
              : "Master belum punya tarif terlambat untuk subtes ini — atur di Master Subtes, mis. 5000-7000."
          }
        >
          <select className="select" value={mode2} onChange={(e) => pilihTarif(e.target.value)} disabled={!adaTarifTelat}>
            <option value="normal">Normal — {rupiah(tarifNormal)}</option>
            {adaTarifTelat ? <option value="telat">Terlambat — {rupiah(tarifTelat)}</option> : null}
          </select>
        </Field>
        <Field label="Status">
          <select className="select" value={draft.status} onChange={(e) => onDraft("status", e.target.value)}>
            <option value="">—</option>
            {opts.status.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="PIC QC Soal">
          <input className="input" value={draft.picSoal} onChange={(e) => onDraft("picSoal", e.target.value)} />
        </Field>
        <Field label="PIC QC Video">
          <input className="input" value={draft.picVideo} onChange={(e) => onDraft("picVideo", e.target.value)} />
        </Field>
      </div>

      <div className="derived-box">
        <b>🔒 Dihitung otomatis oleh spreadsheet</b>
        <div>
          <span>Fee</span>
          <b>{rupiah(fee)}</b>
          <small>Jumlah × {rupiah(tarifDipakai)}{mode2 === "telat" ? " (tarif terlambat)" : ""}</small>
        </div>
        <div>
          <span>Bulan</span>
          <b>{bulan ? `${bulan[1]}-${bulan[2]}` : "—"}</b>
          <small>diambil dari Tanggal</small>
        </div>
      </div>
    </Modal>
  );
}

const OUTPUTS = ["Lengkap", "Video Pembahasan", "Soal & Pembahasan", "Liveclass"];
const hargaRawMaster = (m, output) =>
  ({ "Lengkap": m?.hargaLengkap, "Video Pembahasan": m?.hargaVideo, "Soal & Pembahasan": m?.hargaSoal, "Liveclass": m?.hargaLive }[output]) || "";
// Harga di master bisa rentang tentatif -> form diisi batas BAWAH, rentangnya
// ditampilkan sebagai petunjuk supaya admin sadar harganya belum pasti.
const hargaMaster = (m, output) => { const h = parseHarga(hargaRawMaster(m, output)); return h.ada ? h.min : ""; };

// Sama seperti di "Proyek Bulan Baru": subtes selalu dipilih dari Master_Project
// supaya tautan ID Subtes terisi dan harga/platform ikut terbawa.
function ProjectModal({ mode, draft, onDraft, onPilih, onSave, onCancel, busy, master }) {
  const [cari, setCari] = useState("");
  const terpilih = master.find((m) => m.id === draft.idSubtes);
  const cekHarga = cekHargaBulanan(draft.harga);
  const rentangMaster = parseHarga(hargaRawMaster(terpilih, draft.output));
  const total = (cekHarga.ok ? cekHarga.nilai : 0) * (parseInt(draft.kebutuhan, 10) || 0);
  const petunjukHarga = !cekHarga.ok && !cekHarga.kosong
    ? cekHarga.pesan
    : rentangMaster.tentatif
    ? `Master menandai harga ini TENTATIF: ${formatHarga(hargaRawMaster(terpilih, draft.output))} — pilih satu angka untuk bulan ini`
    : rentangMaster.ada
    ? "Terisi dari master, boleh diubah untuk bulan ini"
    : "Master belum punya harga untuk output ini — isi manual";
  const bolehSimpan = cekHarga.ok && Boolean(draft.idSubtes);

  const hasil = useMemo(() => {
    const s = cari.trim().toLowerCase();
    if (!s) return [];
    return master
      .filter((m) => (m.status || "Aktif") !== "Arsip")
      .filter((m) => `${m.id} ${m.subtes} ${m.kategori}`.toLowerCase().includes(s))
      .slice(0, 8);
  }, [master, cari]);

  return (
    <Modal
      title={mode === "create" ? "＋ Tambah Proyek ke Bulan Ini" : "✎ Edit Proyek"}
      onCancel={onCancel}
      onSave={onSave}
      busy={busy}
      bisaSimpan={bolehSimpan}
    >
      {!draft.idSubtes ? (
        <>
          <Field label="Cari subtes di Master" wide hint="Ketik nama subtes atau ID. Belum ada? Tambahkan dulu di menu Master Subtes.">
            <input className="input" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="mis. Figural Analogi / SUB-001" autoFocus />
          </Field>
          {hasil.length ? (
            <div className="picker">
              {hasil.map((m) => (
                <button key={m.id} className="pick" onClick={() => { onPilih(m); setCari(""); }}>
                  <b>{m.subtes}</b>
                  <span className="muted xs2">{m.id} · {m.kategori || "tanpa kategori"}</span>
                </button>
              ))}
            </div>
          ) : cari.trim() ? (
            <div className="muted" style={{ marginTop: 10 }}>Tidak ada yang cocok di master.</div>
          ) : null}
        </>
      ) : (
        <>
          <div className="picked">
            <div>
              <b>{terpilih?.subtes || draft.subtes}</b>
              <div className="muted xs2">{draft.idSubtes}{terpilih?.kategori ? " · " + terpilih.kategori : ""}</div>
            </div>
            {mode === "create" ? (
              <button className="btn btn-ghost xs" onClick={() => onPilih(null)}>Ganti subtes</button>
            ) : null}
          </div>

          <div className="form-grid" style={{ marginTop: 14 }}>
            <Field label="Platform">
              <input className="input" value={draft.platform} onChange={(e) => onDraft("platform", e.target.value)} />
            </Field>
            <Field label="Output">
              <select className="select" value={draft.output} onChange={(e) => onDraft("output", e.target.value)}>
                <option value="">— pilih —</option>
                {OUTPUTS.map((o) => <option key={o}>{o}</option>)}
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
                <div className="quickpick">
                  <span className="muted xs2">Pakai cepat:</span>
                  <button className="btn btn-ghost xs" onClick={() => onDraft("harga", String(rentangMaster.min))}>
                    {rupiah(rentangMaster.min)}
                  </button>
                  <button className="btn btn-ghost xs" onClick={() => onDraft("harga", String(rentangMaster.max))}>
                    {rupiah(rentangMaster.max)}
                  </button>
                </div>
              ) : null}
            </Field>
            <Field label="Kebutuhan (jumlah soal)">
              <input className="input" type="number" min={0} value={draft.kebutuhan} onChange={(e) => onDraft("kebutuhan", e.target.value)} />
            </Field>
          </div>

          <div className="derived-box">
            <b>🔒 Dibuat / dihitung otomatis</b>
            <div>
              <span>Kode</span>
              <b>{draft.id || "otomatis"}</b>
              <small>nomor urut bulan ini</small>
            </div>
            <div>
              <span>Sisa</span>
              <b>otomatis</b>
              <small>Kebutuhan − yang sudah diambil</small>
            </div>
            <div>
              <span>Anggaran</span>
              <b>{rupiah(total)}</b>
              <small>Harga × Kebutuhan</small>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ========================= LOG PENGAMBILAN =============================== */
const BLANK_A = { tanggal: "", idProject: "", guru: "", idGuru: "", subtes: "", jumlah: "", status: "", picSoal: "", picVideo: "", tarif: "", ketTarif: "" };

function LogTable({ rows, projects, teachers, opts, stat, run, busy, readOnly, platformOf, master }) {
  const [edit, setEdit] = useState(null); // { mode, row }
  const [draft, setDraft] = useState(BLANK_A);
  const [confirm, setConfirm] = useState(null);

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

  return (
    <>
      <div className="section-head" style={{ marginTop: 18 }}>
        
        <div className="head-actions">
          <span className="muted">
            Fee tampil: <b>{rupiah(rows.reduce((a, x) => a + x.fee, 0))}</b> · total {rupiah(stat.feeTotal)}
          </span>
          <button
            className="btn btn-blue sm"
            disabled={readOnly || busy}
            onClick={() => {
              setDraft(BLANK_A);
              setEdit({ mode: "create" });
            }}
          >
            ＋ Tambah Baris
          </button>
        </div>
      </div>

      <div className="table-wrap fixed">
        <table className="grid-table">
          <Cols widths={[9, 12, 14, 24, 6, 11, 11, 8, 5]} />
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>ID Project</th>
              <th>Guru</th>
              <th>Subtes</th>
              <th className="num">Jml</th>
              <th className="num">Fee 🔒</th>
              <th>Status</th>
              <th>PIC QC</th>
              <th className="act" />
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
            {rows.map((a) => (
              <tr key={a.row}>
                <td>
                  {tglID(a.tanggal) || "—"}
                  {a.bulan ? <div className="muted xs2">{a.bulan}</div> : null}
                </td>
                <td>
                  <span className="mono">{a.idProject || "—"}</span>
                  {platformOf(a) ? <div className="muted xs2">{platformOf(a)}</div> : null}
                </td>
                <td>
                  {a.guru || "—"}
                  {a.idGuru ? <div className="muted xs2">ID {a.idGuru}</div> : null}
                </td>
                <td className="wrap">{a.subtes || "—"}</td>
                <td className="num">{a.jumlah ? numberID(a.jumlah) : "—"}</td>
                <td className="num derived">
                  {a.fee ? rupiah(a.fee) : "—"}
                  {a.tarif ? (
                    <div className="tentatif xs2" title={`Tarif khusus ${rupiah(a.tarif)}/soal — ${a.ketTarif || "di luar tarif normal"}`}>
                      {a.ketTarif || "tarif khusus"}
                    </div>
                  ) : null}
                </td>
                <td>{statusPill(a.status)}</td>
                <td className="xs2">
                  {a.picSoal ? <div>📝 {a.picSoal}</div> : null}
                  {a.picVideo ? <div>🎬 {a.picVideo}</div> : null}
                  {!a.picSoal && !a.picVideo ? "—" : null}
                </td>
                <td className="act">
                  <RowMenu
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
            ))}
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
        />
      ) : null}

      {confirm ? (
        <ConfirmDelete
          title="Hapus baris log ini?"
          detail={`${confirm.guru || "(tanpa guru)"} · ${confirm.subtes || confirm.idProject} · ${
            confirm.jumlah || 0
          } soal · ${rupiah(confirm.fee)}`}
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

function KatalogTable({ projects, run, busy, readOnly, master }) {
  const [edit, setEdit] = useState(null);
  const [draft, setDraft] = useState(BLANK_P);
  const [confirm, setConfirm] = useState(null);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? projects.filter((p) => `${p.id} ${p.platform} ${p.subtes} ${p.output}`.toLowerCase().includes(s)) : projects;
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
    if (ok) setEdit(null);
  };

  return (
    <>
      <div className="section-head" style={{ marginTop: 18 }}>
        
        <div className="head-actions">
          <input className="input sm" placeholder="Cari ID, platform, subtes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button
            className="btn btn-blue sm"
            disabled={readOnly || busy}
            onClick={() => {
              setDraft(BLANK_P);
              setEdit({ mode: "create" });
            }}
          >
            ＋ Tambah Proyek
          </button>
        </div>
      </div>

      <div className="table-wrap fixed">
        <table className="grid-table">
          <Cols widths={[12, 11, 29, 14, 10, 9, 8, 7]} />
          <thead>
            <tr>
              <th>Kode Baris</th>
              <th>Platform</th>
              <th>Subtes</th>
              <th>Output</th>
              <th className="num">Harga</th>
              <th className="num">Kebutuhan</th>
              <th className="num">Sisa 🔒</th>
              <th className="act" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.row} className={p.sisa <= 0 ? "row-dim" : ""}>
                <td className="mono">
                  {p.id}
                  {/* tautan ke katalog permanen supaya kaitannya terlihat */}
                  {p.idSubtes ? <div className="muted xs2">{p.idSubtes}</div> : null}
                </td>
                <td className="wrap">{p.platform || "—"}</td>
                <td className="wrap">{p.subtes}</td>
                <td className="wrap">{p.output || "—"}</td>
                <td className="num">{rupiah(p.harga)}</td>
                <td className="num">{numberID(p.kebutuhan)}</td>
                <td className={"num derived" + (p.sisa < 0 ? " neg" : "")}>{numberID(p.sisa)}</td>
                <td className="act">
                  <RowMenu
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
        />
      ) : null}

      {confirm ? (
        <ConfirmDelete
          title="Hapus proyek ini dari katalog?"
          detail={`${confirm.id} · ${confirm.subtes} · kebutuhan ${numberID(confirm.kebutuhan)}`}
          warn="Baris log yang memakai ID ini tidak ikut terhapus dan Fee-nya akan jadi 0 karena harga tidak lagi ditemukan."
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
function Bayar({ groups, periode, doPrint, rows }) {
  const total = groups.reduce((a, g) => a + g.total, 0);
  const tanpaRek = groups.filter((g) => !g.teacher?.rekening);

  return (
    <>
      <div className="grid stat-grid" style={{ marginTop: 18 }}>
        <div className="card stat hi">
          <div className="label">Total Dibayar (filter)</div>
          <div className="value green">{rupiah(total)}</div>
          <div className="sub">{periode}</div>
        </div>
        <div className="card stat">
          <div className="label">Jumlah Guru</div>
          <div className="value blue">{numberID(groups.length)}</div>
          <div className="sub">{numberID(rows.length)} baris log</div>
        </div>
        <div className="card stat">
          <div className="label">Total Soal</div>
          <div className="value navy">{numberID(groups.reduce((a, g) => a + g.soal, 0))}</div>
          <div className="sub">pada periode terpilih</div>
        </div>
        <div className="card stat">
          <div className="label">Rekening Belum Ada</div>
          <div className={"value " + (tanpaRek.length ? "red" : "green")}>{numberID(tanpaRek.length)}</div>
          <div className="sub">guru perlu dilengkapi</div>
        </div>
      </div>

      {tanpaRek.length ? (
        <div className="banner err" style={{ marginTop: 14 }}>
          <span>⚠</span> Belum ada nomor rekening untuk:{" "}
          <b>{tanpaRek.map((g) => g.teacher?.nama || g.guru).join(", ")}</b>. Lengkapi di sheet “Data guru freelance”
          sebelum transfer.
        </div>
      ) : null}

      <div className="section-head" style={{ marginTop: 18 }}>
        <h2>Pembayaran per Guru</h2>
        <div className="head-actions">
          <button className="btn btn-ghost sm" onClick={() => doPrint(groups, "summary")} disabled={!groups.length}>
            🖨 Cetak Rekap Semua
          </button>
          <button className="btn btn-blue sm" onClick={() => doPrint(groups, "each")} disabled={!groups.length}>
            🖨 Cetak Semua Kwitansi ({groups.length})
          </button>
        </div>
      </div>

      <div className="table-wrap fixed">
        <table className="grid-table">
          <Cols widths={[26, 16, 18, 7, 8, 14, 11]} />
          <thead>
            <tr>
              <th>Guru</th>
              <th>Nomor Rekening</th>
              <th>a.n.</th>
              <th className="num">Baris</th>
              <th className="num">Soal</th>
              <th className="num">Total Fee</th>
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
                  <b>{g.teacher?.nama || g.guru}</b>
                  {g.teacher?.nama && g.teacher.nama !== g.guru ? <div className="muted xs2">di log: {g.guru}</div> : null}
                </td>
                <td className="mono wrap">{g.teacher?.rekening || <span className="neg">— belum ada —</span>}</td>
                <td className="wrap">{g.teacher?.pemilikRekening || "—"}</td>
                <td className="num">{numberID(g.items.length)}</td>
                <td className="num">{numberID(g.soal)}</td>
                <td className="num">
                  <b>{rupiah(g.total)}</b>
                </td>
                <td className="act">
                  <button className="btn btn-ghost xs" onClick={() => doPrint([g], "each")}>
                    🖨 Cetak
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {groups.length ? (
            <tfoot>
              <tr>
                <td colSpan={5}>
                  <b>TOTAL</b>
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
function RowMenu({ onEdit, onDelete, disabled }) {
  return (
    <div className="rowmenu">
      <button className="ibtn" onClick={onEdit} disabled={disabled} title="Edit">
        ✎
      </button>
      <button className="ibtn danger" onClick={onDelete} disabled={disabled} title="Hapus">
        🗑
      </button>
    </div>
  );
}

/* ============================ KONFIRMASI ================================== */
function ConfirmDelete({ title, detail, warn, onCancel, onOk, busy }) {
  return (
    <div className="overlay" onClick={() => !busy && onCancel()}>
      <div className="modal sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🗑 {title}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-sub">{detail}</p>
          <p className="modal-sub">
            Baris akan dihapus dari spreadsheet dan baris di bawahnya digeser naik. Tindakan ini tidak bisa dibatalkan
            dari sini.
          </p>
          {warn ? <p className="modal-sub warn-text">⚠ {warn}</p> : null}
          <button className="btn btn-red" style={{ width: "100%" }} onClick={onOk} disabled={busy}>
            {busy ? "Menghapus…" : "Ya, hapus"}
          </button>
          <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }} onClick={onCancel} disabled={busy}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
