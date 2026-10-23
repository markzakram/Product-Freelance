"use client";

// Satu tabel untuk semua pengambilan bulan ini, dikelompokkan per subtes atau
// per guru. Satu baris = satu pengambilan: alur (titik ACC→30→50→100→QC),
// satu label status, tenggat terdekat, dan kabar CLO. Klik baris = panel detail.

import { numberID } from "@/lib/format";
import { teksJumlah } from "@/lib/paket";
import { kunciSubtesPengambilan, kunciGuruPengambilan } from "@/lib/pengambilanFilter";
import { alurPengambilan, statusRingkas, tenggatPengambilan } from "@/lib/antreanPengambilan";
import Icon from "./Icon";

export function kelompokPengambilan(daftar, view) {
  const grup = new Map();
  for (const r of daftar) {
    const p = r.p;
    const key = view === "guru" ? kunciGuruPengambilan(p) : kunciSubtesPengambilan(p);
    if (!grup.has(key)) grup.set(key, { key, nama: view === "guru" ? p.nama || p.email || "Guru tanpa nama" : p.subtes || "Tanpa subtes", list: [] });
    grup.get(key).list.push(r);
  }
  return [...grup.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

const TANDA = { ok: "✓", x: "✕", skip: "–" };

export function Alur({ p, kini }) {
  const alur = alurPengambilan(p, kini);
  return (
    <span className="pk-alur" role="img" aria-label={alur.map((a) => `${a.label === "ACC" || a.label === "QC" ? a.label : a.label + "%"}: ${a.ket}`).join("; ")}>
      {alur.map((a, i) => (
        <span key={a.k} className="pk-alur-step">
          {i ? <b className={a.s && a.s !== "skip" ? "on" : ""} aria-hidden="true" /> : null}
          <i className={a.s} title={`${a.label === "ACC" || a.label === "QC" ? a.label : a.label + "%"} · ${a.ket}`} aria-hidden="true">
            {TANDA[a.s] || a.label}
          </i>
        </span>
      ))}
    </span>
  );
}

function KabarSel({ r }) {
  const perluReminder = r.pengingat.some((i) => !i.terkirim);
  if (r.siap.length) return <span className="pk-kabar belum">● Belum dikabari{r.siap.length > 1 ? ` (${r.siap.length})` : ""}</span>;
  const akhir = [...r.sudah].sort((a, b) => (b.kabar.t || 0) - (a.kabar.t || 0))[0];
  return (
    <>
      {akhir ? <span className="pk-kabar sudah">✓ Dikabari {String(akhir.kabar.waktu || "").split(" ")[0]}</span> : <span className="pk-kabar na">—</span>}
      {perluReminder ? <small className="pk-kabar belum">Perlu reminder</small> : null}
    </>
  );
}

export const LegendaAlur = () => (
  <p className="pk-legend" aria-hidden="true">
    <span><i className="ok">✓</i>selesai</span>
    <span><i className="cek">30</i>masuk, perlu diperiksa</span>
    <span><i className="now">50</i>sedang dikerjakan guru</span>
    <span><i className="late">50</i>lewat tanggal</span>
    <span><i className="rev">QC</i>revisi</span>
    <span><i className="skip">–</i>tidak wajib</span>
  </p>
);

export default function TabelPengambilan({ daftar, view, selected, onPilih, kini, targetSubtes = {} }) {
  const grup = kelompokPengambilan(daftar, view);
  return (
    <div className="pk-tabel-wrap">
      <table className="pk-tabel">
        <caption className="sr-only">Semua pengambilan, dikelompokkan per {view === "guru" ? "guru" : "subtes"}</caption>
        <thead>
          <tr>
            <th scope="col">{view === "guru" ? "Subtes" : "Guru"}</th>
            <th scope="col" className="num">Soal</th>
            <th scope="col">Alur</th>
            <th scope="col">Status</th>
            <th scope="col">Tenggat</th>
            <th scope="col">Kabar CLO</th>
          </tr>
        </thead>
        {grup.map((g) => {
          const soal = g.list.reduce((n, r) => n + (r.p.jumlah || 0), 0);
          const nLain = new Set(g.list.map((r) => (view === "guru" ? kunciSubtesPengambilan(r.p) : kunciGuruPengambilan(r.p)))).size;
          const target = view === "guru" ? 0 : targetSubtes[g.key] || 0;
          return (
            <tbody key={g.key}>
              <tr className="pk-grp">
                <th scope="colgroup" colSpan={6}>
                  <Icon name={view === "guru" ? "users" : "layers"} size={14} />
                  {g.nama}
                  <span>
                    {nLain} {view === "guru" ? "subtes" : "guru"} · {numberID(soal)} soal{target ? ` · target ${numberID(target)}` : ""}
                  </span>
                </th>
              </tr>
              {g.list.map((r) => {
                const p = r.p;
                const st = statusRingkas(p, kini);
                const tg = tenggatPengambilan(p, kini);
                const buka = () => onPilih(p.id);
                return (
                  <tr key={p.id} className={p.id === selected ? "selected" : ""} onClick={buka}>
                    <td className="pk-nama">
                      <button type="button" className="pk-nama-btn" onClick={(e) => { e.stopPropagation(); buka(); }} aria-label={`Buka detail ${p.nama || p.email}, ${p.subtes}`}>
                        <b>{view === "guru" ? p.subtes || "—" : p.nama || p.email || "—"}</b>
                        {p.uji ? <span className="pill batal plain">UJI</span> : null}
                      </button>
                      <small>
                        {p.idProyek}
                        {p.tipe ? ` · ${p.tipe}` : ""}
                        {p.isiPaket ? ` · ${teksJumlah(p.jumlah, p.isiPaket).split(" (")[0]}` : ""}
                        <span className="pk-soal-m"> · {numberID(p.jumlah)} soal</span>
                      </small>
                    </td>
                    <td className="num" data-l="Soal">{numberID(p.jumlah)}</td>
                    <td className="pk-td-alur" data-l="Alur"><Alur p={p} kini={kini} /></td>
                    <td data-l="Status"><span className={"pill " + st.kelas}>{st.label}</span></td>
                    <td data-l="Tenggat">{tg ? <span className={"pk-due " + (tg.kelas || "n")}><small>{tg.ket}</small>{tg.teks}</span> : <span className="pk-kabar na">—</span>}</td>
                    <td data-l="Kabar CLO"><KabarSel r={r} /></td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
