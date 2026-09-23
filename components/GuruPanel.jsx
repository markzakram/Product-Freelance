"use client";

// ============================================================================
//  "Database Guru" — tambah & sunting guru freelance langsung dari dashboard.
//  ID Guru dibuat sistem (angka tertinggi + 1) dan tidak pernah berubah,
//  karena dipakai sebagai rujukan di log pengambilan tiap bulan.
// ============================================================================

import { useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import Icon from "./Icon";
import Combobox from "./Combobox";
import Drawer from "./Drawer";
import PageActions from "./PageActions";

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

export default function GuruPanel({ rows, feeByGuru, readOnly, busy, setBusy, setErr, onChanged, aksiEl }) {
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

  const tutupEdit = () => {
    setEdit(null);
    setDup(null);
  };
  const pernahDibayar = rows.filter((r) => feeByGuru.get(String(r.idGuru))).length;

  return (
    <>
      <PageActions el={aksiEl}>
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Cari nama, ID, rekening, WA" aria-label="Cari guru" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-blue"
          disabled={readOnly || busy}
          onClick={() => {
            setDraft(BLANK);
            setDup(null);
            setEdit({ mode: "create" });
          }}
        >
          <Icon name="plus" stroke={2.2} />
          Guru baru
        </button>
      </PageActions>

      <div className="grid stat-grid">
        <div className="card stat">
          <div className="label">Total guru</div>
          <div className="value">{numberID(rows.length)}</div>
          <div className="sub">terdaftar di database</div>
        </div>
        <div className="card stat">
          <div className="label">Pernah dibayar</div>
          <div className="value green">{numberID(pernahDibayar)}</div>
          <div className="sub">punya riwayat fee</div>
        </div>
        <div className="card stat">
          <div className="label">Tanpa rekening</div>
          <div className={"value " + (tanpaRek.length ? "amber" : "green")}>{numberID(tanpaRek.length)}</div>
          <div className="sub">belum bisa ditransfer</div>
        </div>
        <div className="card stat hi">
          <div className="label">ID berikutnya</div>
          <div className="value mono">{nextId}</div>
          <div className="sub">dibuat sistem, tak bisa diketik</div>
        </div>
      </div>

      <div className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="chips" role="group" aria-label="Saring guru">
          {[
            ["Semua", rows.length],
            ["Tanpa rekening", tanpaRek.length],
            ["Pernah dibayar", pernahDibayar],
          ].map(([k, n]) => (
            <button key={k} type="button" className={"chip" + (saring === k ? " active" : "")} aria-pressed={saring === k} onClick={() => setSaring(k)}>
              {k} <span className="n">{numberID(n)}</span>
            </button>
          ))}
        </div>
        <div className="filters">
          <label className="fl">
            <span>Status guru</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Semua</option>
              {statusList.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <span className="muted fl-more">{numberID(list.length)} guru</span>
        </div>
      </div>

      <div className="table-wrap fixed">
        <table className="grid-table">
          <colgroup>
            {[7, 24, 11, 16, 14, 13, 10, 5].map((w, i) => (
              <col key={i} style={{ width: w + "%" }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama lengkap</th>
              <th>Status</th>
              <th>Nomor rekening</th>
              <th>Atas nama</th>
              <th>WhatsApp</th>
              <th className="num">Fee tercatat</th>
              <th className="act">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  Tidak ada guru yang cocok.
                </td>
              </tr>
            ) : null}
            {list.map((t) => (
              <tr key={t.row}>
                <td className="mono">{t.idGuru}</td>
                <td className="wrap">
                  <b style={{ fontWeight: 600, color: "var(--text)" }}>{t.nama}</b>
                  {t.bidang ? <div className="muted xs2">{t.bidang.slice(0, 60)}</div> : null}
                </td>
                <td className="wrap">{t.status || "—"}</td>
                <td className="mono wrap">{t.rekening || <span className="neg">belum ada</span>}</td>
                <td className="wrap">{t.pemilikRekening || "—"}</td>
                <td className="mono">{t.wa || "—"}</td>
                <td className="num">{feeByGuru.get(String(t.idGuru)) ? rupiah(feeByGuru.get(String(t.idGuru))) : "—"}</td>
                <td className="act">
                  <div className="rowmenu">
                    <button
                      type="button"
                      className="ibtn"
                      disabled={readOnly || busy}
                      aria-label={`Edit ${t.nama}`}
                      title="Edit"
                      onClick={() => {
                        setDraft({
                          nama: t.nama,
                          status: t.status,
                          email: t.email,
                          wa: t.wa,
                          rekening: t.rekening,
                          pemilikRekening: t.pemilikRekening,
                          npwp: t.npwp,
                          pendidikan: t.pendidikan,
                          universitas: t.universitas,
                          bidang: t.bidang,
                          kapasitas: t.kapasitas || "",
                          catatan: t.catatan,
                        });
                        setDup(null);
                        setEdit({ mode: "edit", row: t.row, id: t.idGuru });
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit ? (
        <Drawer
          wide
          title={edit.mode === "create" ? "Guru baru" : `Edit guru ID ${edit.id}`}
          sub={edit.mode === "create" ? `Akan mendapat ID ${nextId}` : "Kolom lain di spreadsheet (KTP, CV, portofolio) tidak ikut diubah"}
          onClose={tutupEdit}
          busy={busy}
          foot={
            <div className="drawer-actions">
              <button type="button" className="btn btn-ghost" onClick={tutupEdit} disabled={busy}>
                Batal
              </button>
              {dup ? (
                <button type="button" className="btn btn-red" onClick={() => simpan(true)} disabled={busy}>
                  {busy ? "Menyimpan…" : "Tetap simpan"}
                </button>
              ) : null}
              <button type="button" className="btn btn-blue" onClick={() => simpan(false)} disabled={busy || !draft.nama.trim()}>
                {busy ? "Menyimpan…" : edit.mode === "create" ? "Tambah guru" : "Simpan"}
              </button>
            </div>
          }
        >
          {dup ? (
            <div className="banner err" style={{ margin: 0 }}>
              <Icon name="alert" />
              <div>
                Nama ini sudah terdaftar:
                <ul className="dup-list">
                  {dup.map((x) => (
                    <li key={x.idGuru}>
                      <b>ID {x.idGuru}</b> — {x.nama}
                    </li>
                  ))}
                </ul>
                Kalau memang orang yang berbeda, tekan “Tetap simpan”.
              </div>
            </div>
          ) : null}

          <label className="ffield">
            <span>Nama lengkap (beserta gelar)</span>
            <input className="input" value={draft.nama} onChange={d("nama")} autoComplete="off" />
          </label>

          <div className="form-grid">
            <div className="ffield">
              <label htmlFor="g-status">Status</label>
              <Combobox id="g-status" value={draft.status} onChange={(v) => setDraft((p) => ({ ...p, status: v }))} options={statusList.map((s) => ({ value: s, label: s }))} />
            </div>
            <label className="ffield">
              <span>Nomor WhatsApp</span>
              <input className="input" inputMode="tel" value={draft.wa} onChange={d("wa")} placeholder="628xxxxxxxxxx" />
            </label>
          </div>
          <label className="ffield">
            <span>Email</span>
            <input className="input" type="email" value={draft.email} onChange={d("email")} />
          </label>

          <div className="form-grid">
            <label className="ffield">
              <span>Nomor rekening</span>
              <input className="input" inputMode="numeric" value={draft.rekening} onChange={d("rekening")} placeholder="tanpa spasi" />
              <small>Bank selain BSI? Tulis banknya, mis. “123456 (BCA)”.</small>
            </label>
            <label className="ffield">
              <span>Nama pemilik rekening</span>
              <input className="input" value={draft.pemilikRekening} onChange={d("pemilikRekening")} />
            </label>
            <label className="ffield">
              <span>NPWP</span>
              <input className="input" value={draft.npwp} onChange={d("npwp")} />
            </label>
            <label className="ffield">
              <span>Kapasitas / minggu</span>
              <input className="input" type="number" inputMode="numeric" min={0} value={draft.kapasitas} onChange={d("kapasitas")} />
            </label>
            <label className="ffield">
              <span>Pendidikan</span>
              <input className="input" value={draft.pendidikan} onChange={d("pendidikan")} />
            </label>
            <label className="ffield">
              <span>Universitas</span>
              <input className="input" value={draft.universitas} onChange={d("universitas")} />
            </label>
          </div>
          <label className="ffield">
            <span>Bidang materi yang dikuasai</span>
            <input className="input" value={draft.bidang} onChange={d("bidang")} />
          </label>
          <label className="ffield">
            <span>Catatan</span>
            <input className="input" value={draft.catatan} onChange={d("catatan")} />
          </label>
        </Drawer>
      ) : null}
    </>
  );
}
