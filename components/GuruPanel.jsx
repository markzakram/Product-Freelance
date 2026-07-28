"use client";

// ============================================================================
//  "Database Guru" — tambah & sunting guru freelance langsung dari dashboard.
//  ID Guru dibuat sistem (angka tertinggi + 1) dan tidak pernah berubah,
//  karena dipakai sebagai rujukan di log pengambilan tiap bulan.
// ============================================================================

import { useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";

const BLANK = {
  nama: "", status: "Guru Baru", email: "", wa: "",
  rekening: "", pemilikRekening: "", npwp: "",
  pendidikan: "", universitas: "", bidang: "", kapasitas: "", catatan: "",
};

async function api(payload) {
  const res = await fetch("/api/admin/teachers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(j.error || `Gagal (HTTP ${res.status})`);
    err.duplicate = j.duplicate;
    throw err;
  }
  return j;
}

export default function GuruPanel({ rows, feeByGuru, readOnly, busy, setBusy, setErr, onChanged }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Semua");
  const [saring, setSaring] = useState("Semua");
  const [edit, setEdit] = useState(null);
  const [draft, setDraft] = useState(BLANK);
  const [dup, setDup] = useState(null);

  const statusList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const tanpaRek = useMemo(() => rows.filter((r) => !r.rekening), [rows]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "Semua" && r.status !== status) return false;
      if (saring === "Tanpa rekening" && r.rekening) return false;
      if (saring === "Pernah dibayar" && !feeByGuru.get(String(r.idGuru))) return false;
      if (s && !`${r.idGuru} ${r.nama} ${r.rekening} ${r.wa} ${r.email} ${r.bidang}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, q, status, saring, feeByGuru]);

  const nextId = useMemo(() => {
    let max = 0;
    rows.forEach((r) => {
      const n = parseInt(String(r.idGuru).replace(/\D/g, ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return String(max + 1);
  }, [rows]);

  const d = (k) => (e) => setDraft((p) => ({ ...p, [k]: e.target.value }));

  const simpan = async (force = false) => {
    setBusy(true);
    setErr("");
    try {
      if (edit.mode === "create") await api({ action: "create", data: draft, force });
      else await api({ action: "update", row: edit.row, data: draft });
      setEdit(null);
      setDup(null);
      await onChanged();
    } catch (e) {
      if (e.duplicate) setDup(e.duplicate);
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid stat-grid" style={{ marginTop: 18 }}>
        <div className="card stat">
          <div className="label">Total Guru</div>
          <div className="value blue">{numberID(rows.length)}</div>
          <div className="sub">terdaftar di database</div>
        </div>
        <div className="card stat">
          <div className="label">Pernah Dibayar</div>
          <div className="value green">{numberID(rows.filter((r) => feeByGuru.get(String(r.idGuru))).length)}</div>
          <div className="sub">punya riwayat fee</div>
        </div>
        <div className="card stat">
          <div className="label">Tanpa Rekening</div>
          <div className={"value " + (tanpaRek.length ? "amber" : "green")}>{numberID(tanpaRek.length)}</div>
          <div className="sub">belum bisa ditransfer</div>
        </div>
        <div className="card stat hi">
          <div className="label">ID Berikutnya</div>
          <div className="value navy">{nextId}</div>
          <div className="sub">otomatis, tak bisa diketik</div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 18 }}>
        <div className="head-actions">
          <input className="input sm" placeholder="Cari nama, ID, rekening, WA…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Semua</option>
            {statusList.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select sm" value={saring} onChange={(e) => setSaring(e.target.value)}>
            <option>Semua</option>
            <option>Tanpa rekening</option>
            <option>Pernah dibayar</option>
          </select>
          <button
            className="btn btn-blue sm"
            disabled={readOnly || busy}
            onClick={() => { setDraft(BLANK); setDup(null); setEdit({ mode: "create" }); }}
          >
            ＋ Guru Baru
          </button>
        </div>
      </div>

      <div className="table-wrap fixed">
        <table className="grid-table">
          <colgroup>{[6, 24, 11, 16, 13, 13, 10, 7].map((w, i) => <col key={i} style={{ width: w + "%" }} />)}</colgroup>
          <thead>
            <tr>
              <th>ID</th><th>Nama Lengkap</th><th>Status</th><th>Nomor Rekening</th>
              <th>a.n.</th><th>WhatsApp</th><th className="num">Fee Tercatat</th><th className="act" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={8} className="empty">Tidak ada guru yang cocok.</td></tr> : null}
            {list.map((t) => (
              <tr key={t.row}>
                <td className="mono">{t.idGuru}</td>
                <td className="wrap">
                  <b>{t.nama}</b>
                  {t.bidang ? <div className="muted xs2">{t.bidang.slice(0, 60)}</div> : null}
                </td>
                <td className="wrap">{t.status || "—"}</td>
                <td className="mono wrap">{t.rekening || <span className="neg">— belum ada —</span>}</td>
                <td className="wrap">{t.pemilikRekening || "—"}</td>
                <td className="mono">{t.wa || "—"}</td>
                <td className="num">{feeByGuru.get(String(t.idGuru)) ? rupiah(feeByGuru.get(String(t.idGuru))) : "—"}</td>
                <td className="act">
                  <div className="rowmenu">
                    <button
                      className="ibtn"
                      disabled={readOnly || busy}
                      title="Edit"
                      onClick={() => {
                        setDraft({
                          nama: t.nama, status: t.status, email: t.email, wa: t.wa,
                          rekening: t.rekening, pemilikRekening: t.pemilikRekening, npwp: t.npwp,
                          pendidikan: t.pendidikan, universitas: t.universitas, bidang: t.bidang,
                          kapasitas: t.kapasitas || "", catatan: t.catatan,
                        });
                        setDup(null);
                        setEdit({ mode: "edit", row: t.row, id: t.idGuru });
                      }}
                    >✎</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit ? (
        <div className="overlay" onClick={() => !busy && setEdit(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{edit.mode === "create" ? `＋ Guru Baru — ID ${nextId}` : `✎ Edit Guru ID ${edit.id}`}</h2>
              <button className="icon-x" onClick={() => setEdit(null)} disabled={busy}>✕</button>
            </div>
            <div className="modal-body">
              {dup ? (
                <div className="banner err" style={{ marginBottom: 14 }}>
                  <span>⚠</span>
                  <div>
                    Nama ini sudah terdaftar:
                    <ul className="dup-list">
                      {dup.map((x) => <li key={x.idGuru}><b>ID {x.idGuru}</b> — {x.nama}</li>)}
                    </ul>
                    Kalau memang orang yang berbeda, tekan “Tetap simpan”.
                  </div>
                </div>
              ) : null}

              <div className="form-grid">
                <label className="ffield wide">
                  <span>Nama Lengkap (beserta gelar) *</span>
                  <input className="input" value={draft.nama} onChange={d("nama")} autoFocus />
                </label>
                <label className="ffield">
                  <span>Status</span>
                  <input className="input" list="status-guru" value={draft.status} onChange={d("status")} />
                  <datalist id="status-guru">{statusList.map((s) => <option key={s} value={s} />)}</datalist>
                </label>
                <label className="ffield">
                  <span>Nomor WhatsApp</span>
                  <input className="input" value={draft.wa} onChange={d("wa")} placeholder="628xxxxxxxxxx" />
                </label>
                <label className="ffield wide">
                  <span>Email</span>
                  <input className="input" value={draft.email} onChange={d("email")} />
                </label>

                <label className="ffield">
                  <span>Nomor Rekening</span>
                  <input className="input" value={draft.rekening} onChange={d("rekening")} placeholder="tanpa spasi" />
                  <small>Boleh bank selain BSI — tulis banknya, mis. “123456 (BCA)”.</small>
                </label>
                <label className="ffield">
                  <span>Nama Pemilik Rekening</span>
                  <input className="input" value={draft.pemilikRekening} onChange={d("pemilikRekening")} />
                </label>
                <label className="ffield">
                  <span>NPWP</span>
                  <input className="input" value={draft.npwp} onChange={d("npwp")} />
                </label>
                <label className="ffield">
                  <span>Kapasitas / minggu</span>
                  <input className="input" type="number" min={0} value={draft.kapasitas} onChange={d("kapasitas")} />
                </label>

                <label className="ffield">
                  <span>Pendidikan</span>
                  <input className="input" value={draft.pendidikan} onChange={d("pendidikan")} />
                </label>
                <label className="ffield">
                  <span>Universitas</span>
                  <input className="input" value={draft.universitas} onChange={d("universitas")} />
                </label>
                <label className="ffield wide">
                  <span>Bidang materi yang dikuasai</span>
                  <input className="input" value={draft.bidang} onChange={d("bidang")} />
                </label>
                <label className="ffield wide">
                  <span>Catatan</span>
                  <input className="input" value={draft.catatan} onChange={d("catatan")} />
                </label>
              </div>
              <p className="modal-sub" style={{ marginTop: 14 }}>
                Kolom lain di spreadsheet (KTP, CV, portofolio, pernyataan) tidak ikut diubah.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Batal</button>
              {dup ? (
                <button className="btn btn-red" onClick={() => simpan(true)} disabled={busy}>
                  {busy ? "Menyimpan…" : "Tetap simpan"}
                </button>
              ) : null}
              <button className="btn btn-blue" onClick={() => simpan(false)} disabled={busy || !draft.nama.trim()}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
