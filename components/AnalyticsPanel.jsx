"use client";

// ============================================================================
//  "Analisis" — pandangan lintas bulan.
//  Semua pengelompokan memakai ID Subtes (kolom V) dari Master_Project, bukan
//  nama subtes, sehingga subtes yang sama tetap terhitung satu walau ID
//  bulanannya berbeda-beda.
// ============================================================================

import { useMemo, useState } from "react";
import { rupiah, numberID, isBatal } from "@/lib/format";

function Bars({ data, fmt = numberID, color, max: maxProp }) {
  if (!data.length) return <div className="empty">Belum ada data.</div>;
  const max = maxProp || Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div>
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="lbl" title={d.label}>{d.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: Math.min(100, (Math.abs(d.value) / max) * 100) + "%", background: color || undefined }} />
          </div>
          <div className="val">{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPanel({ data, master }) {
  const { months = [], catalog = [], log = [] } = data || {};
  const [bulanFilter, setBulanFilter] = useState("Semua");

  const namaOf = useMemo(() => {
    const m = new Map(master.map((x) => [x.id, x.subtes]));
    return (id, fallback) => m.get(id) || fallback || id || "—";
  }, [master]);
  const katOf = useMemo(() => {
    const m = new Map(master.map((x) => [x.id, x.kategori]));
    return (id) => m.get(id) || "Tanpa kategori";
  }, [master]);

  const cat = useMemo(() => (bulanFilter === "Semua" ? catalog : catalog.filter((c) => c.bulan === bulanFilter)), [catalog, bulanFilter]);
  // Baris Cancel tidak dihitung sebagai pekerjaan (soal, guru aktif, fee); hanya
  // rincian per status yang tetap memakai semua baris supaya batalnya terlihat.
  const lgSemua = useMemo(() => (bulanFilter === "Semua" ? log : log.filter((l) => l.bulan === bulanFilter)), [log, bulanFilter]);
  const lg = useMemo(() => lgSemua.filter((l) => !isBatal(l.status)), [lgSemua]);

  // ---- ringkasan per bulan -------------------------------------------------
  const perBulan = useMemo(() => {
    const m = new Map();
    months.forEach((mo) => m.set(mo.bulan, { bulan: mo.bulan, keb: 0, sisa: 0, anggaran: 0, fee: 0, baris: 0, guru: new Set() }));
    catalog.forEach((c) => {
      const x = m.get(c.bulan); if (!x) return;
      x.keb += c.kebutuhan; x.sisa += c.sisa; x.anggaran += c.harga * c.kebutuhan; x.baris++;
    });
    log.forEach((l) => {
      const x = m.get(l.bulan); if (!x || isBatal(l.status)) return;
      x.fee += l.fee; if (l.guru) x.guru.add(l.guru);
    });
    return [...m.values()].map((x) => ({ ...x, diambil: x.keb - x.sisa, guru: x.guru.size, serap: x.keb ? Math.round(((x.keb - x.sisa) / x.keb) * 100) : 0 }));
  }, [months, catalog, log]);

  // ---- agregat per subtes (lintas bulan) ----------------------------------
  const perSubtes = useMemo(() => {
    const m = new Map();
    cat.forEach((c) => {
      const k = c.idSubtes || "?" + c.subtes;
      if (!m.has(k)) m.set(k, { id: c.idSubtes, nama: namaOf(c.idSubtes, c.subtes), kat: katOf(c.idSubtes), keb: 0, sisa: 0, anggaran: 0, bulan: new Set() });
      const x = m.get(k);
      x.keb += c.kebutuhan; x.sisa += c.sisa; x.anggaran += c.harga * c.kebutuhan; x.bulan.add(c.bulan);
    });
    return [...m.values()].map((x) => ({ ...x, diambil: x.keb - x.sisa, bulan: x.bulan.size, serap: x.keb ? (x.keb - x.sisa) / x.keb : 0 }));
  }, [cat, namaOf, katOf]);

  const mangkrak = useMemo(() => perSubtes.filter((s) => s.sisa > 0).sort((a, b) => b.sisa - a.sisa).slice(0, 12), [perSubtes]);
  const terlaris = useMemo(() => perSubtes.filter((s) => s.diambil > 0).sort((a, b) => b.diambil - a.diambil).slice(0, 12), [perSubtes]);

  // ---- guru ----------------------------------------------------------------
  const perGuru = useMemo(() => {
    const m = new Map();
    lg.forEach((l) => {
      if (!l.guru) return;
      if (!m.has(l.guru)) m.set(l.guru, { guru: l.guru, fee: 0, soal: 0, baris: 0, bulan: new Set(), status: {} });
      const x = m.get(l.guru);
      x.fee += l.fee; x.soal += l.jumlah; x.baris++; x.bulan.add(l.bulan);
      const s = l.status || "(kosong)"; x.status[s] = (x.status[s] || 0) + 1;
    });
    return [...m.values()].map((x) => ({ ...x, bulan: x.bulan.size, rata: x.baris ? Math.round(x.soal / x.baris) : 0 })).sort((a, b) => b.fee - a.fee);
  }, [lg]);

  // ---- PIC QC --------------------------------------------------------------
  const perPic = useMemo(() => {
    const m = new Map();
    lg.forEach((l) => {
      [["Soal", l.picSoal], ["Video", l.picVideo]].forEach(([jenis, nama]) => {
        if (!nama) return;
        const k = nama;
        if (!m.has(k)) m.set(k, { pic: nama, soal: 0, video: 0, total: 0 });
        const x = m.get(k);
        if (jenis === "Soal") x.soal++; else x.video++;
        x.total++;
      });
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [lg]);

  // ---- status & kategori ---------------------------------------------------
  const perStatus = useMemo(() => {
    const m = {};
    lgSemua.forEach((l) => { const k = l.status || "(kosong)"; m[k] = m[k] || { fee: 0, soal: 0, n: 0 }; m[k].fee += l.fee; m[k].soal += l.jumlah; m[k].n++; });
    return Object.entries(m).sort((a, b) => b[1].fee - a[1].fee);
  }, [lgSemua]);

  const perKategori = useMemo(() => {
    const m = {};
    cat.forEach((c) => { const k = katOf(c.idSubtes); m[k] = m[k] || { keb: 0, sisa: 0, anggaran: 0 }; m[k].keb += c.kebutuhan; m[k].sisa += c.sisa; m[k].anggaran += c.harga * c.kebutuhan; });
    return Object.entries(m).map(([k, v]) => ({ kategori: k, ...v, diambil: v.keb - v.sisa })).sort((a, b) => b.keb - a.keb);
  }, [cat, katOf]);

  // ---- perubahan harga antar bulan ----------------------------------------
  const gantiHarga = useMemo(() => {
    const m = new Map();
    catalog.forEach((c) => {
      if (!c.idSubtes || !c.harga) return;
      const k = c.idSubtes + "|" + c.output;
      if (!m.has(k)) m.set(k, { id: c.idSubtes, nama: namaOf(c.idSubtes, c.subtes), output: c.output, harga: new Map() });
      m.get(k).harga.set(c.bulan, c.harga);
    });
    return [...m.values()]
      .map((x) => { const v = [...x.harga.values()]; return { ...x, list: [...x.harga.entries()], min: Math.min(...v), max: Math.max(...v) }; })
      .filter((x) => x.min !== x.max)
      .sort((a, b) => b.max - b.min - (a.max - a.min));
  }, [catalog, namaOf]);

  const tot = useMemo(() => ({
    keb: cat.reduce((a, c) => a + c.kebutuhan, 0),
    sisa: cat.reduce((a, c) => a + c.sisa, 0),
    anggaran: cat.reduce((a, c) => a + c.harga * c.kebutuhan, 0),
    fee: lg.reduce((a, l) => a + l.fee, 0),
    soal: lg.reduce((a, l) => a + l.jumlah, 0),
  }), [cat, lg]);

  const overrun = useMemo(() => cat.filter((c) => c.sisa < 0), [cat]);

  return (
    <>
      <div className="controls" style={{ marginTop: 18 }}>
        <div className="chips">
          {["Semua", ...months.map((m) => m.bulan)].map((b) => (
            <button key={b} className={"chip" + (bulanFilter === b ? " active" : "")} onClick={() => setBulanFilter(b)}>{b}</button>
          ))}
        </div>
      </div>

      <div className="grid stat-grid">
        <div className="card stat"><div className="label">Kebutuhan</div><div className="value navy">{numberID(tot.keb)}</div><div className="sub">{cat.length} baris anggaran</div></div>
        <div className="card stat"><div className="label">Sudah Diambil</div><div className="value green">{numberID(tot.keb - tot.sisa)}</div><div className="sub">{tot.keb ? Math.round(((tot.keb - tot.sisa) / tot.keb) * 100) : 0}% terserap</div></div>
        <div className="card stat"><div className="label">Sisa</div><div className="value amber">{numberID(tot.sisa)}</div><div className="sub">{overrun.length ? overrun.length + " baris kelebihan ambil" : "belum diambil"}</div></div>
        <div className="card stat hi"><div className="label">Anggaran</div><div className="value navy">{rupiah(tot.anggaran)}</div><div className="sub">harga × kebutuhan</div></div>
        <div className="card stat hi"><div className="label">Fee Tercatat</div><div className="value green">{rupiah(tot.fee)}</div><div className="sub">{numberID(tot.soal)} soal dikerjakan</div></div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}><h2>Perbandingan Antar Bulan</h2><span className="muted">seluruh periode</span></div>
      <div className="table-wrap fixed">
        <table className="grid-table">
          <colgroup>{[12, 10, 11, 10, 11, 15, 15, 8, 8].map((w, i) => <col key={i} style={{ width: w + "%" }} />)}</colgroup>
          <thead>
            <tr><th>Bulan</th><th className="num">Baris</th><th className="num">Kebutuhan</th><th className="num">Diambil</th><th className="num">Sisa</th>
              <th className="num">Anggaran</th><th className="num">Fee Tercatat</th><th className="num">Guru</th><th className="num">Serap</th></tr>
          </thead>
          <tbody>
            {perBulan.map((b) => (
              <tr key={b.bulan}>
                <td><b>{b.bulan}</b></td>
                <td className="num">{numberID(b.baris)}</td>
                <td className="num">{numberID(b.keb)}</td>
                <td className="num">{numberID(b.diambil)}</td>
                <td className={"num" + (b.sisa < 0 ? " neg" : "")}>{numberID(b.sisa)}</td>
                <td className="num">{rupiah(b.anggaran)}</td>
                <td className="num">{rupiah(b.fee)}</td>
                <td className="num">{numberID(b.guru)}</td>
                <td className="num"><b>{b.serap}%</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="card card-p">
          <div className="section-head"><h2>Paling Banyak Dikerjakan</h2><span className="muted">soal diambil</span></div>
          <Bars data={terlaris.map((s) => ({ label: s.nama.slice(0, 34), value: s.diambil }))} />
        </div>
        <div className="card card-p">
          <div className="section-head"><h2>Paling Mangkrak</h2><span className="muted">sisa belum diambil</span></div>
          <Bars data={mangkrak.map((s) => ({ label: s.nama.slice(0, 34), value: s.sisa }))} color="linear-gradient(90deg,#fbbf24,#d97706)" />
        </div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="card card-p">
          <div className="section-head"><h2>Kebutuhan per Kategori</h2></div>
          <Bars data={perKategori.map((k) => ({ label: k.kategori, value: k.keb }))} />
        </div>
        <div className="card card-p">
          <div className="section-head"><h2>Fee per Status</h2></div>
          <Bars data={perStatus.map(([k, v]) => ({ label: k, value: v.fee }))} fmt={rupiah} color="linear-gradient(90deg,#34d399,#059669)" />
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}><h2>Produktivitas Guru</h2><span className="muted">{perGuru.length} guru</span></div>
      <div className="table-wrap fixed">
        <table className="grid-table">
          <colgroup>{[26, 11, 12, 11, 13, 18, 9].map((w, i) => <col key={i} style={{ width: w + "%" }} />)}</colgroup>
          <thead>
            <tr><th>Guru</th><th className="num">Baris</th><th className="num">Soal</th><th className="num">Rata/baris</th>
              <th className="num">Bulan Aktif</th><th className="num">Total Fee</th><th className="num">Share</th></tr>
          </thead>
          <tbody>
            {perGuru.length === 0 ? <tr><td colSpan={7} className="empty">Belum ada data.</td></tr> : null}
            {perGuru.map((g) => (
              <tr key={g.guru}>
                <td className="wrap"><b>{g.guru}</b></td>
                <td className="num">{numberID(g.baris)}</td>
                <td className="num">{numberID(g.soal)}</td>
                <td className="num">{numberID(g.rata)}</td>
                <td className="num">{g.bulan}</td>
                <td className="num"><b>{rupiah(g.fee)}</b></td>
                <td className="num">{tot.fee ? Math.round((g.fee / tot.fee) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="card card-p">
          <div className="section-head"><h2>Beban PIC QC</h2><span className="muted">jumlah baris ditangani</span></div>
          <Bars data={perPic.map((p) => ({ label: p.pic, value: p.total }))} color="linear-gradient(90deg,#c4b5fd,#7c3aed)" />
          <div className="muted" style={{ marginTop: 8 }}>
            {perPic.map((p) => `${p.pic}: ${p.soal} soal / ${p.video} video`).join("  ·  ")}
          </div>
        </div>
        <div className="card card-p">
          <div className="section-head"><h2>Harga Berubah Antar Bulan</h2><span className="muted">{gantiHarga.length} item</span></div>
          {gantiHarga.length === 0 ? <div className="empty">Harga stabil.</div> : (
            <div className="pricelist">
              {gantiHarga.slice(0, 10).map((x) => (
                <div className="pr" key={x.id + x.output}>
                  <div className="pr-n">{x.nama}<span className="muted xs2"> · {x.output}</span></div>
                  <div className="pr-v">{x.list.map(([b, h]) => <span key={b}><i>{b.slice(0, 3)}</i> {rupiah(h)}</span>)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {overrun.length ? (
        <>
          <div className="section-head" style={{ marginTop: 22 }}>
            <h2>Kelebihan Ambil</h2><span className="muted">sisa negatif — dikerjakan melebihi kebutuhan</span>
          </div>
          <div className="table-wrap fixed">
            <table className="grid-table">
              <colgroup>{[12, 30, 16, 14, 14, 14].map((w, i) => <col key={i} style={{ width: w + "%" }} />)}</colgroup>
              <thead><tr><th>Bulan</th><th>Subtes</th><th>Kode Baris</th><th className="num">Kebutuhan</th><th className="num">Sisa</th><th className="num">Kelebihan</th></tr></thead>
              <tbody>
                {overrun.map((c) => (
                  <tr key={c.tab + c.row}>
                    <td>{c.bulan}</td>
                    <td className="wrap">{namaOf(c.idSubtes, c.subtes)}</td>
                    <td className="mono">{c.kode}</td>
                    <td className="num">{numberID(c.kebutuhan)}</td>
                    <td className="num neg">{numberID(c.sisa)}</td>
                    <td className="num neg">{numberID(-c.sisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
