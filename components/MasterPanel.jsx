"use client";

// ============================================================================
//  Halaman "Master Subtes" — katalog permanen semua subtes.
//  Admin tidak pernah mengetik ID: cukup memilih JENIS (Soal / Laporan FR /
//  Liveclass / Editor), sistem yang memberi nomor berikutnya (SOL-097, …).
//  Sebelum subtes baru dibuat, nama dicek kemiripannya supaya master tidak
//  kotor lagi oleh typo (itu penyebab kekacauan ID sebelumnya).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { rupiah, numberID, formatHarga, parseHarga } from "@/lib/format";
import { JENIS, nextId } from "@/lib/jenis";
import Icon from "./Icon";
import Combobox from "./Combobox";
import Drawer, { Dialog } from "./Drawer";
import PageActions from "./PageActions";

// Harga boleh satu angka ("13000") atau DUA TARIF "telat-normal" ("5000-7000"):
// angka kecil = tarif untuk guru yang lewat deadline, angka besar = tarif normal.
const HINT_HARGA = "Satu angka, atau dua tarif telat-normal — mis. 5000-7000 (telat Rp5.000, normal Rp7.000)";
const HargaSel = ({ v }) => {
  const h = parseHarga(v);
  if (!h.ada) return <span className="muted">—</span>;
  return h.tentatif ? (
    <span className="tentatif" title={`Terlambat ${rupiah(h.min)} / Normal ${rupiah(h.max)}`}>{formatHarga(v, { pendek: true })}</span>
  ) : (
    <>{rupiah(h.min)}</>
  );
};

// jenis sengaja kosong: harus dipilih sadar, karena ID-nya ikut jenis.
const BLANK = {
  jenis: "", subtes: "", kategori: "", platform: "", output: "",
  hargaLengkap: "", hargaVideo: "", hargaSoal: "", hargaLive: "", catatan: "",
};

// Empat tipe baku — sama persis dengan empat kolom harga di bawahnya.
const OUTPUT_BAKU = ["Lengkap", "Video Pembahasan", "Soal & Pembahasan", "Liveclass"];


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
    err.dipakai = j.dipakai;
    throw err;
  }
  return j;
}

export default function MasterPanel({ rows, readOnly, onChanged, busy, setBusy, setErr, aksiEl }) {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("Semua");
  const [jen, setJen] = useState("Semua");
  const [status, setStatus] = useState("Aktif");
  const [edit, setEdit] = useState(null); // { mode:'create'|'edit', row? }
  const [draft, setDraft] = useState(BLANK);
  const [dup, setDup] = useState(null);
  const [arsip, setArsip] = useState(null); // subtes yang menunggu konfirmasi
  // Hapus permanen: { row, ketik, cek:'memuat'|'siap', dipakai:[] }
  const [hapus, setHapus] = useState(null);

  const kategoriList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.kategori).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const perluKategori = useMemo(() => rows.filter((r) => !r.kategori && r.status !== "Arsip"), [rows]);
  const platformList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.platform).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  // Tipe baku dulu, lalu tipe lain yang sudah pernah dipakai admin.
  const outputList = useMemo(() => {
    const set = new Set(OUTPUT_BAKU);
    rows.forEach((r) =>
      String(r.output || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => set.add(s))
    );
    return Array.from(set);
  }, [rows]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "Semua" && (r.status || "Aktif") !== status) return false;
      if (jen !== "Semua" && r.jenis !== jen) return false;
      if (kat === "(belum ada)" ? Boolean(r.kategori) : kat !== "Semua" && r.kategori !== kat) return false;
      if (s && !`${r.id} ${r.subtes} ${r.kategori} ${r.idLama} ${r.jenis}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, q, kat, status, jen]);

  // ID berikutnya untuk tiap jenis, mis. { Soal: "SOL-097", Editor: "EDI-001" }
  const idBerikut = useMemo(() => Object.fromEntries(JENIS.map((j) => [j.nama, nextId(rows, j.nama)])), [rows]);
  const jumlahJenis = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r.jenis || "?"] = (m[r.jenis || "?"] || 0) + 1; });
    return m;
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

  // Buka popup hapus, lalu tanya server di mana subtes ini masih dipakai.
  // Pemeriksaannya dilakukan lebih dulu supaya admin melihat dampaknya sebelum
  // menekan apa pun — bukan baru diberi tahu setelah gagal.
  const bukaHapus = useCallback(async (r) => {
    setHapus({ row: r, ketik: "", cek: "memuat", dipakai: [] });
    try {
      const j = await api({ action: "usage", id: r.id });
      setHapus((h) => (h && h.row.id === r.id ? { ...h, cek: "siap", dipakai: j.dipakai || [] } : h));
    } catch (e) {
      setHapus((h) => (h && h.row.id === r.id ? { ...h, cek: "gagal", pesan: e.message } : h));
    }
  }, []);

  const jalankanHapus = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      await api({ action: "delete", row: hapus.row.row, id: hapus.row.id });
      setHapus(null);
      await onChanged();
    } catch (e) {
      if (e.dipakai) setHapus((h) => (h ? { ...h, cek: "siap", dipakai: e.dipakai } : h));
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [hapus, onChanged, setBusy, setErr]);

  const tutupEdit = () => {
    setEdit(null);
    setDup(null);
  };
  const tokenOutput = String(draft.output || "").split(",").map((s) => s.trim()).filter(Boolean);
  const opsiOutput = outputList.map((o) => ({ value: o, label: o }));
  const opsiKategori = kategoriList.map((k) => ({ value: k, label: k }));
  const opsiPlatform = platformList.map((k) => ({ value: k, label: k }));

  return (
    <>
      <PageActions el={aksiEl}>
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Cari subtes, ID, ID lama" aria-label="Cari master" value={q} onChange={(e) => setQ(e.target.value)} />
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
          Subtes baru
        </button>
      </PageActions>

      <div className="grid stat-grid">
        <div className="card stat">
          <div className="label">Total subtes</div>
          <div className="value">{numberID(rows.length)}</div>
          <div className="sub">{rows.filter((r) => r.status === "Arsip").length} diarsipkan</div>
        </div>
        <div className="card stat">
          <div className="label">Kategori</div>
          <div className="value">{kategoriList.length}</div>
          <div className="sub">jenis materi</div>
        </div>
        <div className="card stat">
          <div className="label">Perlu dikategorikan</div>
          <div className={"value " + (perluKategori.length ? "amber" : "green")}>{numberID(perluKategori.length)}</div>
          <div className="sub">kategori masih kosong</div>
        </div>
        <div className="card stat hi">
          <div className="label">ID berikutnya</div>
          <div className="id-next">
            {JENIS.map((j) => (
              <div key={j.kode}>
                <b>{idBerikut[j.nama]}</b>
                <span>
                  {j.nama} · {numberID(jumlahJenis[j.nama] || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {perluKategori.length ? (
        <div className="banner info">
          <Icon name="info" />
          <div>
            {perluKategori.length} subtes belum punya kategori: <b>{perluKategori.slice(0, 6).map((r) => r.subtes).join(", ")}</b>
            {perluKategori.length > 6 ? ` (+${perluKategori.length - 6} lagi)` : ""}
            <div className="banner-detail">Boleh dibiarkan — subtes tetap bisa dipakai. Pilih kategori “(belum ada)” untuk menyaringnya.</div>
          </div>
        </div>
      ) : null}

      <div className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="chips" role="group" aria-label="Saring jenis">
          <button type="button" className={"chip" + (jen === "Semua" ? " active" : "")} aria-pressed={jen === "Semua"} onClick={() => setJen("Semua")}>
            Semua jenis <span className="n">{numberID(rows.length)}</span>
          </button>
          {JENIS.map((j) => (
            <button key={j.kode} type="button" className={"chip" + (jen === j.nama ? " active" : "")} aria-pressed={jen === j.nama} onClick={() => setJen(j.nama)}>
              {j.nama} <span className="n">{numberID(jumlahJenis[j.nama] || 0)}</span>
            </button>
          ))}
        </div>
        <div className="filters">
          <label className="fl">
            <span>Kategori</span>
            <select className="select" value={kat} onChange={(e) => setKat(e.target.value)}>
              <option>Semua</option>
              <option>(belum ada)</option>
              {kategoriList.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="fl">
            <span>Status</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Aktif</option>
              <option>Arsip</option>
              <option>Semua</option>
            </select>
          </label>
          <span className="muted fl-more">{numberID(list.length)} subtes</span>
        </div>
      </div>

      <div className="table-wrap fixed">
        <table className="grid-table">
          <colgroup>
            {/* kolom aksi lebar: baris Arsip punya tiga tombol (edit, aktifkan, hapus) */}
            {[10, 28, 14, 8, 11, 9, 9, 11].map((w, i) => (
              <col key={i} style={{ width: w + "%" }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>ID</th>
              <th>Subtes</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Platform</th>
              <th className="num">Lengkap</th>
              <th className="num">Video</th>
              <th className="act">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  Tidak ada subtes yang cocok.
                </td>
              </tr>
            ) : null}
            {list.map((r) => (
              <tr key={r.id} className={r.status === "Arsip" ? "row-dim" : ""}>
                <td>
                  <span className="code">
                    <b>{r.id}</b>
                    <span>{r.jenis}</span>
                  </span>
                </td>
                <td className="wrap">
                  <b style={{ fontWeight: 600, color: "var(--text)" }}>{r.subtes}</b>
                  {r.catatan ? <div className="muted xs2">{r.catatan}</div> : null}
                </td>
                <td className="wrap">{r.kategori || <span className="neg">belum ada</span>}</td>
                <td>
                  {r.status === "Arsip" ? (
                    <span className="pill batal" style={{ textDecoration: "none" }}>
                      Arsip
                    </span>
                  ) : (
                    <span className="pill appr">Aktif</span>
                  )}
                </td>
                <td className="wrap">{r.platform || "—"}</td>
                <td className="num">
                  <HargaSel v={r.hargaLengkap} />
                </td>
                <td className="num">
                  <HargaSel v={r.hargaVideo} />
                </td>
                <td className="act">
                  <div className="rowmenu">
                    <button
                      type="button"
                      className="ibtn"
                      disabled={readOnly || busy}
                      aria-label={`Edit ${r.id}`}
                      title="Edit"
                      onClick={() => {
                        setDraft({
                          jenis: r.jenis || "",
                          subtes: r.subtes,
                          kategori: r.kategori,
                          platform: r.platform,
                          output: r.output,
                          hargaLengkap: r.hargaLengkap || "",
                          hargaVideo: r.hargaVideo || "",
                          hargaSoal: r.hargaSoal || "",
                          hargaLive: r.hargaLive || "",
                          catatan: r.catatan,
                        });
                        setDup(null);
                        setEdit({ mode: "edit", row: r.row, id: r.id, jenis: r.jenis });
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="ibtn danger"
                      disabled={readOnly || busy}
                      aria-label={r.status === "Arsip" ? `Aktifkan kembali ${r.id}` : `Arsipkan ${r.id}`}
                      title={r.status === "Arsip" ? "Aktifkan kembali" : "Arsipkan"}
                      onClick={() => setArsip(r)}
                    >
                      <Icon name={r.status === "Arsip" ? "restore" : "archive"} />
                    </button>
                    {/* Hapus permanen hanya untuk yang sudah diarsipkan, jadi
                        membuang subtes selalu butuh dua langkah sadar. */}
                    {r.status === "Arsip" ? (
                      <button
                        type="button"
                        className="ibtn danger"
                        disabled={readOnly || busy}
                        aria-label={`Hapus permanen ${r.id}`}
                        title="Hapus permanen"
                        onClick={() => bukaHapus(r)}
                      >
                        <Icon name="trash" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {arsip ? (
        <Dialog
          title={arsip.status === "Arsip" ? "Aktifkan kembali subtes ini?" : "Arsipkan subtes ini?"}
          onClose={() => setArsip(null)}
          busy={busy}
          foot={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setArsip(null)} disabled={busy}>
                Batal
              </button>
              <button
                type="button"
                className={"btn " + (arsip.status === "Arsip" ? "btn-blue" : "btn-red solid")}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    await api({ action: "archive", row: arsip.row, status: arsip.status === "Arsip" ? "Aktif" : "Arsip" });
                    setArsip(null);
                    await onChanged();
                  } catch (e) {
                    setErr(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Menyimpan…" : arsip.status === "Arsip" ? "Ya, aktifkan" : "Ya, arsipkan"}
              </button>
            </>
          }
        >
          <p className="modal-sub">
            <b className="mono" style={{ color: "var(--text)" }}>
              {arsip.id}
            </b>{" "}
            — {arsip.subtes}
            {arsip.kategori ? <span> · {arsip.kategori}</span> : null}
          </p>
          {arsip.status === "Arsip" ? (
            <p className="modal-sub">Subtes akan muncul lagi di daftar pilihan saat menyusun proyek bulanan.</p>
          ) : (
            <>
              <p className="modal-sub">
                Subtes <b>tidak dihapus</b> — hanya disembunyikan dari daftar pilihan saat menyusun proyek baru. ID <b>{arsip.id}</b>{" "}
                tetap dipakai, jadi data bulan-bulan lalu yang memakainya tetap utuh dan tetap terhitung di Analisis.
              </p>
              {parseHarga(arsip.hargaLengkap).tentatif ||
              parseHarga(arsip.hargaVideo).tentatif ||
              parseHarga(arsip.hargaSoal).tentatif ||
              parseHarga(arsip.hargaLive).tentatif ? (
                <div className="banner sample" style={{ margin: 0 }}>
                  <Icon name="alert" />
                  <div>
                    Subtes ini memakai <b>dua tarif</b> (normal &amp; terlambat). Baris log yang sudah memakai tarif terlambat
                    tetap tersimpan apa adanya.
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Dialog>
      ) : null}

      {hapus ? (
        <Dialog
          title="Hapus permanen?"
          onClose={() => setHapus(null)}
          busy={busy}
          foot={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setHapus(null)} disabled={busy}>
                {hapus.cek === "siap" && !hapus.dipakai.length ? "Batal" : "Tutup"}
              </button>
              {hapus.cek === "siap" && !hapus.dipakai.length ? (
                <button
                  type="button"
                  className="btn btn-red solid"
                  disabled={busy || hapus.ketik.trim().toUpperCase() !== "HAPUS"}
                  onClick={jalankanHapus}
                >
                  {busy ? "Menghapus…" : `Ya, hapus ${hapus.row.id} permanen`}
                </button>
              ) : null}
            </>
          }
        >
          <p className="modal-sub">
            <b className="mono" style={{ color: "var(--text)" }}>
              {hapus.row.id}
            </b>{" "}
            — {hapus.row.subtes}
            {hapus.row.kategori ? <span> · {hapus.row.kategori}</span> : null}
          </p>

          {hapus.cek === "memuat" ? (
            <p className="modal-sub">Memeriksa apakah subtes ini masih dipakai di bulan mana pun…</p>
          ) : hapus.cek === "gagal" ? (
            <div className="banner err" style={{ margin: 0 }}>
              <Icon name="alert" />
              <div>Gagal memeriksa pemakaian: {hapus.pesan}. Jangan dihapus dulu.</div>
            </div>
          ) : hapus.dipakai.length ? (
            <>
              <div className="banner err" style={{ margin: 0 }}>
                <Icon name="alert" />
                <div>
                  Tidak bisa dihapus — masih dipakai <b>{hapus.dipakai.length} baris katalog</b>:
                  <ul className="dup-list">
                    {hapus.dipakai.slice(0, 8).map((x) => (
                      <li key={x.tab + x.row}>
                        <b>{x.bulan}</b> — {x.kode} {x.subtes ? `· ${x.subtes}` : ""}
                      </li>
                    ))}
                    {hapus.dipakai.length > 8 ? <li>…dan {hapus.dipakai.length - 8} lagi</li> : null}
                  </ul>
                </div>
              </div>
              <p className="modal-sub">
                Menghapusnya akan memutus tautan baris-baris itu ke master, sehingga tarif normal/terlambatnya tak bisa dibaca
                lagi. Biarkan diarsipkan saja — statusnya sudah cukup menyembunyikannya dari daftar pilihan proyek baru.
              </p>
            </>
          ) : (
            <>
              <p className="modal-sub">
                Aman dihapus: subtes ini <b>tidak dipakai satu pun katalog bulanan</b>. Barisnya akan hilang dari spreadsheet dan{" "}
                <b>tidak bisa dikembalikan</b>.
              </p>
              <p className="modal-sub xs2">
                Nomor <b>{hapus.row.id}</b> akan bisa dipakai lagi oleh subtes berikutnya — aman, justru karena tidak ada data lama
                yang menunjuk ke sana.
              </p>
              <label className="ffield">
                <span>
                  Ketik <b>HAPUS</b> untuk mengonfirmasi
                </span>
                <input className="input" value={hapus.ketik} onChange={(e) => setHapus((h) => ({ ...h, ketik: e.target.value }))} placeholder="HAPUS" autoFocus />
              </label>
            </>
          )}
        </Dialog>
      ) : null}

      {edit ? (
        <Drawer
          wide
          title={edit.mode === "create" ? "Subtes baru" : `Edit ${edit.id}`}
          sub={
            edit.mode === "create"
              ? draft.jenis
                ? `Akan mendapat ID ${idBerikut[draft.jenis]}`
                : "Pilih jenis dulu — ID dibuat dari jenisnya"
              : "Perubahan langsung tersimpan ke Master_Project"
          }
          onClose={tutupEdit}
          busy={busy}
          foot={
            <div className="drawer-actions">
              <button type="button" className="btn btn-ghost" onClick={tutupEdit} disabled={busy}>
                Batal
              </button>
              {dup ? (
                <button type="button" className="btn btn-red" onClick={() => simpan(true)} disabled={busy}>
                  {busy ? "Menyimpan…" : "Tetap buat baru"}
                </button>
              ) : null}
              <button type="button" className="btn btn-blue" onClick={() => simpan(false)} disabled={busy || !draft.subtes.trim() || !draft.jenis}>
                {busy ? "Menyimpan…" : edit.mode === "create" ? "Buat subtes" : "Simpan"}
              </button>
            </div>
          }
        >
          {dup ? (
            <div className="banner err" style={{ margin: 0 }}>
              <Icon name="alert" />
              <div>
                Sudah ada subtes yang mirip:
                <ul className="dup-list">
                  {dup.map((x) => (
                    <li key={x.id}>
                      <b>{x.id}</b> — {x.subtes} <i>({x.alasan})</i>
                    </li>
                  ))}
                </ul>
                Pakai yang sudah ada, atau tekan “Tetap buat baru” bila memang berbeda.
              </div>
            </div>
          ) : null}

          {/* Jenis menentukan awalan ID, jadi dipilih paling awal dan ID
              hasilnya langsung terlihat. */}
          <div className="ffield">
            <span>Jenis proyek</span>
            <div className="seg four" role="radiogroup" aria-label="Jenis proyek">
              {JENIS.map((j) => (
                <button
                  type="button"
                  key={j.kode}
                  role="radio"
                  aria-checked={draft.jenis === j.nama}
                  className={"seg-btn" + (draft.jenis === j.nama ? " on" : "")}
                  onClick={() => setDraft((p) => ({ ...p, jenis: j.nama }))}
                >
                  <b>{j.nama}</b>
                  <small>{j.kode}</small>
                </button>
              ))}
            </div>
            {edit.mode === "edit" && draft.jenis && draft.jenis !== edit.jenis ? (
              <small className="warn-text">
                ID akan berganti dari <b>{edit.id}</b> menjadi <b>{idBerikut[draft.jenis]}</b>. Semua katalog bulanan yang memakai
                subtes ini ikut dipindah ke ID baru; ID lama disimpan di kolom “ID Lama”.
              </small>
            ) : null}
          </div>

          <label className="ffield">
            <span>Nama subtes</span>
            <input className="input" value={draft.subtes} onChange={d("subtes")} placeholder="mis. Figural Analogi" />
          </label>

          <div className="form-grid">
            <div className="ffield">
              <label htmlFor="m-kat">Kategori</label>
              <Combobox id="m-kat" value={draft.kategori} onChange={(v) => setDraft((p) => ({ ...p, kategori: v }))} options={opsiKategori} placeholder="boleh dikosongkan" />
              <small>Kategori baru? Ketik saja.</small>
            </div>
            <div className="ffield">
              <label htmlFor="m-plat">Platform</label>
              <Combobox id="m-plat" value={draft.platform} onChange={(v) => setDraft((p) => ({ ...p, platform: v }))} options={opsiPlatform} placeholder="ASN / Bappenas / …" />
            </div>
          </div>

          <div className="ffield">
            <label htmlFor="m-out">Output yang tersedia</label>
            <Combobox
              id="m-out"
              multiple
              value={tokenOutput}
              onChange={(arr) => setDraft((p) => ({ ...p, output: arr.join(", ") }))}
              options={opsiOutput}
              placeholder="ketik untuk memilih, mis. vid"
            />
            <small>Boleh lebih dari satu. Tipe baru? Ketik lalu tekan Enter.</small>
          </div>

          <div className="form-grid">
            {[
              ["hargaLengkap", "Harga Lengkap"],
              ["hargaVideo", "Harga Video Pembahasan"],
              ["hargaSoal", "Harga Soal & Pembahasan"],
              ["hargaLive", "Harga Liveclass"],
            ].map(([k, label]) => {
              const h = parseHarga(draft[k]);
              return (
                <label className="ffield" key={k}>
                  <span>{label}</span>
                  {/* type="text", bukan number — agar "5000-7000" bisa diketik */}
                  <input className="input" inputMode="numeric" value={draft[k]} onChange={d(k)} placeholder="mis. 7000 atau 5000-7000" />
                  {h.tentatif ? <small>Terlambat {rupiah(h.min)} · Normal {rupiah(h.max)}</small> : null}
                </label>
              );
            })}
          </div>
          <small className="muted">{HINT_HARGA}</small>

          <label className="ffield">
            <span>Catatan</span>
            <input className="input" value={draft.catatan} onChange={d("catatan")} />
          </label>
        </Drawer>
      ) : null}
    </>
  );
}
