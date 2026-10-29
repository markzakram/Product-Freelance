"use client";

import { useState } from "react";
import { riwayatPengambilan, linkSah, laporanGuru, siklusRevisi, labelSiklusRevisi } from "@/lib/pengerjaanOpsi";
import { numberID } from "@/lib/format";
import Icon from "./Icon";

export function judulAktivitas(e) {
  const laporan = `Laporan ${e.noLaporan || "progres"}`;
  switch (e.jenis) {
    case "laporan": return laporan;
    case "revisi_laporan": return `Revisi ${e.versi - 1} dikirim · ${laporan}`;
    case "dicek": return `${laporan} diperiksa`;
    case "minta_revisi": return `Revisi ${e.versi} diminta · ${laporan}`;
    case "pengumpulan": return "Hasil akhir dikumpulkan";
    case "revisi_akhir": return `Revisi ${e.versi - 1} dikirim · Hasil akhir`;
    case "review": return e.lama ? "Review terakhir yang tersimpan" : e.meta?.dihentikan ? "Pengambilan dihentikan" : e.meta?.revisi ? `Revisi ${e.versi || e.meta.ronde} diminta · Hasil akhir` : `Review ${e.meta?.ronde || ""} · selesai`;
    case "acc": return "Pengajuan disetujui";
    case "tolak": return "Pengajuan ditolak";
    case "batal": return "Pengajuan dibatalkan";
    case "ubah_tolak": return `Tujuan kuota ditolak diubah · ${e.meta?.jumlah || e.soal || ""} soal ${{ buka: "dibuka lagi", hangus: "hangus", arsip: "diarsipkan" }[e.meta?.dari] || ""} → ${{ buka: "dibuka lagi", hangus: "hangus", arsip: "diarsipkan" }[e.meta?.ke] || ""}`;
    case "kabar": return `Kabar dikirim · ${e.meta?.judul || "Hasil pemeriksaan"}`;
    case "reminder": return `Reminder dikirim · ${e.meta?.judul || "Pengambilan"}`;
    default: return "Aktivitas pengerjaan";
  }
}

export default function RiwayatPengambilan({ p, awal = "semua" }) {
  const [tahap, setTahap] = useState(String(awal));
  const semua = riwayatPengambilan(p);
  const events = semua.filter((e) => tahap === "semua" || e.persen === Number(tahap));
  const siklus = [...laporanGuru(p).map((l) => ({ key: l.laporanId, persen: l.persen, nama: `Laporan ${l.noLaporan}`, ...siklusRevisi(p, l.persen, l.laporanId) })), { key: "akhir", persen: 100, nama: "Hasil akhir", ...siklusRevisi(p, 100) }].filter((s) => (s.dikirim || s.diminta) && (tahap === "semua" || s.persen === Number(tahap)));
  return (
    <div className="pg-riwayat">
      <div className="pg-stage-tabs" role="group" aria-label="Tahap dalam riwayat">
        {["semua", 30, 50, 100].map((n) => <button key={n} type="button" className={"btn sm " + (tahap === String(n) ? "btn-blue" : "btn-ghost")} aria-pressed={tahap === String(n)} onClick={() => setTahap(String(n))}>{n === "semua" ? "Semua riwayat" : `${n}%`}</button>)}
      </div>
      {siklus.length ? <div className="pg-revision-summary" aria-label="Ringkasan revisi">{siklus.map((s) => <div key={s.key}><div className="pg-revision-summary-title"><Icon name="restore" size={15} /><b>{s.nama} · {s.persen}%</b></div><strong>{labelSiklusRevisi(s)}</strong><small>{s.dikirim ? `Perbaikan terakhir yang diterima: revisi ${s.dikirim}` : "Belum ada kiriman perbaikan"}</small>{s.diminta ? <small>Menunggu guru mengirim revisi {s.diminta}.</small> : <small>Hasil pemeriksaan tercatat di riwayat berikut.</small>}</div>)}</div> : null}
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
