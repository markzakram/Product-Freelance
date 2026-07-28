"use client";

// ============================================================================
//  Halaman "Master Subtes" — katalog permanen semua subtes.
//  Admin tidak pernah mengetik ID: sistem yang memberi SUB-xxx berikutnya.
//  Sebelum subtes baru dibuat, nama dicek kemiripannya supaya master tidak
//  kotor lagi oleh typo (itu penyebab kekacauan ID sebelumnya).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";

const BLANK = {
  subtes: "", kategori: "", platform: "", output: "",
  hargaLengkap: "", hargaVideo: "", hargaSoal: "", hargaLive: "", catatan: "",
};

async function api(payload) {
  const res = await fetch("/api/admin/master", {
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

export default function MasterPanel({ rows, readOnly, onChanged, busy, setBusy, setErr }) {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("Semua");
  const [status, setStatus] = useState("Aktif");
  const [edit, setEdit] = useState(null); // { mode:'create'|'edit', row? }
  const [draft, setDraft] = useState(BLANK);
  const [dup, setDup] = useState(null);

  const kategoriList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.kategori).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const perluKategori = useMemo(() => rows.filter((r) => !r.kategori && r.status !== "Arsip"), [rows]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "Semua" && (r.status || "Aktif") !== status) return false;
      if (kat === "(belum ada)" ? Boolean(r.kategori) : kat !== "Semua" && r.kategori !== kat) return false;
      if (s && !`${r.id} ${r.subtes} ${r.kategori} ${r.idLama}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, q, kat, status]);

  const nextIdPreview = useMemo(() => {
    let max = 0;
    rows.forEach((r) => {
      const m = /^SUB-(\d+)$/i.exec(r.id || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `SUB-${String(max + 1).padStart(3, "0")}`;
  }, [rows]);

  const d = (k) => (e) => setDraft((p) => ({ ...p, [k]: e.target.value }));

  const simpan = useCallback(
    async (force = false) => {
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
    },
    [edit, draft, onChanged, setBusy, setErr]
  );

  return (
    <>
      <div className="grid stat-grid" style={{ marginTop: 18 }}>
        <div className="card stat">
          <div className="label">Total Subtes</div>
          <div className="value blue">{numberID(rows.length)}</div>
          <div className="sub">{rows.filter((r) => r.status === "Arsip").length} diarsipkan</div>
        </div>
        <div className="card stat">
          <div className="label">Kategori</div>
          <div className="value navy">{kategoriList.length}</div>
          <div className="sub">jenis materi</div>
        </div>
        <div className="card stat">
          <div className="label">Perlu Dikategorikan</div>
          <div className={"value " + (perluKategori.length ? "amber" : "green")}>{numberID(perluKategori.length)}</div>
          <div className="sub">kategori masih kosong</div>
        </div>
        <div className="card stat hi">
          <div className="label">ID Berikutnya</div>
          <div className="value navy" style={{ fontSize: 24 }}>{nextIdPreview}</div>
          <div className="sub">otomatis, tak bisa diketik</div>
        </div>
      </div>

      {perluKategori.length ? (
        <div className="banner sample" style={{ marginTop: 14 }}>
          <span>🏷</span>
          <div>
            {perluKategori.length} subtes belum punya kategori:{" "}
            <b>{perluKategori.slice(0, 6).map((r) => r.subtes).join(", ")}</b>
            {perluKategori.length > 6 ? ` (+${perluKategori.length - 6} lagi)` : ""}
            <div className="banner-detail">
              Boleh dibiarkan — subtes tetap bisa dipakai. Klik “Kategori: (belum ada)” untuk menyaringnya.
            </div>
          </div>
        </div>
      ) : null}

      <div className="section-head" style={{ marginTop: 18 }}>
        
        <div className="head-actions">
          <input className="input sm" placeholder="Cari subtes, ID, ID lama…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select sm" value={kat} onChange={(e) => setKat(e.target.value)}>
            <option>Semua</option>
            <option>(belum ada)</option>
            {kategoriList.map((k) => <option key={k}>{k}</option>)}
          </select>
          <select className="select sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Aktif</option>
            <option>Arsip</option>
            <option>Semua</option>
          </select>
          <button
            className="btn btn-blue sm"
            disabled={readOnly || busy}
            onClick={() => { setDraft(BLANK); setDup(null); setEdit({ mode: "create" }); }}
          >
            ＋ Subtes Baru
          </button>
        </div>
      </div>

      <div className="table-wrap fixed">
        <table className="grid-table">
          <colgroup>
            {[9, 30, 14, 8, 11, 9, 9, 10].map((w, i) => <col key={i} style={{ width: w + "%" }} />)}
          </colgroup>
          <thead>
            <tr>
              <th>ID</th><th>Subtes</th><th>Kategori</th><th>Status</th>
              <th>Platform</th><th className="num">Lengkap</th><th className="num">Video</th><th className="act" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="empty">Tidak ada subtes yang cocok.</td></tr>
            ) : null}
            {list.map((r) => (
              <tr key={r.id} className={r.status === "Arsip" ? "row-dim" : ""}>
                <td className="mono">{r.id}</td>
                <td className="wrap">
                  {r.subtes}
                  {r.catatan ? <div className="muted xs2">{r.catatan}</div> : null}
                </td>
                <td className="wrap">{r.kategori || <span className="neg">— belum ada —</span>}</td>
                <td>{r.status}</td>
                <td className="wrap">{r.platform || "—"}</td>
                <td className="num">{r.hargaLengkap ? rupiah(r.hargaLengkap) : "—"}</td>
                <td className="num">{r.hargaVideo ? rupiah(r.hargaVideo) : "—"}</td>
                <td className="act">
                  <div className="rowmenu">
                    <button
                      className="ibtn"
                      disabled={readOnly || busy}
                      title="Edit"
                      onClick={() => {
                        setDraft({
                          subtes: r.subtes, kategori: r.kategori, platform: r.platform, output: r.output,
                          hargaLengkap: r.hargaLengkap || "", hargaVideo: r.hargaVideo || "",
                          hargaSoal: r.hargaSoal || "", hargaLive: r.hargaLive || "", catatan: r.catatan,
                        });
                        setDup(null);
                        setEdit({ mode: "edit", row: r.row, id: r.id });
                      }}
                    >✎</button>
                    <button
                      className="ibtn danger"
                      disabled={readOnly || busy}
                      title={r.status === "Arsip" ? "Aktifkan" : "Arsipkan"}
                      onClick={async () => {
                        setBusy(true);
                        try { await api({ action: "archive", row: r.row, status: r.status === "Arsip" ? "Aktif" : "Arsip" }); await onChanged(); }
                        catch (e) { setErr(e.message); } finally { setBusy(false); }
                      }}
                    >{r.status === "Arsip" ? "↩" : "🗄"}</button>
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
              <h2>{edit.mode === "create" ? `＋ Subtes Baru — ${nextIdPreview}` : `✎ Edit ${edit.id}`}</h2>
              <button className="icon-x" onClick={() => setEdit(null)} disabled={busy}>✕</button>
            </div>
            <div className="modal-body">
              {dup ? (
                <div className="banner err" style={{ marginBottom: 14 }}>
                  <span>⚠</span>
                  <div>
                    Sudah ada subtes yang mirip:
                    <ul className="dup-list">
                      {dup.map((x) => <li key={x.id}><b>{x.id}</b> — {x.subtes} <i>({x.alasan})</i></li>)}
                    </ul>
                    Pakai yang sudah ada, atau tekan “Tetap buat baru” bila memang berbeda.
                  </div>
                </div>
              ) : null}

              <div className="form-grid">
                <label className="ffield wide">
                  <span>Nama Subtes *</span>
                  <input className="input" value={draft.subtes} onChange={d("subtes")} placeholder="mis. Figural Analogi" autoFocus />
                </label>
                <label className="ffield">
                  <span>Kategori</span>
                  <input className="input" list="kat-list" value={draft.kategori} onChange={d("kategori")} placeholder="boleh dikosongkan" />
                  <datalist id="kat-list">{kategoriList.map((k) => <option key={k} value={k} />)}</datalist>
                  <small>Kategori baru? Ketik saja — tidak perlu kode apa pun.</small>
                </label>
                <label className="ffield">
                  <span>Platform</span>
                  <input className="input" value={draft.platform} onChange={d("platform")} placeholder="ASN / Bappenas / …" />
                </label>
                <label className="ffield wide">
                  <span>Output yang tersedia</span>
                  <input className="input" value={draft.output} onChange={d("output")} placeholder="Lengkap, Video Pembahasan" />
                </label>
                <label className="ffield"><span>Harga Lengkap</span><input className="input" type="number" min={0} value={draft.hargaLengkap} onChange={d("hargaLengkap")} /></label>
                <label className="ffield"><span>Harga Video Pembahasan</span><input className="input" type="number" min={0} value={draft.hargaVideo} onChange={d("hargaVideo")} /></label>
                <label className="ffield"><span>Harga Soal & Pembahasan</span><input className="input" type="number" min={0} value={draft.hargaSoal} onChange={d("hargaSoal")} /></label>
                <label className="ffield"><span>Harga Liveclass</span><input className="input" type="number" min={0} value={draft.hargaLive} onChange={d("hargaLive")} /></label>
                <label className="ffield wide"><span>Catatan</span><input className="input" value={draft.catatan} onChange={d("catatan")} /></label>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Batal</button>
              {dup ? (
                <button className="btn btn-red" onClick={() => simpan(true)} disabled={busy}>
                  {busy ? "Menyimpan…" : "Tetap buat baru"}
                </button>
              ) : null}
              <button className="btn btn-blue" onClick={() => simpan(false)} disabled={busy || !draft.subtes.trim()}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
