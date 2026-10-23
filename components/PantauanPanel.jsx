"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { barisPantauan, TAHAP_PANTAUAN, progresBelumDiperiksa, proyekButuhGuru } from "@/lib/pantauanOpsi";
import { timPantauan } from "@/lib/peranTim";
import { laporanGuru, progresPengambilan, siklusRevisi, labelSiklusRevisi } from "@/lib/pengerjaanOpsi";
import { cocokTeksPengambilan } from "@/lib/pengambilanFilter";
import { TAWARAN } from "@/lib/reachoutOpsi";
import Icon from "./Icon";
import PengerjaanPanel from "./PengerjaanPanel";
import CariGuru from "./CariGuru";

const tugasRad = (r) => ["acc", "progres", "qc"].includes(r.tahap) || progresBelumDiperiksa(r.p).length > 0;
const labelBaris = (r) => {
  if (r.tahap === "qc") return `${labelSiklusRevisi(siklusRevisi(r.p, 100)) || "Hasil akhir dikumpulkan"} · belum QC${r.p.ronde ? " ulang" : ""}`;
  if (r.tahap === "progres") return `Laporan baru · belum diperiksa`;
  return r.keputusan.slice(-1)[0]?.judul || TAHAP_PANTAUAN.find(([k]) => k === r.tahap)?.[1] || r.p.status;
};

export default function PantauanPanel({ data, bulan, namaBulan, pengguna, projects = [], guruDb = [], master = [], log = [], riwayat = [], akun = [], kontak = [], penanda = {}, wajibLogin, muatUlang, muatReachout, setErr, aksiEl, onBerubah, pilihTab }) {
  const peran = timPantauan(pengguna);
  const [tim, setTim] = useState(peran[0] || "clo");
  const [antrean, setAntrean] = useState(tim === "rad" ? "tugas" : "siap");
  const [cari, setCari] = useState("");
  const [fokus, setFokus] = useState(null);
  const [cariGuru, setCariGuru] = useState(null);
  const [kini, setKini] = useState(Date.now);
  useEffect(() => { setFokus(null); setCariGuru(null); setCari(""); }, [bulan]);
  useEffect(() => { const tick = setInterval(() => setKini(Date.now()), 60000); return () => clearInterval(tick); }, []);
  const baris = useMemo(() => (data?.pengerjaan || []).map((p) => barisPantauan(p, kini)), [data, kini]);
  const kuota = useMemo(() => proyekButuhGuru(projects, data?.pengerjaan || []), [projects, data]);
  const proyekTampil = kuota.filter((p) => cocokTeksPengambilan(cari, p.subtes, p.id, p.platform));
  const counts = {
    siap: baris.filter((r) => r.siap.length).length,
    sudah: baris.filter((r) => r.sudah.length && !r.siap.length).length,
    reminder: baris.filter((r) => r.pengingat.some((i) => !i.terkirim)).length,
    tugas: baris.filter(tugasRad).length,
    qc: baris.filter((r) => r.tahap === "qc").length,
    progres: baris.filter((r) => progresBelumDiperiksa(r.p).length).length,
    periksa: baris.filter((r) => r.tahap === "qc" || progresBelumDiperiksa(r.p).length).length,
    acc: baris.filter((r) => r.tahap === "acc").length,
    revisi: baris.filter((r) => r.tahap === "revisi").length,
  };
  const tabs = tim === "rad" ? [["tugas", "Perlu tindakan", counts.tugas], ["progres", "Periksa progres", counts.progres], ["qc", "QC / QC ulang", counts.qc], ["acc", "ACC pengambilan", counts.acc], ["revisi", "Dalam revisi", counts.revisi], ["semua", "Semua", baris.length]] : [["siap", "Siap dikabari", counts.siap], ["semua", "Semua progres RAD", baris.length], ["reminder", "Reminder", counts.reminder], ["guru", "Cari & reachout", kuota.length], ["sudah", "Sudah dikabari", counts.sudah]];
  const kartu = tim === "rad" ? [["Perlu diperiksa", counts.periksa, "progres baru / QC hasil akhir", "periksa"], ["Menunggu ACC", counts.acc, "pengajuan pengambilan guru", "acc"], ["Dalam revisi", counts.revisi, "menunggu perbaikan guru", "revisi"]] : [["Siap dikabari", counts.siap, "pengambilan dengan hasil baru dari RAD", "siap"], ["Perlu reminder", counts.reminder, "pengingat hari ini belum dikirim", "reminder"], ["Proyek butuh guru", kuota.length, "kuota katalog belum terisi", "guru"]];
  const hasil = baris.filter((r) => {
    if (!cocokTeksPengambilan(cari, r.p.nama, r.p.email, r.p.idGuru, r.p.subtes, r.p.idProyek)) return false;
    if (antrean === "siap") return r.siap.length;
    if (antrean === "sudah") return r.sudah.length && !r.siap.length;
    if (antrean === "reminder") return r.pengingat.some((i) => !i.terkirim);
    if (antrean === "tugas") return tugasRad(r);
    if (antrean === "periksa") return r.tahap === "qc" || progresBelumDiperiksa(r.p).length;
    if (antrean === "progres") return progresBelumDiperiksa(r.p).length;
    return antrean === "semua" || r.tahap === antrean;
  }).sort((a, b) => {
    const at = (r) => Math.max(0, ...r.keputusan.map((e) => e.t || 0), ...laporanGuru(r.p).map((l) => l.t || 0), r.p.tDikumpulkan || 0, r.p.tAcc || 0);
    return at(a) - at(b) || a.p.row - b.p.row;
  });
  const ganti = (k) => { setAntrean(k); setFokus(null); };
  const ubahTim = (k) => { setTim(k); setAntrean(k === "rad" ? "tugas" : "siap"); setFokus(null); };
  if (!data) return <div className="card empty">Memuat Pantauan…</div>;
  if (data.error) return <div className="banner err" role="alert"><Icon name="alert" /><div>Data Pantauan belum bisa dibaca: {data.error}</div><button type="button" className="btn btn-ghost sm" onClick={() => muatUlang(true)}>Coba lagi</button></div>;
  return <div className="pn-workspace">
    {aksiEl ? createPortal(<><button type="button" className="btn btn-ghost sm" onClick={() => Promise.all([muatUlang(true), onBerubah?.(), muatReachout?.()])}><Icon name="refresh" />Segarkan</button>{tim === "rad" ? <><button type="button" className="btn btn-ghost sm" onClick={() => pilihTab("katalog")}><Icon name="layers" />Katalog</button><button type="button" className="btn btn-blue sm" onClick={() => pilihTab("baru")}><Icon name="plus" />Buat proyek</button></> : <button type="button" className="btn btn-ghost sm" onClick={() => pilihTab("reachout")}><Icon name="send" />Pantau reachout</button>}</>, aksiEl) : null}
    <div className="pn-rolebar"><div>{peran.length > 1 ? <div className="seg-tab" role="group" aria-label="Pantauan tim">{peran.map((k) => <button type="button" key={k} className={tim === k ? "on" : ""} aria-pressed={tim === k} onClick={() => ubahTim(k)}>Tim {k.toUpperCase()}</button>)}</div> : <span className="pill run">Tim {tim.toUpperCase()}</span>}</div><span className="muted">{pengguna.nama} · {namaBulan || bulan}</span></div>
    <p className="pn-purpose">{tim === "rad" ? "Antrean ACC, pemeriksaan progres, QC, dan revisi." : "Kabar hasil pemeriksaan, reminder, dan pemenuhan guru."}</p>
    <div className="grid pn-stats">{kartu.map(([label, value, sub, key]) => <button type="button" key={key} className="card stat pn-stat" onClick={() => ganti(key)}><span className="label">{label}</span><span className="value">{value}</span><span className="sub">{sub}</span></button>)}</div>
    <section className="pn-stream" aria-label="Progres tim RAD"><div className="section-head"><h2>Progres tim RAD</h2><span className="muted">{baris.length} pengambilan · {new Set(baris.map((r) => r.p.subtes)).size} subtes</span></div><div className="chips">{TAHAP_PANTAUAN.filter(([k]) => k !== "tolak" || baris.some((r) => r.tahap === k)).map(([k, label]) => <button type="button" className={"chip" + (antrean === k ? " active" : "")} aria-pressed={antrean === k} key={k} onClick={() => ganti(k)}>{label}<span className="n">{baris.filter((r) => r.tahap === k).length}</span></button>)}</div></section>
    <div className="section-head"><h2>{tim === "rad" ? "Tugas RAD" : "Tindak lanjut CLO"}</h2><span className="muted" aria-live="polite">{antrean === "guru" ? `${proyekTampil.length} proyek perlu guru` : `${hasil.length} pengambilan`}</span></div>
    <div className="pn-filterbar"><div className="chips" role="group" aria-label="Antrean tugas">{tabs.map(([k, label, n]) => <button type="button" key={k} className={"chip" + (antrean === k ? " active" : "")} aria-pressed={antrean === k} onClick={() => ganti(k)}>{label}<span className="n">{n}</span></button>)}</div><label className="search sm"><Icon name="search" /><input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari guru, subtes, atau kode proyek" aria-label="Cari dalam Pantauan" /></label></div>
    {antrean === "guru" ? <div className="pn-projects">{proyekTampil.map((p) => <article className="card pn-project" key={p.id}><div><b>{p.subtes}</b><small>{p.id} · {p.output || p.platform}</small><p>{Math.max(0, p.kebutuhan - p.sisa)}/{p.kebutuhan} soal terisi · {p.tersedia} tersedia</p>{p.dipesan ? <small>{p.dipesan} soal menunggu ACC</small> : null}<small>{kontak.filter((k) => k.tujuan === TAWARAN && k.bulan === bulan && k.idProyek === p.id).length} aktivitas tawaran tercatat</small></div><div className="pg-actions"><button type="button" className="btn btn-blue sm" onClick={() => setCariGuru({ ...p, sisa: p.tersedia })}><Icon name="users" />Cari guru</button><button type="button" className="btn btn-ghost sm" onClick={() => pilihTab("reachout")}>Lihat reachout<Icon name="chevronRight" /></button></div></article>)}{!proyekTampil.length ? <div className="card empty">{kuota.length ? "Tidak ada proyek yang cocok dengan pencarian." : "Tidak ada kuota terbuka yang perlu ditawarkan. Pengajuan yang menunggu ACC sudah diperhitungkan."}</div> : null}</div> : <div className="card pn-table-wrap"><table className="pn-table"><thead><tr><th>Guru & proyek</th><th>Pemeriksaan RAD</th><th>Kabar ke guru</th><th>Tindak lanjut</th></tr></thead><tbody>{hasil.map((r) => {
      const p = r.p, progress = progresPengambilan(p);
      const label = tim === "clo" ? r.siap.length ? "Siapkan kabar" : r.pengingat.length ? "Lihat reminder" : "Lihat detail" : r.tahap === "acc" ? "Tinjau ACC" : r.tahap === "qc" ? "Buka QC" : progresBelumDiperiksa(p).length ? "Periksa" : "Lihat detail";
      return <tr key={p.id} data-pantauan-id={p.id}><td><b>{p.nama || p.email}</b><small>{p.subtes}</small><small>{p.idProyek} · {progress.soal}/{p.jumlah} soal · {r.persen ? `${r.persen}%` : "Pengajuan"}</small></td><td data-label="Pemeriksaan RAD"><b>{labelBaris(r)}</b>{r.keputusan.slice(-1).map((e) => <small key={e.id}>{e.waktu || "—"} WIB · {e.oleh || "—"}</small>)}{progresBelumDiperiksa(p).length && r.tahap !== "progres" ? <small>{progresBelumDiperiksa(p).length} laporan belum diperiksa</small> : null}</td><td data-label="Kabar ke guru">{r.keputusan.length ? r.keputusan.map((e) => <div className="pn-contact" key={e.id}><span className={"pill " + (e.kabar ? "appr" : "qc")}>{e.kabar ? "Sudah dikabari" : "Siap dikabari"}</span><small>{e.judul}</small>{e.kabar ? <small>{e.kabar.waktu} WIB · {e.kabar.oleh}</small> : null}</div>) : r.pengingat.length ? <span className={"pill " + (r.pengingat.some((i) => !i.terkirim) ? "qc" : "appr")}>{r.pengingat.some((i) => !i.terkirim) ? "Perlu reminder" : "Reminder dicatat"}</span> : <><span className="muted">{r.tahap === "jalan" ? "Menunggu laporan guru" : "Menunggu RAD"}</span><small>Belum ada hasil untuk versi terbaru</small></>}{antrean === "reminder" ? r.pengingat.map((i) => <small key={i.key}>{i.terkirim ? `Reminder ${i.terkirim.waktu} · ${i.terkirim.oleh}` : i.teks}</small>) : null}</td><td><button type="button" className="btn btn-ghost sm" onClick={() => setFokus({ id: p.id })}>{label}<Icon name="chevronRight" /></button></td></tr>;
    })}</tbody></table>{!hasil.length ? <div className="empty">{baris.length ? "Tidak ada pekerjaan yang cocok dengan antrean ini." : `Belum ada pengambilan untuk ${namaBulan || "bulan ini"}.`}</div> : null}</div>}
    <PengerjaanPanel detailOnly data={data} bulan={bulan} namaBulan={namaBulan} projects={projects} guruDb={guruDb} muatUlang={muatUlang} setErr={setErr} onBerubah={onBerubah} fokus={fokus} onTutup={() => setFokus(null)} />
    {cariGuru ? <CariGuru proyek={cariGuru} bulan={bulan} kontak={kontak} penanda={penanda} master={master} guru={guruDb} log={log} riwayat={riwayat} akun={akun} wajibLogin={wajibLogin} onClose={() => { setCariGuru(null); muatReachout?.(); }} /> : null}
  </div>;
}
