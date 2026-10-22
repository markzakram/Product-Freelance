"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { catatWa } from "@/lib/kontakWa";
import { teksJumlah } from "@/lib/paket";
import { ST, PERINGATAN_MULAI, DENDA_SETELAH, labelStatus, kelasStatus, tanggalPendek, belumSelesai, pengingat, titikBerikut, laporanGuru, laporanBaru, revisiProgres, statusLaporan, tahapAktif, progresPengambilan, linkSah, siklusRevisi, labelSiklusRevisi } from "@/lib/pengerjaanOpsi";
import Icon from "./Icon";
import MatriksPengambilan from "./MatriksPengambilan";
import RiwayatPengambilan from "./RiwayatPengambilan";
import Drawer from "./Drawer";
import PengambilanFilters from "./PengambilanFilters";

const SARING = [
  ["semua", "Semua status", () => true],
  ["menunggu", "Menunggu acc", (p) => p.status === ST.diajukan],
  ["jalan", "Sedang dikerjakan", (p) => p.status === ST.running],
  ["progres", "Laporan baru masuk", (p) => laporanBaru(p).length > 0],
  ["laporan", "Ada laporan progres", (p) => laporanGuru(p).length > 0],
  ["review", "Menunggu review akhir", (p) => p.status === ST.review],
  ["revisi", "Perlu revisi", (p) => p.status === ST.revisi || (p.status === ST.running && revisiProgres(p).length > 0)],
  ["selesai", "Selesai", (p) => p.status === ST.selesai],
  ["ingat", "Perlu diingatkan", (p) => pengingat(p).length > 0],
  ["tolak", "Ditolak & batal", (p) => [ST.ditolak, ST.dibatalkan].includes(p.status)],
];

export default function PengambilanWorkspace({ data, bulan, namaBulan, projects = [], guruDb = [], muatUlang, setErr, aksiEl, onBerubah, FormReview, pesanWa }) {
  const [view, setView] = useState("subtes");
  const [saring, setSaring] = useState("semua");
  const [tahap, setTahap] = useState("semua");
  const [cari, setCari] = useState("");
  const [pilihan, setPilihan] = useState(null);
  const [tahapRiwayat, setTahapRiwayat] = useState("semua");
  const [sibuk, setSibuk] = useState("");
  const [maksIsi, setMaksIsi] = useState("");
  const [tolak, setTolak] = useState(null);
  const [dinilai, setDinilai] = useState("");
  const [revisi, setRevisi] = useState(null);
  const [info, setInfo] = useState("");
  const [galatDetail, setGalatDetail] = useState("");
  const daftar = useMemo(() => data?.pengerjaan || [], [data]);
  const proyek = useMemo(() => new Map(projects.map((p) => [String(p.id).toUpperCase(), p])), [projects]);
  const guruById = useMemo(() => new Map(guruDb.filter((g) => g.idGuru).map((g) => [String(g.idGuru), g])), [guruDb]);
  const bisa = Boolean(data?.canWrite);
  const maks = data?.maksAktif || 3;
  const teksCari = cari.trim().toLocaleLowerCase("id");
  const cocok = SARING.find(([k]) => k === saring)[2];
  const hasilCari = daftar.filter((p) => !teksCari || `${p.nama} ${p.email} ${p.idGuru} ${p.subtes} ${p.idProyek} ${p.output}`.toLocaleLowerCase("id").includes(teksCari));
  const list = hasilCari.filter((p) => cocok(p) && (tahap === "semua" || tahapAktif(p) === Number(tahap))).sort((a, b) => b.row - a.row);
  const statusCounts = Object.fromEntries(SARING.map(([k, , fn]) => [k, hasilCari.filter((p) => fn(p) && (tahap === "semua" || tahapAktif(p) === Number(tahap))).length]));
  const tahapCounts = Object.fromEntries(["semua", 30, 50, 100].map((n) => [n, hasilCari.filter((p) => cocok(p) && (n === "semua" || tahapAktif(p) === n)).length]));
  const selected = daftar.find((p) => p.id === pilihan) || null;
  const progres = selected ? progresPengambilan(selected) : null;
  const pilih = (id, n) => { setPilihan(id); setTahapRiwayat(String(n)); setTolak(null); setDinilai(""); setRevisi(null); setInfo(""); setGalatDetail(""); };
  const tutup = () => { setPilihan(null); setRevisi(null); setTolak(null); setDinilai(""); };
  const jalankan = async (kunci, body, sesudah) => {
    setSibuk(kunci);
    setErr("");
    setInfo("");
    setGalatDetail("");
    try {
      const res = await fetch("/api/admin/pengerjaan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      await muatUlang();
      sesudah?.(j);
      setInfo("Perubahan tersimpan.");
    } catch (e) { setErr(e.message); setGalatDetail(e.message); }
    finally { setSibuk(""); }
  };
  const tombolWa = (p, jenis, label) => {
    const wa = guruById.get(String(p.idGuru))?.wa;
    return wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, pesanWa(p, jenis))} target="_blank" rel="noopener noreferrer" onClick={() => catatWa({ tujuan: "Info pengambilan", idGuru: p.idGuru, nama: p.nama, email: p.email, wa })}><Icon name="send" />{label}</a> : null;
  };

  if (!data) return <div className="card empty">Memuat pengambilan…</div>;

  return <div className="pg-workspace">
    {aksiEl ? createPortal(<><label className="pj-maks"><span>Maks. proyek aktif / guru</span><input aria-label="Maksimum proyek aktif per guru" className="input sm" type="number" min={1} max={50} value={maksIsi === "" ? maks : maksIsi} onChange={(e) => setMaksIsi(e.target.value)} disabled={!bisa || Boolean(sibuk)} />{maksIsi !== "" && Number(maksIsi) !== maks ? <button type="button" className="btn btn-blue sm" disabled={Boolean(sibuk)} onClick={() => jalankan("maks", { action: "maksAktif", nilai: maksIsi }, () => setMaksIsi(""))}>Simpan</button> : null}</label><button type="button" className="btn btn-ghost sm" onClick={muatUlang} disabled={Boolean(sibuk)}><Icon name="refresh" />Segarkan</button></>, aksiEl) : null}
    {data.error ? <div className="banner err"><Icon name="alert" /><div>Pengambilan belum bisa dibaca: {data.error}</div></div> : null}
    <div className="pg-viewbar">
      <div className="seg-tab" role="group" aria-label="Sudut pandang utama">{[["subtes", "layers", "Per subtes"], ["guru", "users", "Per guru"]].map(([k, icon, label]) => <button key={k} type="button" className={view === k ? "on" : ""} aria-pressed={view === k} onClick={() => setView(k)}><Icon name={icon} />{label}</button>)}</div>
      <span className="muted" aria-live="polite">{new Set(list.map((p) => p.subtes)).size} subtes · {new Set(list.map((p) => p.idGuru || p.email || p.id)).size} guru · {numberID(list.length)} pengambilan</span>
    </div>
    <PengambilanFilters cari={cari} setCari={setCari} status={saring} setStatus={setSaring} options={SARING} statusCounts={statusCounts} tahap={tahap} setTahap={setTahap} tahapCounts={tahapCounts} />
    {!list.length ? <div className="card empty">{daftar.length ? "Tidak ada pengambilan yang cocok dengan filter." : `Belum ada pengambilan untuk ${namaBulan || "bulan ini"}.`}</div> : <MatriksPengambilan daftar={list} view={view} selected={selected?.id} onPilih={pilih} />}
    {selected ? (() => {
      const p = selected;
      const pr = proyek.get(p.idProyek);
      const kurang = p.status === ST.diajukan && pr && pr.sisa < p.jumlah;
      const ingat = pengingat(p);
      const berikut = p.status === ST.running ? titikBerikut(p) : null;
      const laporan = laporanGuru(p);
      return createPortal(<Drawer id="pg-selected" key={p.id} side="left" wide title="Riwayat pengambilan" sub={`${p.nama || p.email} · ${p.subtes}`} busy={Boolean(sibuk)} onClose={tutup}>
        <div className="pg-selected pg-drawer-detail">
        {galatDetail ? <div className="banner err" role="alert"><Icon name="alert" /><div>{galatDetail}</div></div> : null}
        <div className="pg-summary"><div className="pg-summary-top"><div><b>{numberID(progres.soal)}/{numberID(p.jumlah)} soal dilaporkan · {progres.persen}%</b><small>{p.idProyek} · {p.idGuru || p.email} · {teksJumlah(p.jumlah, p.isiPaket)} · deadline {tanggalPendek(p.deadline)}</small></div><span className={"pill " + kelasStatus(p.status)}>{labelStatus(p.status)}</span></div><div className="pg-progress" role="meter" aria-label="Jumlah soal dilaporkan" aria-valuemin={0} aria-valuemax={p.jumlah} aria-valuenow={progres.soal}><span style={{ width: `${progres.persen}%` }} /></div><small>Tahap 100% adalah pengumpulan hasil akhir; status Selesai mengikuti hasil review.</small></div>
        {ingat.length ? <div className="ps-ingat">{ingat.map((i) => <span key={i.jenis} className={"pill " + i.kelas}><Icon name="alert" size={12} />{i.teks}</span>)}</div> : null}
        <RiwayatPengambilan key={`${p.id}:${tahapRiwayat}`} p={p} awal={tahapRiwayat} />

        {laporan.length && [ST.running, ST.review, ST.revisi].includes(p.status) ? <div className="pg-report-reviews"><b>Pemeriksaan laporan progres</b>{laporan.map((l) => { const status = statusLaporan(p, l); const siklus = siklusRevisi(p, l.persen, l.laporanId); return <div className="pg-report-review" key={l.laporanId}><div><b>Laporan {l.noLaporan} · {l.persen}%</b><small>Versi {l.versi} · {numberID(l.soal)}/{numberID(p.jumlah)} soal · {status === "revisi" ? `Menunggu revisi ${siklus.diminta}` : status === "dicek" ? "Sudah diperiksa" : "Belum diperiksa"}</small>{siklus.dikirim ? <small>Perbaikan terakhir: revisi {siklus.dikirim}</small> : null}</div><div className="pg-actions">{status === "baru" ? <button type="button" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk)} onClick={() => jalankan(p.id, { action: "progresDicek", id: p.id, laporanId: l.laporanId, versi: l.versi })}><Icon name="check" />Tandai diperiksa</button> : null}{p.status === ST.running && status !== "revisi" ? <button type="button" className="btn btn-ghost sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setRevisi({ id: p.id, laporanId: l.laporanId, versi: l.versi, catatan: "" })}>Minta revisi {l.versi}</button> : null}</div></div>; })}</div> : null}
        {revisi?.id === p.id ? <form className="pg-revision-form" onSubmit={(e) => { e.preventDefault(); if (revisi.catatan.trim()) jalankan(p.id, { action: "revisiProgres", id: p.id, laporanId: revisi.laporanId, versi: revisi.versi, catatan: revisi.catatan }, () => setRevisi(null)); }}><label className="ffield"><span>Catatan revisi {revisi.versi} · Laporan {laporan.find((l) => l.laporanId === revisi.laporanId)?.noLaporan}</span><textarea autoFocus className="input" rows={3} value={revisi.catatan} maxLength={1500} onChange={(e) => setRevisi({ ...revisi, catatan: e.target.value })} placeholder="Bagian yang perlu diperbaiki…" required /></label><div className="pg-actions"><button type="submit" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk) || !revisi.catatan.trim()}>Simpan permintaan revisi</button><button type="button" className="btn btn-ghost sm" disabled={Boolean(sibuk)} onClick={() => setRevisi(null)}>Batal</button></div></form> : null}

        {p.ronde ? <div className="ps-hasil"><span><b>{numberID(p.tepat + p.telat)}</b> disetujui</span><span><b>{numberID(p.tolakBuka + p.tolakHangus)}</b> ditolak</span>{p.status !== ST.selesai ? <span><b>{numberID(belumSelesai(p))}</b> belum diputuskan</span> : null}{p.telat ? <small>{p.telat} soal revisi terlambat dibayar 75%.</small> : null}</div> : null}
        {p.status === ST.revisi ? <div className="ps-revisi"><b>{labelSiklusRevisi(siklusRevisi(p, 100))} · hasil akhir</b><small>Batas revisi {p.batasRevisi}</small><p>{p.catatanRevisi}</p></div> : null}
        {p.catatan ? <p className="ps-catatan">{p.catatan}</p> : null}
        {kurang ? <p className="ps-catatan tolak">Sisa kuota proyek tidak cukup untuk pengajuan ini.</p> : null}
        <div className="pg-actions">
          {p.status === ST.diajukan ? <><button type="button" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk) || kurang} onClick={() => jalankan(p.id, { action: "putuskan", id: p.id, acc: true, bulan }, () => onBerubah?.())}><Icon name="check" />Acc pengajuan</button><button type="button" className="btn btn-ghost sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setTolak({ id: p.id, alasan: "" })}>Tolak</button><small className="muted">{data.aktifPerGuru?.[p.idGuru || p.email] || 0}/{maks} proyek aktif</small></> : null}
          {p.status === ST.review ? <button type="button" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setDinilai(dinilai === p.id ? "" : p.id)}><Icon name="clipboard" />Review {numberID(belumSelesai(p))} soal</button> : null}
          {linkSah(p.link) ? <a className="btn btn-ghost sm" href={p.link} target="_blank" rel="noopener noreferrer"><Icon name="external" />Buka hasil akhir</a> : null}
        </div>
        {dinilai === p.id && p.status === ST.review ? <FormReview p={p} sibuk={Boolean(sibuk)} onBatal={() => setDinilai("")} onKirim={(hasil) => jalankan(p.id, { action: "review", id: p.id, ...hasil }, () => { setDinilai(""); onBerubah?.(); })} /> : null}
        {tolak?.id === p.id ? <form className="pj-tolak" onSubmit={(e) => { e.preventDefault(); jalankan(p.id, { action: "putuskan", id: p.id, acc: false, catatan: tolak.alasan, bulan }, () => setTolak(null)); }}><label className="ffield"><span>Alasan penolakan</span><textarea autoFocus className="input" rows={2} value={tolak.alasan} onChange={(e) => setTolak({ ...tolak, alasan: e.target.value })} /></label><div className="pg-actions"><button type="submit" className="btn btn-red sm" disabled={!bisa || Boolean(sibuk)}>Tolak pengajuan</button><button type="button" className="btn btn-ghost sm" onClick={() => setTolak(null)}>Batal</button></div></form> : null}
        <details className="pg-more-actions"><summary>Pengingat & tindakan lainnya</summary><div className="pg-actions">{tombolWa(p, "chat", "Chat guru")}{p.status === ST.running ? tombolWa(p, "acc", "Kabari di-acc") : null}{p.status === ST.revisi ? tombolWa(p, "revisi", "Kabari revisi") : null}{berikut ? tombolWa(p, "progres", `Ingatkan lapor ${berikut.persen}%`) : null}{laporanBaru(p).length ? tombolWa(p, "progres-terima", "Kabari progres diterima") : null}{ingat.some((i) => i.jenis === "deadline") ? tombolWa(p, "lewat", "Ingatkan deadline") : null}{ingat.some((i) => i.jenis === "revisi") ? tombolWa(p, "ingat-revisi", "Ingatkan revisi") : null}{p.status === ST.selesai ? tombolWa(p, "selesai", "Kabari hasil akhir") : null}{p.status === ST.ditolak ? tombolWa(p, "tolak", "Kabari ditolak") : null}{p.gagal >= PERINGATAN_MULAI && p.status !== ST.selesai ? tombolWa(p, "peringatan", "Kirim peringatan") : null}{p.gagal >= DENDA_SETELAH && !p.denda ? <button type="button" className="btn btn-red sm" disabled={!bisa || Boolean(sibuk)} onClick={() => window.confirm(`Terapkan potongan 25% untuk ${p.subtes} (${p.nama})?`) && jalankan(p.id, { action: "denda", id: p.id }, () => onBerubah?.())}>Terapkan denda 25%</button> : null}{p.denda ? <span className="pill rev">Denda 25%</span> : null}{p.gagal ? <small className="muted">Review gagal {p.gagal}×</small> : null}</div></details>
        {info ? <p className="pg-save-info" role="status">{info}</p> : null}
        </div>
      </Drawer>, document.body);
    })() : null}
    {info && !selected ? <p className="pg-save-info" role="status">{info}</p> : null}
  </div>;
}
