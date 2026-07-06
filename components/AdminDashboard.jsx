"use client";
import { useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const monthIdx = (m) => { const i = MONTHS.findIndex((x) => x.toLowerCase() === String(m||"").toLowerCase()); return i === -1 ? 99 : i; };

function Bars({ data, fmt = numberID, color }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="lbl" title={d.label}>{d.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: (d.value / max) * 100 + "%", background: color || undefined }} />
          </div>
          <div className="val">{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

function statusPill(s) {
  const t = (s || "").toLowerCase();
  if (t.includes("paid")) return <span className="pill paid">{s}</span>;
  if (t.includes("qc")) return <span className="pill qc">{s}</span>;
  if (t.includes("appro")) return <span className="pill appr">{s}</span>;
  if (t.includes("run")) return <span className="pill run">{s}</span>;
  return <span className="pill run">{s || "-"}</span>;
}

export default function AdminDashboard({ projects, feeLog, recaps, teachers }) {
  const [tab, setTab] = useState("ringkasan");
  return (
    <>
      <div className="tabs">
        <div className={"tab" + (tab === "ringkasan" ? " active" : "")} onClick={() => setTab("ringkasan")}>Ringkasan &amp; Progress</div>
        <div className={"tab" + (tab === "fee" ? " active" : "")} onClick={() => setTab("fee")}>Rekap Fee</div>
        <div className={"tab" + (tab === "guru" ? " active" : "")} onClick={() => setTab("guru")}>Database Guru</div>
      </div>
      {tab === "ringkasan" && <Ringkasan projects={projects} feeLog={feeLog} />}
      {tab === "fee" && <RekapFee recaps={recaps} />}
      {tab === "guru" && <Guru teachers={teachers} />}
    </>
  );
}

/* ---------------- RINGKASAN ---------------- */
function Ringkasan({ projects, feeLog }) {
  const s = useMemo(() => {
    const keb = projects.reduce((a, p) => a + p.kebutuhan, 0);
    const sisa = projects.reduce((a, p) => a + p.sisa, 0);
    const done = keb - sisa;
    const potensi = projects.reduce((a, p) => a + p.kebutuhan * p.harga, 0);
    const byPlat = {};
    for (const p of projects) {
      const k = p.platform || "Lainnya";
      byPlat[k] = byPlat[k] || { keb: 0, sisa: 0 };
      byPlat[k].keb += p.kebutuhan;
      byPlat[k].sisa += p.sisa;
    }
    const feePaid = feeLog.filter((f) => (f.status||"").toLowerCase().includes("paid")).reduce((a, f) => a + f.fee, 0);
    const feeAll = feeLog.reduce((a, f) => a + f.fee, 0);
    const byMonth = {};
    for (const f of feeLog) { const m = f.bulan || "?"; byMonth[m] = (byMonth[m] || 0) + f.fee; }
    return { keb, sisa, done, potensi, byPlat, feePaid, feeAll, byMonth };
  }, [projects, feeLog]);

  const pct = s.keb ? Math.round((s.done / s.keb) * 100) : 0;
  const platBars = Object.entries(s.byPlat).map(([label, v]) => ({ label, value: v.keb - v.sisa, keb: v.keb }));
  const monthBars = Object.entries(s.byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));

  return (
    <>
      <div className="grid stat-grid">
        <div className="card stat"><div className="label">Total Proyek</div><div className="value blue">{numberID(projects.length)}</div><div className="sub">subtes terdaftar</div></div>
        <div className="card stat"><div className="label">Kebutuhan Soal</div><div className="value navy">{numberID(s.keb)}</div><div className="sub">total target</div></div>
        <div className="card stat"><div className="label">Sisa</div><div className="value amber">{numberID(s.sisa)}</div><div className="sub">belum dikerjakan</div></div>
        <div className="card stat"><div className="label">Progress</div><div className="value green">{pct}%</div><div className="sub">{numberID(s.done)} soal selesai</div></div>
        <div className="card stat"><div className="label">Fee Terbayar</div><div className="value green">{rupiah(s.feePaid)}</div><div className="sub">dari {rupiah(s.feeAll)} tercatat</div></div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="card card-p">
          <div className="section-head"><h2>Progress per Platform</h2><span className="muted">soal selesai / kebutuhan</span></div>
          <Bars data={platBars.map((b) => ({ label: b.label, value: b.value }))} fmt={(v) => numberID(v)} />
          <div className="muted" style={{ marginTop: 8 }}>
            {platBars.map((b) => `${b.label}: ${numberID(b.value)}/${numberID(b.keb)}`).join("  ·  ")}
          </div>
        </div>
        <div className="card card-p">
          <div className="section-head"><h2>Fee per Bulan (log master)</h2><span className="muted">transaksi tercatat</span></div>
          {monthBars.length ? <Bars data={monthBars} fmt={rupiah} color="linear-gradient(90deg,#34d399,#059669)" /> : <div className="empty">Belum ada data.</div>}
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}><h2>Transaksi Fee Terbaru</h2><span className="muted">{feeLog.length} baris</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tanggal</th><th>ID</th><th>Guru</th><th>Subtes</th><th className="num">Jumlah</th><th className="num">Fee</th><th>Status</th><th>PIC</th></tr></thead>
          <tbody>
            {feeLog.map((f, i) => (
              <tr key={i}>
                <td>{f.tanggal}</td><td>{f.idProject}</td><td>{f.guru}</td>
                <td className="wrap">{f.subtes}</td>
                <td className="num">{numberID(f.jumlah)}</td>
                <td className="num">{rupiah(f.fee)}</td>
                <td>{statusPill(f.status)}</td><td>{f.pic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- REKAP FEE ---------------- */
function RekapFee({ recaps }) {
  const months = useMemo(() => Array.from(new Set(recaps.map((r) => r.bulan))).sort((a, b) => monthIdx(a) - monthIdx(b)), [recaps]);
  const cats = useMemo(() => Array.from(new Set(recaps.map((r) => r.kategori))), [recaps]);
  const [month, setMonth] = useState("Semua");
  const [cat, setCat] = useState("Semua");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => recaps.filter((r) =>
    (month === "Semua" || r.bulan === month) &&
    (cat === "Semua" || r.kategori === cat) &&
    (!q || `${r.nama} ${r.project} ${r.platform}`.toLowerCase().includes(q.toLowerCase()))
  ), [recaps, month, cat, q]);

  const total = filtered.reduce((a, r) => a + r.totalFee, 0);
  const orang = new Set(filtered.map((r) => r.nama)).size;
  const byMonth = useMemo(() => {
    const m = {};
    for (const r of recaps) m[r.bulan] = (m[r.bulan] || 0) + r.totalFee;
    return Object.entries(m).sort((a, b) => monthIdx(a[0]) - monthIdx(b[0])).map(([label, value]) => ({ label, value }));
  }, [recaps]);
  const byCat = useMemo(() => {
    const m = {};
    for (const r of filtered) m[r.kategori] = (m[r.kategori] || 0) + r.totalFee;
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  }, [filtered]);

  return (
    <>
      <div className="grid stat-grid">
        <div className="card stat"><div className="label">Total Fee (filter)</div><div className="value green">{rupiah(total)}</div><div className="sub">{filtered.length} pembayaran</div></div>
        <div className="card stat"><div className="label">Jumlah Guru</div><div className="value blue">{numberID(orang)}</div><div className="sub">penerima fee</div></div>
        <div className="card stat"><div className="label">Bulan Tercatat</div><div className="value navy">{months.length}</div><div className="sub">{months.join(", ")}</div></div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="card card-p">
          <div className="section-head"><h2>Fee per Bulan</h2></div>
          <Bars data={byMonth} fmt={rupiah} color="linear-gradient(90deg,#34d399,#059669)" />
        </div>
        <div className="card card-p">
          <div className="section-head"><h2>Fee per Kategori (filter)</h2></div>
          {byCat.length ? <Bars data={byCat} fmt={rupiah} /> : <div className="empty">—</div>}
        </div>
      </div>

      <div className="controls" style={{ marginTop: 18 }}>
        <input className="input" placeholder="Cari nama / project…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option>Semua</option>{months.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option>Semua</option>{cats.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Bulan</th><th>Kategori</th><th>Nama</th><th>Platform</th><th>Project</th><th className="num">Jumlah</th><th className="num">Total Fee</th></tr></thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td>{r.bulan}</td><td>{r.kategori}</td><td>{r.nama}</td>
                <td>{r.platform}</td><td className="wrap">{r.project}</td>
                <td className="num">{numberID(r.jumlah)}</td>
                <td className="num">{rupiah(r.totalFee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- DATABASE GURU ---------------- */
function Guru({ teachers }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Semua");
  const statuses = useMemo(() => ["Semua", ...Array.from(new Set(teachers.map((t) => t.status).filter(Boolean)))], [teachers]);
  const filtered = useMemo(() => teachers.filter((t) =>
    (status === "Semua" || t.status === status) &&
    (!q || `${t.nama} ${t.bidang} ${t.universitas} ${t.jurusan} ${t.pekerjaan}`.toLowerCase().includes(q.toLowerCase()))
  ), [teachers, q, status]);
  const kapAvg = teachers.length ? (teachers.reduce((a, t) => a + (t.kapasitas || 0), 0) / teachers.length).toFixed(1) : 0;

  return (
    <>
      <div className="grid stat-grid">
        <div className="card stat"><div className="label">Total Guru</div><div className="value blue">{numberID(teachers.length)}</div><div className="sub">terdaftar</div></div>
        <div className="card stat"><div className="label">Hasil Filter</div><div className="value navy">{numberID(filtered.length)}</div><div className="sub">guru tampil</div></div>
        <div className="card stat"><div className="label">Rata-rata Kapasitas</div><div className="value green">{kapAvg}</div><div className="sub">proyek/minggu</div></div>
      </div>

      <div className="controls" style={{ marginTop: 18 }}>
        <input className="input" placeholder="Cari nama, bidang, universitas…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nama</th><th>Status</th><th>Pendidikan</th><th>Universitas</th><th>Bidang Materi</th><th className="num">Kapasitas</th><th>Live Class</th></tr></thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{t.nama}</td>
                <td>{t.status}</td>
                <td>{t.pendidikan}</td>
                <td className="wrap">{t.universitas}</td>
                <td className="wrap">{t.bidang}</td>
                <td className="num">{t.kapasitas || "-"}</td>
                <td>{t.liveClass}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
