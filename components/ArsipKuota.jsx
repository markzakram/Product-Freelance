"use client";

// Kuota soal yang ditolak lalu DIARSIPKAN (tab "Arsip kuota"): belum tampil di
// katalog. Tim akademik membuka sebagian/semuanya ke katalog (kebutuhan proyek
// ditambah lagi) atau menghanguskannya. Server: lib/arsipKuota.js.

import { useState } from "react";
import { numberID } from "@/lib/format";
import Icon from "./Icon";

function BarisArsip({ a, bisa, sibuk, onAksi }) {
  const [n, setN] = useState(a.sisa);
  const sah = n >= 1 && n <= a.sisa;
  const kunci = !bisa || sibuk;
  return (
    <li className="ak-item">
      <div className="ak-info">
        <b>
          {a.subtes || a.idProyek}
          <small>{a.idProyek}</small>
        </b>
        <span>
          {numberID(a.sisa)} soal diarsipkan
          {a.dibuka || a.hangus ? ` · dari ${numberID(a.jumlah)} (dibuka ${numberID(a.dibuka)}, hangus ${numberID(a.hangus)})` : ""}
        </span>
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
        <button
          type="button"
          className="btn btn-ghost sm ak-hangus"
          disabled={kunci || !sah}
          onClick={() => window.confirm(`Hanguskan ${n} soal ${a.subtes} (${a.idProyek})? Kuota ini tidak akan dibuka lagi.`) && onAksi(a, "hangus", n)}
        >
          Hanguskan
        </button>
      </div>
    </li>
  );
}

export default function ArsipKuota({ arsip = [], bisa, namaBulan, setErr, onBerubah }) {
  const [sibuk, setSibuk] = useState(false);
  const [info, setInfo] = useState("");
  const aktif = arsip.filter((a) => a.sisa > 0);
  if (!aktif.length && !info) return null;
  const total = aktif.reduce((n, a) => n + a.sisa, 0);
  const aksi = async (a, jenis, jumlah) => {
    setSibuk(true);
    setErr("");
    setInfo("");
    try {
      const res = await fetch("/api/admin/pengerjaan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "arsip", id: a.id, aksi: jenis, jumlah }), cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      await onBerubah?.();
      setInfo(jenis === "buka" ? `${numberID(jumlah)} soal ${a.subtes} dibuka lagi ke katalog.` : `${numberID(jumlah)} soal ${a.subtes} dihanguskan.`);
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
            <BarisArsip key={`${a.id}:${a.sisa}`} a={a} bisa={bisa} sibuk={sibuk} onAksi={aksi} />
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
