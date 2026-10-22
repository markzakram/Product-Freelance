"use client";

import { useState } from "react";
import { riwayatPengambilan, linkSah } from "@/lib/pengerjaanOpsi";
import { numberID } from "@/lib/format";
import Icon from "./Icon";

export function judulAktivitas(e) {
  const laporan = `Laporan ${e.noLaporan || "progres"}`;
  switch (e.jenis) {
    case "laporan": return laporan;
    case "revisi_laporan": return `Revisi ${e.versi - 1} · ${laporan}`;
    case "dicek": return `${laporan} diperiksa`;
    case "minta_revisi": return `Revisi diminta · ${laporan}`;
    case "pengumpulan": return "Hasil akhir dikumpulkan";
    case "revisi_akhir": return `Revisi hasil akhir · versi ${e.versi}`;
    case "review": return e.lama ? "Review terakhir yang tersimpan" : e.meta?.revisi ? `Review ${e.meta.ronde || ""} · perlu revisi` : `Review ${e.meta?.ronde || ""} · selesai`;
    case "acc": return "Pengajuan disetujui";
    case "tolak": return "Pengajuan ditolak";
    case "batal": return "Pengajuan dibatalkan";
    default: return "Aktivitas pengerjaan";
  }
}

export default function RiwayatPengambilan({ p, awal = "semua" }) {
  const [tahap, setTahap] = useState(String(awal));
  const semua = riwayatPengambilan(p);
  const events = semua.filter((e) => tahap === "semua" || e.persen === Number(tahap));
  return (
    <div className="pg-riwayat">
      <div className="pg-stage-tabs" role="group" aria-label="Tahap dalam riwayat">
        {["semua", 30, 50, 100].map((n) => <button key={n} type="button" className={"btn sm " + (tahap === String(n) ? "btn-blue" : "btn-ghost")} aria-pressed={tahap === String(n)} onClick={() => setTahap(String(n))}>{n === "semua" ? "Semua riwayat" : `${n}%`}</button>)}
      </div>
      {semua.some((e) => e.lama) ? <p className="pg-legacy">Riwayat lama memuat data yang masih tersimpan. Versi sebelum pembaruan mungkin tidak lengkap.</p> : null}
      {!events.length ? <p className="muted">Belum ada aktivitas{tahap === "semua" ? "" : ` pada tahap ${tahap}%`}.</p> : (
        <ol className="pg-timeline">
          {events.map((e) => (
            <li key={e.id} className={"pg-event " + (["minta_revisi", "revisi_laporan", "revisi_akhir"].includes(e.jenis) || e.meta?.revisi ? "revision" : e.jenis === "dicek" || e.jenis === "review" ? "checked" : "")}>
              <time className="pg-event-time" dateTime={e.t ? new Date(e.t).toISOString() : undefined}>{e.waktu || "—"}<small>WIB</small></time>
              <div className="pg-event-body">
                <div className="pg-event-title"><b>{judulAktivitas(e)}</b>{e.persen ? <span className="pill run">{e.persen}%</span> : null}</div>
                <div className="pg-event-meta">{e.oleh || "—"}{["laporan", "revisi_laporan", "pengumpulan", "revisi_akhir"].includes(e.jenis) ? ` · ${numberID(e.soal)}/${numberID(p.jumlah)} soal dilaporkan` : ""}</div>
                {e.jenis === "review" ? <p className="pg-event-result">{numberID(e.meta?.setuju || 0)} disetujui · {numberID(e.meta?.revisi || 0)} revisi · {numberID(e.meta?.tolak || 0)} ditolak{e.meta?.batas ? ` · batas revisi ${e.meta.batas}` : ""}</p> : null}
                {e.catatan ? <p className="pg-event-note">{e.catatan}</p> : null}
                {linkSah(e.link) ? <a className="pg-document" href={e.link} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} /> Buka {e.persen === 100 ? "hasil akhir" : "laporan"}{e.versi ? ` · versi ${e.versi}` : ""}</a> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
