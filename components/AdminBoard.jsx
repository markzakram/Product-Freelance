"use client";

// ============================================================================
//  DASHBOARD ADMIN — kendali penuh atas tab "Juli_Proyek ASN & Bappenas".
//
//  Semua perubahan ditulis balik ke Google Sheets (spreadsheet tetap jadi
//  sumber kebenaran). Kolom turunan — Sisa, Fee, Bulan — dihitung oleh formula
//  di sheet, jadi di sini sifatnya baca-saja dan ditandai ikon kunci; menimpanya
//  dengan angka statis akan merusak formula sheet.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import PrintArea from "./Receipts";

const STATUS_KNOWN = ["Running Soal", "QC Soal", "Revisi Soal", "Approved", "Running Video"];
const SEMUA = "Semua";
const POLL_MS = 45000;

const F0 = {
  q: "",
  from: "",
  to: "",
  platform: SEMUA,
  guru: SEMUA,
  subtes: SEMUA,
  status: SEMUA,
  pic: SEMUA,
};

const tglID = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
};
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));

async function mutate(payload) {
  const res = await fetch("/api/admin/board", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
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

// ============================================================================
export default function AdminBoard({ initial, brand = "Cerebrum" }) {
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState("ringkasan");
  const [f, setF] = useState(F0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [print, setPrint] = useState(null); // { groups, mode }

  const { projects = [], assignments = [], teachers = [], source, canWrite } = board;
  const readOnly = !canWrite;

  // --- realtime: tarik ulang dari sheet ------------------------------------
  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/board", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setBoard(j);
      setSyncedAt(new Date());
      setErr("");
    } catch (e) {
      setErr("Gagal menyegarkan data: " + e.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const run = useCallback(
    async (payload) => {
      setBusy(true);
      setErr("");
      try {
        await mutate(payload);
        await refresh();
        return true;
      } catch (e) {
        setErr(e.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  // --- indeks bantu ---------------------------------------------------------
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

  // --- opsi filter ----------------------------------------------------------
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

  // --- terapkan filter ke log ----------------------------------------------
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

  // --- angka ringkasan ------------------------------------------------------
  const stat = useMemo(() => {
    const kebutuhan = projects.reduce((a, p) => a + p.kebutuhan, 0);
    const sisa = projects.reduce((a, p) => a + p.sisa, 0);
    const diambil = kebutuhan - sisa;
    // Anggaran total = harga x kebutuhan untuk SELURUH katalog.
    const anggaran = projects.reduce((a, p) => a + p.harga * p.kebutuhan, 0);
    // Yang masih perlu disiapkan = harga x sisa (stok negatif tidak dihitung).
    const anggaranSisa = projects.reduce((a, p) => a + p.harga * Math.max(0, p.sisa), 0);
    // Kewajiban ke guru = SUM kolom Fee tabel hijau (sudah fix dari sheet).
    const feeTotal = assignments.reduce((a, x) => a + x.fee, 0);
    const feeFilter = rows.reduce((a, x) => a + x.fee, 0);
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
      if (!a.guru) return;
      byGuru[a.guru] = (byGuru[a.guru] || 0) + a.fee;
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
      feeFilter,
      byStatus,
      byGuru,
      byPlat,
      pct: kebutuhan ? Math.round((diambil / kebutuhan) * 100) : 0,
      guruAktif: new Set(assignments.map((a) => a.guru).filter(Boolean)).size,
      habis: projects.filter((p) => p.sisa <= 0).length,
      negatif: projects.filter((p) => p.sisa < 0).length,
    };
  }, [projects, assignments, rows]);

  // --- pengelompokan untuk kwitansi ----------------------------------------
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

  const doPrint = useCallback((gs, mode) => {
    if (!gs.length) return;
    setPrint({ groups: gs, mode });
    // biarkan React merender area cetak dulu, baru panggil dialog print
    setTimeout(() => {
      window.print();
      setPrint(null);
    }, 60);
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <div className="admin-bar">
        <div className="tabs">
          {[
            ["ringkasan", "Ringkasan"],
            ["log", `Log Pengambilan (${assignments.length})`],
            ["katalog", `Katalog Proyek (${projects.length})`],
            ["bayar", "Pembayaran & Kwitansi"],
            ["guru", `Database Guru (${teachers.length})`],
          ].map(([k, label]) => (
            <div key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
              {label}
            </div>
          ))}
        </div>
        <div className="sync">
          {syncedAt ? <span className="muted">Sinkron {syncedAt.toLocaleTimeString("id-ID")}</span> : null}
          <button className="btn btn-ghost sm" onClick={refresh} disabled={syncing}>
            {syncing ? "⏳ Menyegarkan…" : "⟳ Segarkan"}
          </button>
        </div>
      </div>

      {readOnly ? (
        <div className="banner sample">
          <span>🔒</span>
          {source === "sample"
            ? "Menampilkan data contoh — kredensial Google Sheets belum diset, jadi perubahan tidak bisa disimpan."
            : "Mode baca-saja — butuh GOOGLE_SERVICE_ACCOUNT_JSON dengan akses Editor agar bisa menyimpan."}
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
        />
      )}

      {tab === "katalog" && <KatalogTable projects={projects} run={run} busy={busy} readOnly={readOnly} />}

      {tab === "bayar" && (
        <Bayar groups={groups} stat={stat} periode={periode} doPrint={doPrint} rows={rows} />
      )}

      {tab === "guru" && <GuruTable teachers={teachers} assignments={assignments} />}

      {print ? <PrintArea groups={print.groups} mode={print.mode} brand={brand} periode={periode} /> : null}
    </>
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

/* ========================= LOG PENGAMBILAN (CRUD) ========================= */
const BLANK_A = {
  tanggal: "",
  idProject: "",
  guru: "",
  idGuru: "",
  subtes: "",
  jumlah: "",
  status: "",
  picSoal: "",
  picVideo: "",
};

function LogTable({ rows, projects, teachers, opts, stat, run, busy, readOnly, platformOf }) {
  const [editRow, setEditRow] = useState(null);
  const [draft, setDraft] = useState(BLANK_A);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const startEdit = (a) => {
    setAdding(false);
    setEditRow(a.row);
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
    });
  };

  // Pilih proyek -> subtes ikut terisi; pilih guru -> ID Guru ikut terisi.
  const onDraft = (k, v) => {
    setDraft((d) => {
      const nd = { ...d, [k]: v };
      if (k === "idProject") {
        const p = projects.find((x) => x.id === v);
        if (p) nd.subtes = p.subtes;
      }
      if (k === "guru") {
        const t = teachers.find((x) => x.nama === v || x.nama.toLowerCase().startsWith(v.toLowerCase()));
        if (t) nd.idGuru = t.idGuru;
      }
      return nd;
    });
  };

  const save = async () => {
    const ok = await run(
      adding
        ? { table: "assignments", action: "create", data: draft }
        : { table: "assignments", action: "update", row: editRow, data: draft }
    );
    if (ok) {
      setEditRow(null);
      setAdding(false);
      setDraft(BLANK_A);
    }
  };

  const del = async (a) => {
    const ok = await run({ table: "assignments", action: "delete", row: a.row });
    if (ok) setConfirm(null);
  };

  const hargaDraft = projects.find((p) => p.id === draft.idProject)?.harga || 0;
  const feePreview = hargaDraft * (parseInt(draft.jumlah, 10) || 0);

  // Sel-sel form dipakai ulang oleh baris "tambah" dan baris "edit".
  const formCells = (
    <>
      <td>
        <input className="input xs" type="date" value={draft.tanggal} onChange={(e) => onDraft("tanggal", e.target.value)} />
      </td>
      <td>
        <select className="select xs" value={draft.idProject} onChange={(e) => onDraft("idProject", e.target.value)}>
          <option value="">— pilih —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} · {p.subtes.slice(0, 34)}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input className="input xs" list="guru-list" value={draft.guru} onChange={(e) => onDraft("guru", e.target.value)} placeholder="Nama guru" />
        <datalist id="guru-list">
          {teachers.map((t) => (
            <option key={t.idGuru} value={t.nama} />
          ))}
        </datalist>
      </td>
      <td>
        <input className="input xs w60" value={draft.idGuru} onChange={(e) => onDraft("idGuru", e.target.value)} />
      </td>
      <td>
        <input className="input xs" value={draft.subtes} onChange={(e) => onDraft("subtes", e.target.value)} />
      </td>
      <td className="num">
        <input className="input xs w70" type="number" min={0} value={draft.jumlah} onChange={(e) => onDraft("jumlah", e.target.value)} />
      </td>
      <td className="num derived" title="Dihitung formula sheet: Jumlah × Harga">
        🔒 {rupiah(feePreview)}
      </td>
      <td>
        <select className="select xs" value={draft.status} onChange={(e) => onDraft("status", e.target.value)}>
          <option value="">—</option>
          {opts.status.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </td>
      <td>
        <input className="input xs w70" value={draft.picSoal} onChange={(e) => onDraft("picSoal", e.target.value)} />
      </td>
      <td>
        <input className="input xs w70" value={draft.picVideo} onChange={(e) => onDraft("picVideo", e.target.value)} />
      </td>
      <td className="derived">🔒 auto</td>
      <td className="act">
        <button className="btn btn-blue xs" onClick={save} disabled={busy}>
          {busy ? "…" : "Simpan"}
        </button>
        <button
          className="btn btn-ghost xs"
          onClick={() => {
            setEditRow(null);
            setAdding(false);
          }}
          disabled={busy}
        >
          Batal
        </button>
      </td>
    </>
  );

  return (
    <>
      <div className="section-head" style={{ marginTop: 18 }}>
        <h2>Log Pengambilan Soal</h2>
        <div className="head-actions">
          <span className="muted">
            Fee tampil: <b>{rupiah(rows.reduce((a, x) => a + x.fee, 0))}</b> · dari total {rupiah(stat.feeTotal)}
          </span>
          <button
            className="btn btn-blue sm"
            disabled={readOnly || busy}
            onClick={() => {
              setEditRow(null);
              setAdding(true);
              setDraft(BLANK_A);
            }}
          >
            ＋ Tambah Baris
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>ID Project</th>
              <th>Guru</th>
              <th>ID Guru</th>
              <th>Subtes</th>
              <th className="num">Jumlah</th>
              <th className="num">Fee 🔒</th>
              <th>Status</th>
              <th>PIC Soal</th>
              <th>PIC Video</th>
              <th>Bulan 🔒</th>
              <th className="act">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {adding ? <tr className="edit-row">{formCells}</tr> : null}
            {rows.length === 0 && !adding ? (
              <tr>
                <td colSpan={12} className="empty">
                  Tidak ada baris yang cocok dengan filter.
                </td>
              </tr>
            ) : null}
            {rows.map((a) =>
              editRow === a.row ? (
                <tr className="edit-row" key={a.row}>
                  {formCells}
                </tr>
              ) : (
                <tr key={a.row}>
                  <td>{tglID(a.tanggal) || "—"}</td>
                  <td>
                    <span className="mono">{a.idProject || "—"}</span>
                    {platformOf(a) ? <div className="muted xs2">{platformOf(a)}</div> : null}
                  </td>
                  <td>{a.guru || "—"}</td>
                  <td className="mono">{a.idGuru || "—"}</td>
                  <td className="wrap">{a.subtes || "—"}</td>
                  <td className="num">{a.jumlah ? numberID(a.jumlah) : "—"}</td>
                  <td className="num derived">{a.fee ? rupiah(a.fee) : "—"}</td>
                  <td>{statusPill(a.status)}</td>
                  <td>{a.picSoal || "—"}</td>
                  <td>{a.picVideo || "—"}</td>
                  <td className="derived">{a.bulan || "—"}</td>
                  <td className="act">
                    <button className="btn btn-ghost xs" onClick={() => startEdit(a)} disabled={readOnly || busy}>
                      Edit
                    </button>
                    <button className="btn btn-red xs" onClick={() => setConfirm(a)} disabled={readOnly || busy}>
                      Hapus
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {confirm ? (
        <ConfirmDelete
          title="Hapus baris log ini?"
          detail={`${confirm.guru || "(tanpa guru)"} · ${confirm.subtes || confirm.idProject} · ${
            confirm.jumlah || 0
          } soal · ${rupiah(confirm.fee)}`}
          onCancel={() => setConfirm(null)}
          onOk={() => del(confirm)}
          busy={busy}
        />
      ) : null}
    </>
  );
}

/* =========================== KATALOG (CRUD) =============================== */
const BLANK_P = { id: "", platform: "", subtes: "", output: "", harga: "", kebutuhan: "" };

function KatalogTable({ projects, run, busy, readOnly }) {
  const [editRow, setEditRow] = useState(null);
  const [draft, setDraft] = useState(BLANK_P);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? projects.filter((p) => `${p.id} ${p.platform} ${p.subtes} ${p.output}`.toLowerCase().includes(s)) : projects;
  }, [projects, q]);

  const save = async () => {
    const ok = await run(
      adding ? { table: "projects", action: "create", data: draft } : { table: "projects", action: "update", row: editRow, data: draft }
    );
    if (ok) {
      setEditRow(null);
      setAdding(false);
      setDraft(BLANK_P);
    }
  };

  const d = (k) => (e) => setDraft((p) => ({ ...p, [k]: e.target.value }));

  const formCells = (
    <>
      <td>
        <input className="input xs w90" value={draft.id} onChange={d("id")} placeholder="ASN-xx" />
      </td>
      <td>
        <input className="input xs w90" value={draft.platform} onChange={d("platform")} />
      </td>
      <td>
        <input className="input xs" value={draft.subtes} onChange={d("subtes")} />
      </td>
      <td>
        <input className="input xs" value={draft.output} onChange={d("output")} />
      </td>
      <td className="num">
        <input className="input xs w90" type="number" min={0} value={draft.harga} onChange={d("harga")} />
      </td>
      <td className="num">
        <input className="input xs w70" type="number" min={0} value={draft.kebutuhan} onChange={d("kebutuhan")} />
      </td>
      <td className="num derived" title="Dihitung formula sheet: Kebutuhan − jumlah yang sudah diambil">
        🔒 auto
      </td>
      <td className="act">
        <button className="btn btn-blue xs" onClick={save} disabled={busy}>
          {busy ? "…" : "Simpan"}
        </button>
        <button
          className="btn btn-ghost xs"
          onClick={() => {
            setEditRow(null);
            setAdding(false);
          }}
          disabled={busy}
        >
          Batal
        </button>
      </td>
    </>
  );

  return (
    <>
      <div className="section-head" style={{ marginTop: 18 }}>
        <h2>Katalog Proyek</h2>
        <div className="head-actions">
          <input className="input sm" placeholder="Cari ID, platform, subtes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button
            className="btn btn-blue sm"
            disabled={readOnly || busy}
            onClick={() => {
              setEditRow(null);
              setAdding(true);
              setDraft(BLANK_P);
            }}
          >
            ＋ Tambah Proyek
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>ID Project</th>
              <th>Platform</th>
              <th>Subtes</th>
              <th>Output</th>
              <th className="num">Harga</th>
              <th className="num">Kebutuhan</th>
              <th className="num">Sisa 🔒</th>
              <th className="act">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {adding ? <tr className="edit-row">{formCells}</tr> : null}
            {list.map((p) =>
              editRow === p.row ? (
                <tr className="edit-row" key={p.row}>
                  {formCells}
                </tr>
              ) : (
                <tr key={p.row} className={p.sisa <= 0 ? "row-dim" : ""}>
                  <td className="mono">{p.id}</td>
                  <td>{p.platform || "—"}</td>
                  <td className="wrap">{p.subtes}</td>
                  <td>{p.output || "—"}</td>
                  <td className="num">{rupiah(p.harga)}</td>
                  <td className="num">{numberID(p.kebutuhan)}</td>
                  <td className={"num derived" + (p.sisa < 0 ? " neg" : "")}>{numberID(p.sisa)}</td>
                  <td className="act">
                    <button
                      className="btn btn-ghost xs"
                      disabled={readOnly || busy}
                      onClick={() => {
                        setAdding(false);
                        setEditRow(p.row);
                        setDraft({
                          id: p.id,
                          platform: p.platform,
                          subtes: p.subtes,
                          output: p.output,
                          harga: p.harga,
                          kebutuhan: p.kebutuhan,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-red xs" onClick={() => setConfirm(p)} disabled={readOnly || busy}>
                      Hapus
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

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
function Bayar({ groups, stat, periode, doPrint, rows }) {
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

      <div className="table-wrap">
        <table className="grid-table">
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
                <td>
                  <b>{g.teacher?.nama || g.guru}</b>
                  {g.teacher?.nama && g.teacher.nama !== g.guru ? <div className="muted xs2">di log: {g.guru}</div> : null}
                </td>
                <td className="mono">{g.teacher?.rekening || <span className="neg">— belum ada —</span>}</td>
                <td>{g.teacher?.pemilikRekening || "—"}</td>
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

/* ============================ DATABASE GURU =============================== */
function GuruTable({ teachers, assignments }) {
  const [q, setQ] = useState("");
  const feeByGuru = useMemo(() => {
    const m = new Map();
    assignments.forEach((a) => {
      const k = String(a.idGuru || "");
      if (!k) return;
      m.set(k, (m.get(k) || 0) + a.fee);
    });
    return m;
  }, [assignments]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? teachers.filter((t) => `${t.idGuru} ${t.nama} ${t.rekening} ${t.status}`.toLowerCase().includes(s)) : teachers;
  }, [teachers, q]);

  return (
    <>
      <div className="section-head" style={{ marginTop: 18 }}>
        <h2>Database Guru Freelance</h2>
        <div className="head-actions">
          <input className="input sm" placeholder="Cari nama, ID, rekening…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama Lengkap</th>
              <th>Status</th>
              <th>Nomor Rekening</th>
              <th>a.n.</th>
              <th>WhatsApp</th>
              <th className="num">Fee Tercatat</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.idGuru + t.nama}>
                <td className="mono">{t.idGuru}</td>
                <td>{t.nama}</td>
                <td>{t.status || "—"}</td>
                <td className="mono">{t.rekening || <span className="neg">— belum ada —</span>}</td>
                <td>{t.pemilikRekening || "—"}</td>
                <td className="mono">{t.wa || "—"}</td>
                <td className="num">{feeByGuru.get(String(t.idGuru)) ? rupiah(feeByGuru.get(String(t.idGuru))) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============================ KONFIRMASI ================================== */
function ConfirmDelete({ title, detail, warn, onCancel, onOk, busy }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🗑 {title}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-sub">{detail}</p>
          <p className="modal-sub">
            Baris akan dihapus dari spreadsheet dan baris di bawahnya digeser naik. Tindakan ini tidak bisa
            dibatalkan dari sini.
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
