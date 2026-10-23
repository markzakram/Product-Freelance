"use client";

import { numberID } from "@/lib/format";
import Icon from "./Icon";
import { useEffect, useState } from "react";

const persen = (n, target) => target > 0 ? Math.round(n / target * 100) : 0;
export default function DashboardPengambilan({ ringkasan: s, tim, namaBulan, onFokus, onKuota, onSubtes }) {
  const [rincian, setRincian] = useState(true);
  useEffect(() => { if (window.matchMedia("(max-width:600px)").matches) setRincian(false); }, []);
  const prioritas = tim === "rad" ? [
    ["ulang", "QC ulang kiriman revisi", s.counts.ulang, "pengambilan"],
    ["awal", "QC hasil akhir pertama", s.counts.awal, "pengambilan"],
    ["progres", "Periksa laporan progres", s.counts.progres, "pengambilan"],
    ["acc", "ACC pengajuan guru", s.counts.acc, "pengambilan"],
    ["revisi", "Menunggu perbaikan guru", s.counts.revisi, "pengambilan"],
  ] : [
    ["siap", "Hasil RAD belum dikabari", s.counts.siap, "pengambilan"],
    ["reminder", "Reminder belum dikirim hari ini", s.counts.reminder, "pengambilan"],
    ["kuota", "Proyek dengan kuota terbuka", s.kuota.length, "proyek"],
    ["sudah", "Semua hasil sudah dikabari", s.counts.sudah, "pengambilan"],
  ];
  return <section className="pd-dashboard" aria-label="Dashboard produksi dan tindak lanjut">
    <div className="section-head"><div><h2>Overview produksi</h2><p className="pd-scope">{namaBulan || "Bulan aktif"} · seluruh katalog dan pengambilan</p></div><span className="pill run">{s.baris.length} pengambilan · {s.subtes.length} subtes</span></div>
    <div className="grid pd-kpis">
      <button type="button" className="card stat pd-kpi" onClick={() => onFokus("semua")}><span className="label">Kuota sudah diambil</span><span className="value">{numberID(s.terisi)} <small>/ {numberID(s.target)} soal</small></span><div className="meter"><i style={{ width: `${Math.min(100, persen(s.terisi, s.target))}%` }} /></div><span className="sub">{persen(s.terisi, s.target)}% kuota terisi · dari katalog</span></button>
      <button type="button" className="card stat pd-kpi" onClick={() => onFokus("lolos")}><span className="label">Soal disetujui setelah QC</span><span className="value green">{numberID(s.lolos)} <small>soal</small></span><div className="meter pd-approved"><i style={{ width: `${Math.min(100, persen(s.lolos, s.target))}%` }} /></div><span className="sub">Hasil review pengambilan · termasuk persetujuan parsial</span></button>
      <button type="button" className="card stat pd-kpi pd-kpi-focus" onClick={() => onFokus(tim === "rad" ? "tugas" : "siap")}><span className="label">{tim === "rad" ? "Perlu tindakan RAD" : "Hasil perlu dikabari CLO"}</span><span className="value">{tim === "rad" ? s.counts.tugas : s.counts.siap} <small>pengambilan</small></span><span className="sub">{tim === "rad" ? `${s.counts.acc} ACC · ${s.counts.progres} progres · ${s.counts.qc} QC` : `${s.counts.reminder} perlu reminder · ${s.kuota.length} proyek butuh guru`}</span><span className="pd-kpi-link">Lihat di matriks<Icon name="chevronRight" size={14} /></span></button>
    </div>
    <details className="pd-insights" open={rincian} onToggle={(e) => setRincian(e.currentTarget.open)}>
      <summary>Capaian per subtes & prioritas tim<Icon name="chevronDown" size={16} /></summary>
      <div className="pd-panels">
        <section className="card pd-production" aria-label="Capaian produksi per subtes"><div className="section-head"><h3>Capaian per subtes</h3><div className="pd-legend"><span><i className="pd-dot" />Terisi</span><span><i className="pd-dot approved" />Lolos QC</span></div></div>
          {s.subtes.map((g) => <div className="pd-subtes" key={g.key} data-dashboard-subtes={g.key}>
            <div className="pd-subtes-head"><button type="button" className="btn-link" onClick={() => onSubtes(g.key)}>{g.nama}<Icon name="chevronRight" size={13} /></button><span>{g.target ? `Target ${numberID(g.target)} soal` : "Tidak ada target katalog"}</span></div>
            {[['terisi', 'Terisi', 'semua'], ['lolos', 'Lolos QC', 'lolos']].map(([key, label, fokus]) => <button type="button" className={"pd-chart-row " + key} key={key} aria-label={`${g.nama}: ${label} ${g[key]} dari ${g.target} soal. Tampilkan pengambilan.`} onClick={() => onSubtes(g.key, fokus)}><span>{label}</span><span className="pd-track" aria-hidden="true"><i style={{ width: `${Math.min(100, persen(g[key], g.target))}%` }} /></span><span>{numberID(g[key])}{g.target ? ` / ${numberID(g.target)}` : ""}</span></button>)}
            <div className="pd-subtes-actions"><button type="button" className="btn-link" onClick={() => onSubtes(g.key, "periksa")}>{g.periksa} perlu diperiksa</button><button type="button" className="btn-link" onClick={() => onSubtes(g.key, "revisi")}>{g.revisi} dalam revisi</button><button type="button" className="btn-link" onClick={() => onSubtes(g.key, "siap")}>{g.kabar} belum dikabari</button></div>
          </div>)}
          {!s.subtes.length ? <div className="empty">Belum ada katalog atau pengambilan pada bulan ini.</div> : null}
          <p className="pd-source-note">Terisi mengikuti katalog. Lolos QC mengikuti review di Pengambilan Guru; kiriman 100% belum berarti disetujui.</p>
        </section>
        <section className="card pd-priorities" aria-label={`Prioritas tim ${tim.toUpperCase()}`}><div className="section-head"><h3>Fokus tim {tim.toUpperCase()}</h3><Icon name={tim === "rad" ? "clipboard" : "send"} /></div>{prioritas.map(([key, label, n, unit]) => <button type="button" className="pd-priority" key={key} onClick={() => key === "kuota" ? onKuota() : onFokus(key)}><span><b>{n}</b><small className="sr-only">{unit}</small></span><span>{label}</span><Icon name="chevronRight" size={15} /></button>)}<p className="pd-source-note">Pilih angka atau prioritas untuk langsung menyaring matriks di bawah.</p></section>
      </div>
    </details>
  </section>;
}
