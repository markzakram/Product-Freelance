"use client";

// Kuota soal yang ditolak lalu DIARSIPKAN (tab "Arsip kuota"): belum tampil di
// katalog. Tim akademik membuka sebagian/semuanya ke katalog (kebutuhan proyek
// ditambah lagi), memindahkannya ke proyek di katalog bulan lain, atau
// menghanguskannya. Server: lib/arsipKuota.js.

import { useState } from "react";
import { numberID } from "@/lib/format";
import Icon from "./Icon";

const samaSubtes = (x, y) => String(x || "").trim().toLowerCase() === String(y || "").trim().toLowerCase();

function BarisArsip({ a, bisa, sibuk, onAksi, months = [] }) {
  const [n, setN] = useState(a.sisa);
  // Pindah ke bulan lain: { bulan, proyek: null | [...], idProyek, memuat, galat }
  const [pindah, setPindah] = useState(null);
  const sah = n >= 1 && n <= a.sisa;
  const kunci = !bisa || sibuk;
  const bulanLain = months.filter((m) => m.tab !== a.bulan);
  const pilihBulan = async (tab) => {
    setPindah({ bulan: tab, proyek: null, idProyek: "", memuat: Boolean(tab), galat: "" });
    if (!tab) return;
    try {
      const res = await fetch(`/api/admin/board?bulan=${encodeURIComponent(tab)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error(j.error || `Katalog bulan itu belum bisa dibaca (HTTP ${res.status}).`);
      const list = [...(j.projects || [])].sort((x, y) => samaSubtes(y.subtes, a.subtes) - samaSubtes(x.subtes, a.subtes) || String(x.id).localeCompare(String(y.id), "id", { numeric: true }));
      setPindah((x) => (x?.bulan === tab ? { ...x, proyek: list, idProyek: list.find((p) => samaSubtes(p.subtes, a.subtes))?.id || "", memuat: false } : x));
    } catch (e) {
      setPindah((x) => (x?.bulan === tab ? { ...x, memuat: false, galat: e.message } : x));
    }
  };
  const namaBulan = (tab) => months.find((m) => m.tab === tab)?.bulan || tab;
  return (
    <li className="ak-item">
      <div className="ak-info">
        <b>
          {a.subtes || a.idProyek}
          <small>{a.idProyek}</small>
        </b>
        <span>
          {numberID(a.sisa)} soal diarsipkan
          {a.dibuka || a.hangus || a.dipindah ? ` · dari ${numberID(a.jumlah)} (dibuka ${numberID(a.dibuka)}${a.dipindah ? `, dipindah ${numberID(a.dipindah)}` : ""}, hangus ${numberID(a.hangus)})` : ""}
        </span>
        {a.tujuan ? <small>Dipindah: {a.tujuan}</small> : null}
        <small>
          Dari {a.guru || a.asal} · {a.waktu}
          {a.oleh ? ` · ${a.oleh}` : ""}
          {a.alasan ? ` · “${a.alasan}”` : ""}
        </small>
      </div>
      <div className="ak-aksi">
        <label className="ak-jumlah">
          <span className="sr-only">Jumlah soal</span>
          <input className="input sm" type="number" min={1} max={a.sisa} value={n} disabled={kunci} onChange={(e) => setN(Math.max(0, parseInt(e.target.value, 10) || 0))} />
          <span>dari {numberID(a.sisa)} soal</span>
        </label>
        <button type="button" className="btn btn-blue sm" disabled={kunci || !sah} onClick={() => onAksi(a, "buka", n)}>
          <Icon name="restore" />
          Buka ke katalog
        </button>
        <button type="button" className="btn btn-ghost sm" disabled={kunci || !bulanLain.length} aria-expanded={Boolean(pindah)} onClick={() => setPindah(pindah ? null : { bulan: "", proyek: null, idProyek: "", memuat: false, galat: "" })}>
          <Icon name="calendar" />
          Pindah ke bulan lain
        </button>
        <button
          type="button"
          className="btn btn-ghost sm ak-hangus"
          disabled={kunci || !sah}
          onClick={() => window.confirm(`Hanguskan ${n} soal ${a.subtes} (${a.idProyek})? Kuota ini tidak akan dibuka lagi.`) && onAksi(a, "hangus", n)}
        >
          Hanguskan
        </button>
      </div>
      {pindah ? (
        <div className="ak-pindah">
          <label className="ffield">
            <span>Bulan tujuan</span>
            <select className="input sm" value={pindah.bulan} onChange={(e) => pilihBulan(e.target.value)} disabled={kunci}>
              <option value="">Pilih bulan…</option>
              {bulanLain.map((m) => (
                <option key={m.tab} value={m.tab}>
                  {m.bulan}
                </option>
              ))}
            </select>
          </label>
          {pindah.memuat ? <small className="muted">Memuat katalog {namaBulan(pindah.bulan)}…</small> : null}
          {pindah.galat ? <small className="neg">{pindah.galat}</small> : null}
          {pindah.proyek ? (
            pindah.proyek.length ? (
              <label className="ffield">
                <span>Proyek tujuan di katalog {namaBulan(pindah.bulan)}</span>
                <select className="input sm" value={pindah.idProyek} onChange={(e) => setPindah({ ...pindah, idProyek: e.target.value })} disabled={kunci}>
                  <option value="">Pilih proyek…</option>
                  {pindah.proyek.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {p.subtes}
                      {samaSubtes(p.subtes, a.subtes) ? " (subtes sama)" : ""} · kebutuhan {numberID(p.kebutuhan || 0)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <small className="muted">Katalog {namaBulan(pindah.bulan)} belum punya proyek.</small>
            )
          ) : null}
          {pindah.proyek && !pindah.proyek.some((p) => samaSubtes(p.subtes, a.subtes)) ? (
            <small className="muted">Belum ada proyek {a.subtes} di {namaBulan(pindah.bulan)} — tambahkan dulu di Katalog bulan itu, atau pilih proyek lain.</small>
          ) : null}
          <div className="ak-aksi">
            <button
              type="button"
              className="btn btn-blue sm"
              disabled={kunci || !sah || !pindah.idProyek}
              onClick={() => window.confirm(`Pindahkan ${n} soal ${a.subtes} ke proyek ${pindah.idProyek} di katalog ${namaBulan(pindah.bulan)}? Kebutuhan proyek itu bertambah ${n} soal.`) && onAksi(a, "pindah", n, { bulanTujuan: pindah.bulan, idProyekTujuan: pindah.idProyek, label: `${pindah.idProyek} (${namaBulan(pindah.bulan)})` })}
            >
              Pindahkan {numberID(n)} soal
            </button>
            <button type="button" className="btn btn-ghost sm" onClick={() => setPindah(null)}>
              Batal
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function ArsipKuota({ arsip = [], bisa, namaBulan, months = [], setErr, onBerubah }) {
  const [sibuk, setSibuk] = useState(false);
  const [info, setInfo] = useState("");
  const aktif = arsip.filter((a) => a.sisa > 0);
  if (!aktif.length && !info) return null;
  const total = aktif.reduce((n, a) => n + a.sisa, 0);
  const aksi = async (a, jenis, jumlah, tujuan = {}) => {
    setSibuk(true);
    setErr("");
    setInfo("");
    try {
      const res = await fetch("/api/admin/pengerjaan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "arsip", id: a.id, aksi: jenis, jumlah, bulanTujuan: tujuan.bulanTujuan, idProyekTujuan: tujuan.idProyekTujuan }), cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      await onBerubah?.();
      setInfo(jenis === "buka" ? `${numberID(jumlah)} soal ${a.subtes} dibuka lagi ke katalog.` : jenis === "pindah" ? `${numberID(jumlah)} soal ${a.subtes} dipindah ke ${tujuan.label}.` : `${numberID(jumlah)} soal ${a.subtes} dihanguskan.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSibuk(false);
    }
  };
  return (
    <section className="card ak" aria-label="Kuota diarsipkan">
      <div>
        <h2>Kuota diarsipkan{aktif.length ? ` · ${numberID(total)} soal` : ""}</h2>
        <p className="muted">
          Soal yang ditolak saat review / pengambilan dihentikan dan belum dibuka lagi{namaBulan ? ` (${namaBulan})` : ""}. Belum tampil untuk guru sampai dibuka ke katalog.
        </p>
      </div>
      {aktif.length ? (
        <ul className="ak-list">
          {aktif.map((a) => (
            <BarisArsip key={`${a.id}:${a.sisa}`} a={a} bisa={bisa} sibuk={sibuk} onAksi={aksi} months={months} />
          ))}
        </ul>
      ) : null}
      {info ? (
        <p className="ak-ok" role="status">
          <Icon name="check" size={14} /> {info}
        </p>
      ) : null}
    </section>
  );
}
