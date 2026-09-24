"use client";

// ============================================================================
//  "Proyek Bulan Baru" — admin menyusun anggaran bulan berikutnya.
//  Subtes selalu diambil dari Master_Project (ID tinggal ikut), harga terisi
//  default dari master tapi boleh diubah khusus untuk bulan itu.
// ============================================================================

import { useMemo, useState } from "react";
import { rupiah, numberID, parseHarga, formatHarga, cekHargaBulanan } from "@/lib/format";
import Icon from "./Icon";
import MasterPicker, { aktifkanKembali } from "./MasterPicker";

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const OUTPUTS = ["Lengkap", "Video Pembahasan", "Soal & Pembahasan", "Liveclass"];

const hargaRaw = (m, output) =>
  ({ "Lengkap": m?.hargaLengkap, "Video Pembahasan": m?.hargaVideo, "Soal & Pembahasan": m?.hargaSoal, "Liveclass": m?.hargaLive }[output]) || "";
// Rentang tentatif -> ambil batas bawah sebagai isian awal.
const hargaDefault = (m, output) => { const h = parseHarga(hargaRaw(m, output)); return h.ada ? h.min : ""; };

async function api(payload) {
  const res = await fetch("/api/admin/months", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
  return j;
}

export default function NewMonthPanel({ master, months, semuaBulan = [], readOnly, busy, setBusy, setErr, onDone }) {
  // Termasuk bulan tersembunyi: sheet Juni–Agustus masih ada, jadi jangan
  // ditawarkan untuk dibuat ulang.
  const sudahAda = useMemo(() => new Set([...semuaBulan, ...months.map((m) => m.bulan)]), [months, semuaBulan]);
  const belumAda = BULAN.filter((b) => !sudahAda.has(b));

  const [mode, setMode] = useState(belumAda.length ? "baru" : "tambah");
  const [bulanBaru, setBulanBaru] = useState(belumAda[0] || "");
  const [tabTarget, setTabTarget] = useState(months.length ? months[months.length - 1].tab : "");
  const [lines, setLines] = useState([]);



  const tambah = (m) => {
    const output = (m.output || "").split(",")[0].trim() || "Lengkap";
    setLines((p) => [...p, {
      key: m.id + "-" + p.length,
      idSubtes: m.id, subtes: m.subtes, kategori: m.kategori,
      platform: m.platform || "", output, harga: hargaDefault(m, output) || "", kebutuhan: "",
    }]);
  };
  const ubah = (i, k, v) =>
    setLines((p) => p.map((ln, idx) => {
      if (idx !== i) return ln;
      const nx = { ...ln, [k]: v };
      if (k === "output") {
        const m = master.find((x) => x.id === ln.idSubtes);
        if (m) nx.harga = hargaDefault(m, v) || nx.harga;
      }
      return nx;
    }));
  const hapus = (i) => setLines((p) => p.filter((_, idx) => idx !== i));

  const totalSoal = lines.reduce((a, l) => a + (parseInt(l.kebutuhan, 10) || 0), 0);
  const hargaOk = (l) => cekHargaBulanan(l.harga);
  const totalRp = lines.reduce((a, l) => { const c = hargaOk(l); return a + (parseInt(l.kebutuhan, 10) || 0) * (c.ok ? c.nilai : 0); }, 0);
  const belumLengkap = lines.filter((l) => !l.kebutuhan || !hargaOk(l).ok).length;
  const hargaSalah = lines.filter((l) => String(l.harga).trim() && !hargaOk(l).ok);

  const simpan = async () => {
    setBusy(true);
    setErr("");
    try {
      const payload = lines.map((l) => ({
        idSubtes: l.idSubtes, subtes: l.subtes, platform: l.platform,
        output: l.output, harga: l.harga, kebutuhan: l.kebutuhan,
      }));
      if (mode === "baru") await api({ action: "createMonth", bulan: bulanBaru, lines: payload });
      else await api({ action: "addLines", tab: tabTarget, lines: payload });
      // Subtes arsip yang dianggarkan lagi diaktifkan kembali di master —
      // setelah baris anggarannya tersimpan.
      await aktifkanKembali(master.filter((m) => lines.some((l) => l.idSubtes === m.id)));
      setLines([]);
      await onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="section-head"><h2>Susun anggaran proyek</h2></div>
        <div className="filters">
          <label className="fl">
            <span>Tujuan</span>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="baru" disabled={!belumAda.length}>Buat bulan baru</option>
              <option value="tambah">Tambah ke bulan yang ada</option>
            </select>
          </label>
          {mode === "baru" ? (
            <label className="fl">
              <span>Bulan</span>
              <select className="select" value={bulanBaru} onChange={(e) => setBulanBaru(e.target.value)}>
                {belumAda.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
          ) : (
            <label className="fl">
              <span>Sheet tujuan</span>
              <select className="select" value={tabTarget} onChange={(e) => setTabTarget(e.target.value)}>
                {months.map((m) => <option key={m.tab} value={m.tab}>{m.bulan}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="ffield">
          <span>Tambah subtes dari master — klik untuk menambah satu baris anggaran</span>
          <MasterPicker master={master} onPick={tambah} dipilih={lines.map((l) => l.idSubtes)} />
        </div>
      </div>

      <div className="section-head">
        <h2>Baris anggaran ({lines.length})</h2>
        <div className="head-actions">
          <span className="muted">{numberID(totalSoal)} soal · <b>{rupiah(totalRp)}</b></span>
          <button type="button" className="btn btn-blue" disabled={readOnly || busy || !lines.length || belumLengkap > 0} onClick={simpan}>
            {busy ? "Menyimpan…" : mode === "baru" ? `Buat sheet ${bulanBaru}` : "Tambahkan ke sheet"}
          </button>
        </div>
      </div>

      {hargaSalah.length ? (
        <div className="banner err"><Icon name="alert" /><div>{hargaSalah.length} baris harganya belum berupa satu angka. Harga di baris bulanan dipakai menghitung Fee, jadi rentang seperti "5000-7000" hanya boleh di Master Subtes — pilih satu angka di sini.</div></div>
      ) : belumLengkap > 0 ? (
        <div className="banner sample"><Icon name="info" /><div>{belumLengkap} baris belum diisi harga atau kebutuhannya.</div></div>
      ) : null}

      <div className="table-wrap fixed">
        <table className="grid-table">
          <colgroup>{[28, 13, 16, 12, 11, 13, 7].map((w, i) => <col key={i} style={{ width: w + "%" }} />)}</colgroup>
          <thead>
            <tr>
              <th>Subtes</th><th>Platform</th><th>Output</th>
              <th className="num">Harga</th><th className="num">Kebutuhan</th><th className="num">Anggaran</th><th className="act" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={7} className="empty">Belum ada baris. Cari subtes di atas untuk menambahkan.</td></tr>
            ) : null}
            {lines.map((l, i) => (
              <tr key={l.key}>
                <td className="wrap">
                  <b>{l.subtes}</b>
                  <div className="muted xs2">{l.idSubtes}{l.kategori ? " · " + l.kategori : ""}</div>
                </td>
                <td><input className="input xs" value={l.platform} onChange={(e) => ubah(i, "platform", e.target.value)} /></td>
                <td>
                  <select className="select xs" value={l.output} onChange={(e) => ubah(i, "output", e.target.value)}>
                    {OUTPUTS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </td>
                <td className="num">
                  {/* teks, bukan number: input number membuang ketikan rentang jadi "" */}
                  <input className={"input xs" + (cekHargaBulanan(l.harga).ok || !String(l.harga).trim() ? "" : " input-err")} inputMode="numeric" value={l.harga} onChange={(e) => ubah(i, "harga", e.target.value)} title={cekHargaBulanan(l.harga).ok ? "" : cekHargaBulanan(l.harga).pesan} />
                </td>
                <td className="num"><input className="input xs" type="number" min={0} value={l.kebutuhan} onChange={(e) => ubah(i, "kebutuhan", e.target.value)} /></td>
                <td className="num">{rupiah((parseInt(l.kebutuhan, 10) || 0) * (parseInt(l.harga, 10) || 0))}</td>
                <td className="act">
                  <div className="rowmenu"><button type="button" className="ibtn danger" onClick={() => hapus(i)} aria-label={`Hapus baris ${l.subtes}`} title="Hapus baris"><Icon name="trash" /></button></div>
                </td>
              </tr>
            ))}
          </tbody>
          {lines.length ? (
            <tfoot>
              <tr>
                <td colSpan={4}><b>Total</b></td>
                <td className="num"><b>{numberID(totalSoal)}</b></td>
                <td className="num"><b>{rupiah(totalRp)}</b></td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}
