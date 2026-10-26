"use client";

// Pengambilan Guru = satu-satunya ruang kerja RAD & CLO (v3.14.0):
//   angka ringkas → antrean tugas tim → tabel semua pengambilan → produksi per subtes.
// Tugas RAD/CLO dipilih dari peran akun; pemilik / akun dua peran bisa berpindah.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ringkasanPengambilan } from "@/lib/pengambilanDashboard";
import { tugasRad, tugasClo, kuotaButuhGuru, cocokSaringTabel } from "@/lib/antreanPengambilan";
import { timPantauan } from "@/lib/peranTim";
import { numberID } from "@/lib/format";
import PengerjaanPanel from "./PengerjaanPanel";
import CariGuru from "./CariGuru";
import Icon from "./Icon";

const persen = (n, target) => (target > 0 ? Math.round((n / target) * 100) : 0);
const Meter = ({ n, target, ok }) => (
  <span className="pk-meter">
    <span className={"pk-bar" + (ok ? " ok" : "")} aria-hidden="true"><i style={{ width: `${Math.min(100, persen(n, target))}%` }} /></span>
    <span>{numberID(n)}{target ? ` / ${numberID(target)}` : ""}</span>
  </span>
);

export default function PusatPengambilan({ data, bulan, namaBulan, pengguna, projects = [], guruDb = [], master = [], log = [], riwayat = [], akun = [], kontak = [], penanda = {}, wajibLogin, muatUlang, muatReachout, setErr, aksiEl, onBerubah, pilihTab, fokusNotifikasi, onNotifikasiDibuka }) {
  const peran = timPantauan(pengguna);
  const [tim, setTim] = useState(peran[0] || "clo");
  const [tabClo, setTabClo] = useState("kabar");
  const [sorotan, setSorotan] = useState(null);
  const [produksi, setProduksi] = useState(false);
  const [cariGuru, setCariGuru] = useState(null);
  const [kini, setKini] = useState(Date.now);
  const antreanRef = useRef(null), produksiRef = useRef(null);
  useEffect(() => { setSorotan(null); setCariGuru(null); }, [bulan]);
  useEffect(() => { if (fokusNotifikasi) { setTim("clo"); setTabClo("kabar"); } }, [fokusNotifikasi]);
  // Reachout tidak ikut sinkron berkala (hemat kuota): diperbarui saat tab Butuh guru dibuka.
  useEffect(() => { if (tim === "clo" && tabClo === "kuota") muatReachout?.(false); }, [tim, tabClo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const tick = setInterval(() => setKini(Date.now()), 60000); return () => clearInterval(tick); }, []);
  const s = useMemo(() => ringkasanPengambilan(projects, data?.pengerjaan || [], kini), [projects, data, kini]);
  const tugas = useMemo(() => (tim === "rad" ? tugasRad(s.baris) : tugasClo(s.baris)), [tim, s]);
  const kuota = useMemo(() => kuotaButuhGuru(projects, data?.pengerjaan || [], kontak, bulan, kini), [projects, data, kontak, bulan, kini]);
  const lewat = s.baris.filter((r) => cocokSaringTabel(r, "lewat")).length;
  const targetSubtes = useMemo(() => Object.fromEntries(s.subtes.map((g) => [g.key, g.target])), [s]);
  const keAntrean = () => antreanRef.current?.scrollIntoView({ block: "start" });
  const keTabel = (x) => setSorotan({ ...x, n: Date.now() });
  const bukaProduksi = () => { setProduksi(true); setTimeout(() => produksiRef.current?.scrollIntoView({ block: "start" }), 0); };

  if (!data) return <div className="card empty">Memuat Pengambilan Guru…</div>;
  if (data.error) return <div className="banner err" role="alert"><Icon name="alert" /><div>Data pengambilan belum bisa dibaca: {data.error}</div><button type="button" className="btn btn-ghost sm" onClick={() => muatUlang(true)}>Coba lagi</button></div>;
  return (
    <div className="pk">
      {aksiEl && tim === "rad" ? createPortal(<><button type="button" className="btn btn-ghost sm" onClick={() => pilihTab("katalog")}><Icon name="layers" />Katalog</button><button type="button" className="btn btn-blue sm" onClick={() => pilihTab("baru")}><Icon name="plus" />Buat proyek</button></>, aksiEl) : null}

      <div className="pk-head">
        {peran.length > 1 ? (
          <div className="seg-tab" role="group" aria-label="Tugas tim">
            {peran.map((k) => <button type="button" key={k} className={tim === k ? "on" : ""} aria-pressed={tim === k} onClick={() => setTim(k)}>Tugas {k.toUpperCase()}</button>)}
          </div>
        ) : <span className="pill run">Tugas {tim.toUpperCase()}</span>}
        <span className="muted">{pengguna.nama} · {namaBulan || bulan}</span>
      </div>

      <div className="pk-kpi">
        <button type="button" className="pk-k" onClick={bukaProduksi}>
          <span>Kuota terisi</span>
          <b>{numberID(s.terisi)} <small>/ {numberID(s.target)} soal · {persen(s.terisi, s.target)}%</small></b>
          <span className="pk-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, persen(s.terisi, s.target))}%` }} /></span>
        </button>
        <button type="button" className="pk-k" onClick={bukaProduksi}>
          <span>Lolos QC</span>
          <b>{numberID(s.lolos)} <small>soal{s.target ? ` · ${persen(s.lolos, s.target)}% target` : ""}</small></b>
          <span className="pk-bar ok" aria-hidden="true"><i style={{ width: `${Math.min(100, persen(s.lolos, s.target))}%` }} /></span>
        </button>
        <button type="button" className={"pk-k" + (tugas.length ? " alert" : "")} onClick={() => { if (tim === "clo") setTabClo("kabar"); keAntrean(); }}>
          <span>{tim === "rad" ? "Perlu tindakan RAD" : "Perlu dikabari CLO"}</span>
          <b>{numberID(tugas.length)} <small>tugas</small></b>
          <small className="pk-k-link">Lihat antrean<Icon name="chevronRight" size={13} /></small>
        </button>
        {tim === "rad" ? (
          <button type="button" className={"pk-k" + (lewat ? " bad" : "")} onClick={() => keTabel({ saring: "lewat" })}>
            <span>Lewat tenggat</span>
            <b>{numberID(lewat)} <small>pengambilan</small></b>
            <small className="pk-k-link">Saring tabel<Icon name="chevronRight" size={13} /></small>
          </button>
        ) : (
          <button type="button" className={"pk-k" + (kuota.length ? " alert" : "")} onClick={() => { setTabClo("kuota"); keAntrean(); }}>
            <span>Butuh guru</span>
            <b>{numberID(kuota.length)} <small>proyek · {numberID(kuota.reduce((n, k) => n + k.tersedia, 0))} soal</small></b>
            <small className="pk-k-link">Cari guru<Icon name="chevronRight" size={13} /></small>
          </button>
        )}
      </div>

      <PengerjaanPanel data={data} bulan={bulan} namaBulan={namaBulan} projects={projects} guruDb={guruDb} muatUlang={muatUlang} setErr={setErr} aksiEl={aksiEl} onBerubah={onBerubah} onSegarkan={() => Promise.all([muatUlang(true), onBerubah?.(), muatReachout?.()])} tim={tim} baris={s.baris} tugas={tugas} kuota={kuota} tabClo={tabClo} setTabClo={setTabClo} onCariGuru={(k) => setCariGuru({ ...k, sisa: k.tersedia })} sorotan={sorotan} kini={kini} antreanRef={antreanRef} targetSubtes={targetSubtes} fokusNotifikasi={fokusNotifikasi} onNotifikasiDibuka={onNotifikasiDibuka} />

      <details ref={produksiRef} className="pk-produksi pk-anchor" open={produksi} onToggle={(e) => setProduksi(e.currentTarget.open)}>
        <summary>
          <span><b>Produksi per subtes</b><small>{s.subtes.length} subtes · terisi {numberID(s.terisi)}/{numberID(s.target)} · lolos QC {numberID(s.lolos)}</small></span>
          <Icon name="chevronDown" size={16} />
        </summary>
        {s.subtes.length ? (
          <div className="pk-tabel-wrap">
            <table className="pk-prod">
              <thead><tr><th scope="col">Subtes</th><th scope="col">Terisi</th><th scope="col">Lolos QC</th><th scope="col" className="num">Perlu diperiksa</th><th scope="col" className="num">Revisi</th><th scope="col" className="num">Belum dikabari</th></tr></thead>
              <tbody>
                {s.subtes.map((g) => (
                  <tr key={g.key}>
                    <td><button type="button" className="btn-link" onClick={() => keTabel({ subtes: g.key })} title="Tampilkan pengambilan subtes ini di tabel">{g.nama}</button></td>
                    <td data-l="Terisi"><Meter n={g.terisi} target={g.target} /></td>
                    <td data-l="Lolos QC"><Meter n={g.lolos} target={g.target} ok /></td>
                    <td className="num" data-l="Perlu diperiksa">{g.periksa ? <button type="button" className="btn-link" onClick={() => keTabel({ subtes: g.key, saring: "tindakan" })}>{g.periksa}</button> : "–"}</td>
                    <td className="num" data-l="Revisi">{g.revisi || "–"}</td>
                    <td className="num" data-l="Belum dikabari">{g.kabar ? <button type="button" className="btn-link" onClick={() => keTabel({ subtes: g.key, saring: "kabar" })}>{g.kabar}</button> : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">Belum ada katalog atau pengambilan pada bulan ini.</div>}
        <p className="pd-source-note">Terisi mengikuti katalog. Lolos QC mengikuti hasil review di Pengambilan Guru; hasil akhir yang sudah dikumpulkan belum berarti disetujui.</p>
      </details>

      {cariGuru ? <CariGuru proyek={cariGuru} bulan={bulan} kontak={kontak} penanda={penanda} master={master} guru={guruDb} log={log} riwayat={riwayat} akun={akun} wajibLogin={wajibLogin} onClose={() => { setCariGuru(null); muatReachout?.(); }} /> : null}
    </div>
  );
}
