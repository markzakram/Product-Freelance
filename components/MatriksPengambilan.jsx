"use client";

import { numberID } from "@/lib/format";
import { ST, kelasStatus, labelStatus, tahapPengambilan, tanggalPendek, revisiProgres, laporanBaru, siklusRevisi, labelSiklusRevisi } from "@/lib/pengerjaanOpsi";
import Icon from "./Icon";

function labelTanggal(t) {
  if (t.waktu) return t.waktu.split(" ")[0];
  return t.tanggal ? tanggalPendek(t.tanggal) : "—";
}

export function kelompokPengambilan(daftar, view) {
  const grup = new Map();
  for (const p of daftar) {
    const key = view === "guru" ? p.idGuru ? `id:${p.idGuru}` : p.email ? `email:${p.email}` : `pengambilan:${p.id}` : (p.subtes || "Tanpa subtes").trim().toLocaleLowerCase("id");
    if (!grup.has(key)) grup.set(key, { key, nama: view === "guru" ? p.nama || p.email || "Guru tanpa nama" : p.subtes || "Tanpa subtes", list: [] });
    grup.get(key).list.push(p);
  }
  return [...grup.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

export default function MatriksPengambilan({ daftar, view, selected, onPilih }) {
  return (
    <div className="pg-matrix">
      {kelompokPengambilan(daftar, view).map((grup) => (
        <section className="pg-group" key={grup.key} aria-label={grup.nama}>
          <div className="pg-group-heading"><h3><Icon name={view === "guru" ? "users" : "layers"} />{grup.nama}</h3><span>{new Set(grup.list.map((p) => view === "guru" ? p.subtes : p.idGuru || p.email || p.id)).size} {view === "guru" ? "subtes" : "guru"} · {numberID(grup.list.reduce((n, p) => n + p.jumlah, 0))} soal</span></div>
          <table className="pg-table">
            <caption className="sr-only">Pengambilan {grup.nama}, tahap progres dan status pemeriksaan</caption>
            <thead><tr><th scope="col">{view === "guru" ? "Subtes" : "Guru"}</th>{[30, 50, 100].map((n) => <th scope="col" key={n}>{n}%</th>)}<th scope="col">Status & tindak lanjut</th></tr></thead>
            <tbody>{grup.list.map((p) => {
              const baru = laporanBaru(p).length;
              const perluRevisi = p.status === ST.running ? revisiProgres(p) : [];
              const revisi = perluRevisi.length > 0;
              const siklus = revisi ? siklusRevisi(p, perluRevisi[0].persen, perluRevisi[0].laporanId) : siklusRevisi(p, 100);
              return <tr key={p.id} className={p.id === selected ? "selected" : ""}>
                <td><div className="pg-row-name"><b>{view === "guru" ? p.subtes || "—" : p.nama || p.email || "—"}</b>{p.uji ? <span className="pill batal plain">UJI</span> : null}<small>{p.idProyek} · {teksSoal(p)}{p.tipe ? ` · ${p.tipe}` : ""}</small><small>{p.output || "—"}</small></div></td>
                {[30, 50, 100].map((n) => {
                  const t = tahapPengambilan(p, n);
                  const label = t.label === "Revisi" && t.siklus?.diminta ? `Revisi ${t.siklus.diminta}` : t.label;
                  return <td key={n}><div className="pg-stage-cell"><span className="pg-mobile-stage">{n}%</span><button type="button" className={"pg-stage-button " + (t.kelas || "")} onClick={() => onPilih(p.id, t.via || n)} aria-label={`Riwayat ${n}% ${p.nama || p.email}, ${p.subtes}`}><Icon name={t.label === "Revisi" ? "restore" : ["Diperiksa", "Selesai"].includes(t.label) ? "check" : t.label === "Baru" ? "file" : "calendar"} size={14} />{label}</button><small>{labelTanggal(t)}</small>{t.siklus?.dikirim || t.siklus?.diminta ? <small className="pg-cycle-marker">{labelSiklusRevisi(t.siklus)}</small> : null}</div></td>;
                })}
                <td><div className="pg-status-cell"><span className={"pill " + (revisi ? "rev" : baru && p.status === ST.running ? "qc" : kelasStatus(p.status))}>{revisi || p.status === ST.revisi ? labelSiklusRevisi(siklus) : baru && p.status === ST.running ? "Laporan baru" : labelStatus(p.status).replace("Running · sedang dikerjakan", "Dikerjakan")}</span><small>{p.status === ST.revisi ? `Batas revisi ${p.batasRevisi || "—"}` : `Deadline ${tanggalPendek(p.deadline)}`}</small><button type="button" className="btn btn-ghost sm" aria-expanded={p.id === selected} aria-controls="pg-selected" onClick={() => onPilih(p.id, "semua")}>Riwayat <Icon name="chevronLeft" size={14} /></button></div></td>
              </tr>;
            })}</tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

const teksSoal = (p) => `${numberID(p.jumlah)} soal`;
