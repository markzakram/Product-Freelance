"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ringkasanPengambilan, FOKUS_KERJA } from "@/lib/pengambilanDashboard";
import { timPantauan } from "@/lib/peranTim";
import { numberID } from "@/lib/format";
import { cocokTeksPengambilan } from "@/lib/pengambilanFilter";
import { TAWARAN } from "@/lib/reachoutOpsi";
import DashboardPengambilan from "./DashboardPengambilan";
import PengerjaanPanel from "./PengerjaanPanel";
import CariGuru from "./CariGuru";
import Icon from "./Icon";

export default function PusatPengambilan({ data, bulan, namaBulan, pengguna, projects = [], guruDb = [], master = [], log = [], riwayat = [], akun = [], kontak = [], penanda = {}, wajibLogin, muatUlang, muatReachout, setErr, aksiEl, onBerubah, pilihTab }) {
  const peran = timPantauan(pengguna);
  const [tim, setTim] = useState(peran[0] || "clo");
  const [fokus, setFokus] = useState("semua");
  const [sorotan, setSorotan] = useState(null);
  const [lihatKuota, setLihatKuota] = useState(false);
  const [cariKuota, setCariKuota] = useState("");
  const [cariGuru, setCariGuru] = useState(null);
  const [kini, setKini] = useState(Date.now);
  const matriksRef = useRef(null), kuotaRef = useRef(null);
  useEffect(() => { setFokus("semua"); setSorotan(null); setLihatKuota(false); setCariGuru(null); setCariKuota(""); }, [bulan]);
  useEffect(() => { const tick = setInterval(() => setKini(Date.now()), 60000); return () => clearInterval(tick); }, []);
  useEffect(() => { if (sorotan && sorotan.scroll !== false) matriksRef.current?.scrollIntoView({ block: "start" }); }, [sorotan]);
  useEffect(() => { if (lihatKuota) kuotaRef.current?.scrollIntoView({ block: "start" }); }, [lihatKuota]);
  const ringkasan = useMemo(() => ringkasanPengambilan(projects, data?.pengerjaan || [], kini), [projects, data, kini]);
  const ganti = (key, subtes = "") => { setFokus(key); setSorotan({ subtes, reset: true }); };
  const fokusTim = tim === "rad" ? ["semua", "tugas", "acc", "progres", "qc", "ulang", "revisi"] : ["semua", "siap", "reminder", "sudah", "qc", "revisi"];
  const kuota = ringkasan.kuota.filter((p) => cocokTeksPengambilan(cariKuota, p.subtes, p.id, p.platform));
  if (!data) return <div className="card empty">Memuat Pengambilan Guru…</div>;
  if (data.error) return <div className="banner err" role="alert"><Icon name="alert" /><div>Data pengambilan belum bisa dibaca: {data.error}</div><button type="button" className="btn btn-ghost sm" onClick={() => muatUlang(true)}>Coba lagi</button></div>;
  return <div className="pg-pusat">
    {aksiEl ? createPortal(tim === "rad" ? <><button type="button" className="btn btn-ghost sm" onClick={() => pilihTab("katalog")}><Icon name="layers" />Katalog</button><button type="button" className="btn btn-blue sm" onClick={() => pilihTab("baru")}><Icon name="plus" />Buat proyek</button></> : <button type="button" className="btn btn-ghost sm" onClick={() => pilihTab("reachout")}><Icon name="send" />Pantau reachout</button>, aksiEl) : null}
    <div className="pn-rolebar">{peran.length > 1 ? <div className="seg-tab" role="group" aria-label="Fokus tim">{peran.map((key) => <button type="button" key={key} className={tim === key ? "on" : ""} aria-pressed={tim === key} onClick={() => { setTim(key); setFokus("semua"); setSorotan({ subtes: "", reset: true, scroll: false }); }}>Tim {key.toUpperCase()}</button>)}</div> : <span className="pill run">Tim {tim.toUpperCase()}</span>}<span className="muted">{pengguna.nama} · {namaBulan || bulan}</span></div>
    <DashboardPengambilan ringkasan={ringkasan} tim={tim} namaBulan={namaBulan} onFokus={ganti} onSubtes={(subtes, key = "semua") => ganti(key, subtes)} onKuota={() => { setLihatKuota(true); if (lihatKuota) kuotaRef.current?.scrollIntoView({ block: "start" }); }} />
    <div className="pd-focusbar" role="group" aria-label="Fokus kerja matriks"><span>Fokus tim {tim.toUpperCase()}</span><div className="chips">{fokusTim.map((key) => <button type="button" className={"chip" + (fokus === key ? " active" : "")} aria-pressed={fokus === key} key={key} onClick={() => ganti(key)}>{key === "semua" ? "Semua" : FOKUS_KERJA[key]}<span className="n">{ringkasan.counts[key]}</span></button>)}</div></div>
    {lihatKuota ? <section className="pd-recruit" ref={kuotaRef} aria-label="Pemenuhan kuota guru"><div className="section-head"><h2>Pemenuhan kuota guru</h2><button type="button" className="btn btn-ghost sm" onClick={() => setLihatKuota(false)}>Tutup<Icon name="x" size={14} /></button></div><label className="search sm"><Icon name="search" /><input type="search" aria-label="Cari proyek yang membutuhkan guru" value={cariKuota} onChange={(e) => setCariKuota(e.target.value)} placeholder="Cari subtes atau kode proyek" /></label><div className="pn-projects">{kuota.map((p) => <article className="card pn-project" key={p.id}><div><b>{p.subtes}</b><small>{p.id} · {p.output || p.platform}</small><p>{numberID(p.tersedia)} soal tersedia{p.dipesan ? ` · ${p.dipesan} menunggu ACC` : ""}</p><small>{kontak.filter((k) => k.tujuan === TAWARAN && k.bulan === bulan && k.idProyek === p.id).length} aktivitas tawaran tercatat</small></div><div className="pg-actions"><button type="button" className="btn btn-blue sm" onClick={() => setCariGuru({ ...p, sisa: p.tersedia })}><Icon name="users" />Cari guru</button><button type="button" className="btn btn-ghost sm" onClick={() => pilihTab("reachout")}>Lihat reachout</button></div></article>)}{!kuota.length ? <div className="card empty">{ringkasan.kuota.length ? "Tidak ada proyek yang cocok dengan pencarian." : "Tidak ada kuota terbuka yang perlu ditawarkan."}</div> : null}</div></section> : null}
    <section ref={matriksRef} className="pd-matrix-area" aria-label="Matriks kerja Pengambilan Guru"><div className="section-head"><h2>Matriks Pengambilan Guru</h2><span className="muted">Progres · QC · revisi · kabar CLO</span></div><PengerjaanPanel data={data} bulan={bulan} namaBulan={namaBulan} projects={projects} guruDb={guruDb} muatUlang={muatUlang} setErr={setErr} aksiEl={aksiEl} onBerubah={onBerubah} onSegarkan={() => Promise.all([muatUlang(true), onBerubah?.(), muatReachout?.()])} fokusKerja={fokus} onFokusKerja={setFokus} sorotan={sorotan} kini={kini} /></section>
    {cariGuru ? <CariGuru proyek={cariGuru} bulan={bulan} kontak={kontak} penanda={penanda} master={master} guru={guruDb} log={log} riwayat={riwayat} akun={akun} wajibLogin={wajibLogin} onClose={() => { setCariGuru(null); muatReachout?.(); }} /> : null}
  </div>;
}
