"use client";

// Ruang kerja Pengambilan Guru: antrean tugas tim, satu tabel semua
// pengambilan, dan panel "Detail pengambilan" di kanan. Semua tindakan
// (ACC, periksa laporan, review, kabar) lewat /api/admin/pengerjaan.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { numberID } from "@/lib/format";
import { tautanWa } from "@/lib/tautan";
import { catatWa } from "@/lib/kontakWa";
import { teksJumlah } from "@/lib/paket";
import { ST, PERINGATAN_MULAI, DENDA_SETELAH, kelasStatus, labelStatus, tanggalPendek, tanggalHari, belumSelesai, pengingat, titikBerikut, statusTitik, laporanGuru, laporanBaru, revisiProgres, statusLaporan, progresPengambilan, linkSah, siklusRevisi, labelSiklusRevisi } from "@/lib/pengerjaanOpsi";
import { progresBelumDiperiksa, pesanKabar, pesanReminder } from "@/lib/pantauanOpsi";
import { soalDisetujui } from "@/lib/pengambilanDashboard";
import { SARING_TABEL, cocokSaringTabel, statusRingkas } from "@/lib/antreanPengambilan";
import { cocokTeksPengambilan, kunciSubtesPengambilan, kunciGuruPengambilan, opsiFilterPengambilan, hitungOpsiPengambilan } from "@/lib/pengambilanFilter";
import Icon from "./Icon";
import Drawer from "./Drawer";
import AntreanTugas from "./AntreanTugas";
import TabelPengambilan, { Alur, LegendaAlur } from "./TabelPengambilan";
import SearchableFilter from "./SearchableFilter";
import RiwayatPengambilan from "./RiwayatPengambilan";
import KabarPengambilan from "./KabarPengambilan";

export default function PengambilanWorkspace({ data, bulan, namaBulan, projects = [], guruDb = [], muatUlang, setErr, aksiEl, onBerubah, FormReview, FormHentikan, FormUbahTolak, FormKoreksi, pesanWa, tim = "rad", baris = [], tugas = [], kuota = [], tabClo, setTabClo, onCariGuru, sorotan, kini, onSegarkan, antreanRef, targetSubtes, fokusNotifikasi, onNotifikasiDibuka }) {
  const [view, setView] = useState("subtes");
  const [saring, setSaring] = useState("semua");
  const [cari, setCari] = useState("");
  const [saringSubtes, setSaringSubtes] = useState("");
  const [saringGuru, setSaringGuru] = useState("");
  const [pilihan, setPilihan] = useState(null);
  const [tabDetail, setTabDetail] = useState("riwayat");
  const [tahapRiwayat, setTahapRiwayat] = useState("semua");
  const [drafAwal, setDrafAwal] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [maksIsi, setMaksIsi] = useState("");
  const [tolak, setTolak] = useState(null);
  const [dinilai, setDinilai] = useState("");
  const [revisi, setRevisi] = useState(null);
  const [henti, setHenti] = useState(""); // id pengambilan yang form "Hentikan pengambilan"-nya terbuka
  const [ubahTolak, setUbahTolak] = useState(""); // id pengambilan yang form "Ubah tujuan kuota"-nya terbuka
  const [koreksi, setKoreksi] = useState(""); // id pengambilan yang form "Koreksi hasil akhir"-nya terbuka
  const [info, setInfo] = useState("");
  const [galatDetail, setGalatDetail] = useState("");
  const tabelRef = useRef(null);
  const daftar = useMemo(() => data?.pengerjaan || [], [data]);
  const barisById = useMemo(() => new Map(baris.map((r) => [r.p.id, r])), [baris]);
  const proyek = useMemo(() => new Map(projects.map((p) => [String(p.id).toUpperCase(), p])), [projects]);
  const guruById = useMemo(() => new Map(guruDb.filter((g) => g.idGuru).map((g) => [String(g.idGuru), g])), [guruDb]);
  const guruByEmail = useMemo(() => new Map(guruDb.filter((g) => g.email).map((g) => [String(g.email).trim().toLowerCase(), g])), [guruDb]);
  const kontakGuru = (p) => guruById.get(String(p.idGuru)) || guruByEmail.get(String(p.email || "").trim().toLowerCase());
  const semuaSubtes = useMemo(() => opsiFilterPengambilan(daftar, "subtes"), [daftar]);
  const semuaGuru = useMemo(() => opsiFilterPengambilan(daftar, "guru"), [daftar]);
  const bisa = Boolean(data?.canWrite);
  const bisaKabari = Boolean(data?.canKabari);
  const maks = data?.maksAktif || 3;

  // Saringan tabel: teks + subtes + guru + satu status.
  const cocokSubtes = (r) => !saringSubtes || kunciSubtesPengambilan(r.p) === saringSubtes;
  const cocokGuru = (r) => !saringGuru || kunciGuruPengambilan(r.p) === saringGuru;
  const dasar = baris.filter((r) => cocokTeksPengambilan(cari, r.p.nama, r.p.email, r.p.idGuru, r.p.subtes, r.p.idProyek, r.p.output));
  const list = dasar.filter((r) => cocokSubtes(r) && cocokGuru(r) && cocokSaringTabel(r, saring)).sort((a, b) => b.p.row - a.p.row);
  const hitungSaring = Object.fromEntries(SARING_TABEL.map(([k, , fn]) => [k, dasar.filter((r) => cocokSubtes(r) && cocokGuru(r) && fn(r)).length]));
  const kandidatSubtes = dasar.filter((r) => cocokGuru(r) && cocokSaringTabel(r, saring)).map((r) => r.p);
  const kandidatGuru = dasar.filter((r) => cocokSubtes(r) && cocokSaringTabel(r, saring)).map((r) => r.p);
  const opsiSubtes = [{ value: "", label: "Semua subtes", count: kandidatSubtes.length }, ...hitungOpsiPengambilan(semuaSubtes, kandidatSubtes, "subtes")];
  const opsiGuru = [{ value: "", label: "Semua guru", count: kandidatGuru.length }, ...hitungOpsiPengambilan(semuaGuru, kandidatGuru, "guru")];
  const adaSaring = Boolean(cari || saringSubtes || saringGuru || saring !== "semua");
  const resetSaring = () => { setCari(""); setSaring("semua"); setSaringSubtes(""); setSaringGuru(""); };

  const selected = daftar.find((p) => p.id === pilihan) || null;
  const pilih = (id, { tab, tahap, aksi, draf } = {}) => {
    setPilihan(id);
    setTabDetail(tab || (tim === "clo" ? "kabar" : "riwayat"));
    setTahapRiwayat(String(tahap || "semua"));
    setDrafAwal(draf || "");
    setTolak(aksi === "tolak" ? { id, alasan: "" } : null);
    setDinilai(aksi === "review" ? id : "");
    setRevisi(aksi?.revisi ? { id, laporanId: aksi.revisi.laporanId, versi: aksi.revisi.versi, catatan: "" } : null);
    setHenti("");
    setUbahTolak("");
    setKoreksi("");
    setGalatDetail("");
  };
  const tutup = () => { setPilihan(null); setRevisi(null); setTolak(null); setDinilai(""); setHenti(""); setUbahTolak(""); setKoreksi(""); };
  useEffect(() => { tutup(); setSaringSubtes(""); setSaringGuru(""); }, [bulan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fokusNotifikasi || !daftar.some((p) => p.id === fokusNotifikasi.id)) return;
    pilih(fokusNotifikasi.id, { tab: "kabar", draf: fokusNotifikasi.keputusanId });
    onNotifikasiDibuka?.();
  }, [fokusNotifikasi, daftar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sorotan) return;
    setCari(""); setSaringGuru("");
    setSaring(sorotan.saring || "semua");
    setSaringSubtes(sorotan.subtes || "");
    tabelRef.current?.scrollIntoView({ block: "start" });
  }, [sorotan]);
  useEffect(() => { if (!info) return; const t = setTimeout(() => setInfo(""), 3500); return () => clearTimeout(t); }, [info]);

  const jalankan = async (kunci, body, sesudah) => {
    setSibuk(kunci);
    setErr("");
    setInfo("");
    setGalatDetail("");
    try {
      const res = await fetch("/api/admin/pengerjaan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      await muatUlang(true);
      sesudah?.(j);
      setInfo("Perubahan tersimpan.");
    } catch (e) { setErr(e.message); setGalatDetail(e.message); }
    finally { setSibuk(""); }
  };
  const infoAcc = (p) => {
    const pr = proyek.get(p.idProyek);
    return { aktif: data?.aktifPerGuru?.[p.idGuru || p.email] || 0, maks, kurang: Boolean(p.status === ST.diajukan && pr && pr.sisa < p.jumlah) };
  };
  const aksi = {
    acc: (p) => jalankan(p.id, { action: "putuskan", id: p.id, acc: true, bulan }, () => onBerubah?.()),
    dicek: (p, l) => jalankan(p.id, { action: "progresDicek", id: p.id, laporanId: l.laporanId, versi: l.versi }),
    kabari: (p, e) => jalankan(p.id, { action: "kabari", id: p.id, keputusanId: e.id }),
    reminder: (p, i) => jalankan(p.id, { action: "reminder", id: p.id, pengingatId: i.key }),
  };
  const tombolWa = (p, jenis, label) => {
    const wa = kontakGuru(p)?.wa;
    return wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, pesanWa(p, jenis))} target="_blank" rel="noopener noreferrer" onClick={() => catatWa({ tujuan: "Info pengambilan", idGuru: p.idGuru, nama: p.nama, email: p.email, wa })}><Icon name="send" />{label}</a> : null;
  };

  // Satu kotak "Langkah berikutnya" di panel detail — tugas tim yang sedang dibuka didahulukan.
  const langkah = (p, r) => {
    const wa = kontakGuru(p)?.wa;
    const off = !bisa || Boolean(sibuk);
    if (tim === "clo" && r.siap.length) {
      const e = r.siap[0];
      return { judul: `Kabari guru: ${e.judul}`, ket: "Kirim pesan WhatsApp, lalu catat sudah dikabari.", tombol: <>{wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, pesanKabar(p, e))} target="_blank" rel="noopener noreferrer"><Icon name="send" />WhatsApp</a> : null}<button type="button" className="btn btn-ghost sm" onClick={() => { setDrafAwal(e.id); setTabDetail("kabar"); }}>Lihat draf</button><button type="button" className="btn btn-blue sm" disabled={!bisaKabari || Boolean(sibuk)} onClick={() => aksi.kabari(p, e)}><Icon name="check" />Sudah dikabari</button></> };
    }
    const ingat = r.pengingat.find((i) => !i.terkirim);
    if (tim === "clo" && ingat) {
      return { judul: `Kirim reminder: ${ingat.teks}`, ket: "Pengingat ini belum dikirim hari ini.", tombol: <>{wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, pesanReminder(p, ingat))} target="_blank" rel="noopener noreferrer"><Icon name="send" />WhatsApp</a> : null}<button type="button" className="btn btn-blue sm" disabled={!bisaKabari || Boolean(sibuk)} onClick={() => aksi.reminder(p, ingat)}><Icon name="check" />Reminder dikirim</button></> };
    }
    if (p.status === ST.diajukan) {
      const a = infoAcc(p);
      return { judul: `ACC pengajuan · ${teksJumlah(p.jumlah, p.isiPaket)}`, ket: `${a.aktif}/${a.maks} proyek aktif guru ini${a.kurang ? " · sisa kuota proyek tidak cukup untuk pengajuan ini" : ""}`, tombol: <><button type="button" className="btn btn-ghost sm" disabled={off} onClick={() => setTolak({ id: p.id, alasan: "" })}>Tolak</button><button type="button" className="btn btn-blue sm" disabled={off || a.kurang} onClick={() => aksi.acc(p)}><Icon name="check" />ACC pengajuan</button></> };
    }
    const l = progresBelumDiperiksa(p)[0];
    if (l) {
      return { judul: `Periksa laporan ${l.persen}% · ${numberID(l.soal)}/${numberID(p.jumlah)} soal`, ket: l.catatan ? `“${l.catatan}” · masuk ${l.waktu}` : `Masuk ${l.waktu}`, tombol: <>{l.link ? <a className="btn btn-ghost sm" href={l.link} target="_blank" rel="noopener noreferrer"><Icon name="external" />Buka progres</a> : null}{p.status === ST.running ? <button type="button" className="btn btn-ghost sm" disabled={off} onClick={() => setRevisi({ id: p.id, laporanId: l.laporanId, versi: l.versi, catatan: "" })}>Minta revisi</button> : null}<button type="button" className="btn btn-blue sm" disabled={off} onClick={() => aksi.dicek(p, l)}><Icon name="check" />Sudah diperiksa</button></> };
    }
    if (p.status === ST.review) {
      return { judul: `${p.ronde ? `QC ulang revisi ${siklusRevisi(p, 100).dikirim || p.ronde}` : "QC hasil akhir"} · ${numberID(belumSelesai(p))} soal`, ket: p.catatanGuru ? `Catatan guru: “${p.catatanGuru}”` : `Dikumpulkan ${p.dikumpulkan || "—"}`, tombol: <>{linkSah(p.link) ? <a className="btn btn-ghost sm" href={p.link} target="_blank" rel="noopener noreferrer"><Icon name="external" />Buka hasil akhir</a> : null}<button type="button" className="btn btn-blue sm" disabled={off} onClick={() => setDinilai(dinilai === p.id ? "" : p.id)}><Icon name="clipboard" />Review {numberID(belumSelesai(p))} soal</button></> };
    }
    if (p.status === ST.revisi) return { judul: `Menunggu guru mengirim revisi ${siklusRevisi(p, 100).diminta}`, ket: `${numberID(belumSelesai(p))} soal · batas ${p.batasRevisi || "—"}` };
    if (p.status === ST.running) {
      const rev = revisiProgres(p)[0];
      if (rev) return { judul: `Menunggu guru memperbaiki laporan ${rev.persen}%`, ket: `Revisi ${rev.versi} sudah diminta.` };
      const t = titikBerikut(p, kini);
      return t ? { judul: `Menunggu guru lapor ${t.persen}%`, ket: `${tanggalHari(t.tanggal)} · ${t.h} · minimal ${numberID(t.min)} soal` } : { judul: "Menunggu guru mengumpulkan hasil akhir", ket: `Deadline ${tanggalPendek(p.deadline)}` };
    }
    if (p.status === ST.selesai) return { judul: `Selesai · ${numberID(soalDisetujui(p))}/${numberID(p.jumlah)} soal disetujui`, ket: [p.telat ? `${p.telat} soal revisi telat dibayar 75%` : "", p.tolakBuka + p.tolakHangus ? `${p.tolakBuka + p.tolakHangus} soal ditolak` : "", p.denda ? "denda 25%" : ""].filter(Boolean).join(" · ") };
    return { judul: p.status === ST.ditolak ? "Pengajuan ditolak" : "Pengajuan dibatalkan", ket: p.catatan || "" };
  };

  if (!data) return <div className="card empty">Memuat pengambilan…</div>;

  return <div className="pk-workspace">
    {aksiEl ? createPortal(<><label className="pj-maks"><span>Maks. proyek aktif / guru</span><input aria-label="Maksimum proyek aktif per guru" className="input sm" type="number" min={1} max={50} value={maksIsi === "" ? maks : maksIsi} onChange={(e) => setMaksIsi(e.target.value)} disabled={!bisa || Boolean(sibuk)} />{maksIsi !== "" && Number(maksIsi) !== maks ? <button type="button" className="btn btn-blue sm" disabled={Boolean(sibuk)} onClick={() => jalankan("maks", { action: "maksAktif", nilai: maksIsi }, () => setMaksIsi(""))}>Simpan</button> : null}</label><button type="button" className="btn btn-ghost sm" onClick={onSegarkan || (() => muatUlang(true))} disabled={Boolean(sibuk)}><Icon name="refresh" />Segarkan</button></>, aksiEl) : null}
    {data.error ? <div className="banner err"><Icon name="alert" /><div>Pengambilan belum bisa dibaca: {data.error}</div></div> : null}

    <div ref={antreanRef} className="pk-anchor">
      <AntreanTugas tim={tim} tugas={tugas} kuota={kuota} kini={kini} tabClo={tabClo} setTabClo={setTabClo} bisa={bisa} bisaKabari={bisaKabari} sibuk={Boolean(sibuk)} kontakGuru={kontakGuru} infoAcc={infoAcc} onAcc={aksi.acc} onDicek={aksi.dicek} onKabari={aksi.kabari} onReminder={aksi.reminder} onBuka={(p, opsi) => pilih(p.id, opsi)} onCariGuru={onCariGuru} />
    </div>

    <section ref={tabelRef} className="pk-semua pk-anchor" aria-label="Semua pengambilan">
      <div className="pk-sec-head">
        <h2>Semua pengambilan{namaBulan ? ` · ${namaBulan}` : ""}</h2>
        <span className="muted" aria-live="polite">{numberID(list.length)} dari {numberID(baris.length)} pengambilan</span>
      </div>
      <div className="pk-tools">
        <label className="pg-search-field"><Icon name="search" /><input aria-label="Cari guru, subtes, atau ID proyek" type="search" placeholder="Cari guru, subtes, atau ID proyek…" value={cari} onChange={(e) => setCari(e.target.value)} />{cari ? <button type="button" className="pg-clear-search" aria-label="Hapus pencarian" onClick={() => setCari("")}><Icon name="x" size={14} /></button> : null}</label>
        <SearchableFilter label="Subtes" icon="layers" value={saringSubtes} onChange={setSaringSubtes} options={opsiSubtes} placeholder="Cari nama subtes atau ID proyek…" />
        <SearchableFilter label="Guru" icon="users" value={saringGuru} onChange={setSaringGuru} options={opsiGuru} placeholder="Cari nama guru, ID, atau email…" />
        <div className="seg-tab" role="group" aria-label="Kelompokkan tabel">{[["subtes", "Per subtes"], ["guru", "Per guru"]].map(([k, label]) => <button key={k} type="button" className={view === k ? "on" : ""} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>)}</div>
      </div>
      <div className="pk-chips chips geser" role="group" aria-label="Saring status">
        {SARING_TABEL.filter(([k]) => k === "semua" || hitungSaring[k] || saring === k).map(([k, label]) => <button key={k} type="button" className={"chip sm" + (saring === k ? " active" : "")} aria-pressed={saring === k} onClick={() => setSaring(k)}>{label}<span className="n">{numberID(hitungSaring[k] || 0)}</span></button>)}
        {adaSaring ? <button type="button" className="pg-reset-filters" onClick={resetSaring}><Icon name="restore" size={14} />Reset</button> : null}
      </div>
      {!list.length ? <div className="card empty">{daftar.length ? "Tidak ada pengambilan yang cocok dengan saringan." : `Belum ada pengambilan untuk ${namaBulan || "bulan ini"}.`}</div> : <TabelPengambilan daftar={list} view={view} selected={selected?.id} onPilih={(id) => pilih(id)} kini={kini} targetSubtes={targetSubtes} />}
      {list.length ? <LegendaAlur /> : null}
    </section>

    {selected ? (() => {
      const p = selected;
      const r = barisById.get(p.id) || { p, siap: [], sudah: [], pengingat: [] };
      const progres = progresPengambilan(p);
      const st = statusRingkas(p, kini);
      const ingat = pengingat(p, kini);
      const berikut = p.status === ST.running ? titikBerikut(p, kini) : null;
      const laporan = laporanGuru(p);
      const jadwal = statusTitik(p, kini);
      const lk = langkah(p, r);
      const TAB = [["riwayat", "Riwayat"], ["laporan", `Laporan progres${laporan.length ? ` (${laporan.length})` : ""}`], ["kabar", `Kabar ke guru${r.siap.length ? ` (${r.siap.length})` : ""}`], ["lain", "Tindakan lain"]];
      return createPortal(<Drawer id="pk-detail" key={p.id} side="right" wide title="Detail pengambilan" sub={`${p.nama || p.email} · ${p.subtes}`} busy={Boolean(sibuk)} onClose={tutup}>
        <div className="pg-selected pg-drawer-detail pk-detail">
          {galatDetail ? <div className="banner err" role="alert"><Icon name="alert" /><div>{galatDetail}</div></div> : null}
          <div className="pg-summary">
            <div className="pg-summary-top"><div><b>{[ST.diajukan, ST.ditolak, ST.dibatalkan].includes(p.status) ? `${teksJumlah(p.jumlah, p.isiPaket)} diajukan${p.diajukan ? ` · ${p.diajukan.split(" ")[0]}` : ""}` : `${numberID(progres.soal)}/${numberID(p.jumlah)} soal dilaporkan · ${progres.persen}%`}</b><small>{p.idProyek} · {p.idGuru ? `ID guru ${p.idGuru}` : p.email} · {teksJumlah(p.jumlah, p.isiPaket)}{p.tipe ? ` · ${p.tipe}` : ""} · deadline {tanggalPendek(p.deadline)}</small></div><span className={"pill " + st.kelas}>{st.label}</span></div>
            <div className="pk-d-alur"><Alur p={p} kini={kini} /><small>ACC → 30% → 50% → 100% → QC</small></div>
          </div>
          {ingat.length ? <div className="ps-ingat">{ingat.map((i) => <span key={i.jenis} className={"pill " + i.kelas}><Icon name="alert" size={12} />{i.teks}</span>)}</div> : null}

          <div className={"pk-next" + (lk.tombol ? "" : " diam")}>
            <small>{lk.tombol ? "Langkah berikutnya" : "Keadaan sekarang"}</small>
            <b>{lk.judul}</b>
            {lk.ket ? <span>{lk.ket}</span> : null}
            {lk.tombol ? <div className="pg-actions">{lk.tombol}</div> : null}
            {tim === "rad" && r.siap.length > 0 && !lk.tombol ? <span>CLO belum mengabari guru tentang hasil terakhir.</span> : null}
            {!bisa && lk.tombol && (p.status === ST.diajukan || p.status === ST.review || progresBelumDiperiksa(p).length > 0) && !(tim === "clo" && (r.siap.length || r.pengingat.some((i) => !i.terkirim))) ? <span className="muted">ACC, pemeriksaan, dan review dilakukan akun RAD.</span> : null}
          </div>

          {tolak?.id === p.id ? <form className="pj-tolak" onSubmit={(e) => { e.preventDefault(); jalankan(p.id, { action: "putuskan", id: p.id, acc: false, catatan: tolak.alasan, bulan }, () => setTolak(null)); }}><label className="ffield"><span>Alasan penolakan</span><textarea autoFocus className="input" rows={2} value={tolak.alasan} onChange={(e) => setTolak({ ...tolak, alasan: e.target.value })} /></label><div className="pg-actions"><button type="submit" className="btn btn-red sm" disabled={!bisa || Boolean(sibuk)}>Tolak pengajuan</button><button type="button" className="btn btn-ghost sm" onClick={() => setTolak(null)}>Batal</button></div></form> : null}
          {revisi?.id === p.id ? <form className="pg-revision-form" onSubmit={(e) => { e.preventDefault(); if (revisi.catatan.trim()) jalankan(p.id, { action: "revisiProgres", id: p.id, laporanId: revisi.laporanId, versi: revisi.versi, catatan: revisi.catatan }, () => setRevisi(null)); }}><label className="ffield"><span>Catatan revisi {revisi.versi} · Laporan {laporan.find((l) => l.laporanId === revisi.laporanId)?.noLaporan}</span><textarea autoFocus className="input" rows={3} value={revisi.catatan} maxLength={1500} onChange={(e) => setRevisi({ ...revisi, catatan: e.target.value })} placeholder="Bagian yang perlu diperbaiki…" required /></label><div className="pg-actions"><button type="submit" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk) || !revisi.catatan.trim()}>Simpan permintaan revisi</button><button type="button" className="btn btn-ghost sm" disabled={Boolean(sibuk)} onClick={() => setRevisi(null)}>Batal</button></div></form> : null}
          {dinilai === p.id && p.status === ST.review ? <FormReview p={p} sibuk={Boolean(sibuk)} onBatal={() => setDinilai("")} onKirim={(hasil) => jalankan(p.id, { action: "review", id: p.id, ...hasil }, () => { setDinilai(""); onBerubah?.(); })} /> : null}

          <div className="pk-dtabs" role="tablist" aria-label="Isi detail pengambilan">
            {TAB.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tabDetail === k} className={tabDetail === k ? "on" : ""} onClick={() => setTabDetail(k)}>{label}</button>)}
          </div>

          {tabDetail === "riwayat" ? <div className="pk-dpanel" role="tabpanel">
            {p.ronde ? <div className="ps-hasil"><span><b>{numberID(p.tepat + p.telat)}</b> disetujui</span><span><b>{numberID(p.tolakBuka + p.tolakHangus)}</b> ditolak</span>{p.status !== ST.selesai ? <span><b>{numberID(belumSelesai(p))}</b> belum diputuskan</span> : null}{p.telat ? <small>{p.telat} soal revisi terlambat dibayar 75%.</small> : null}</div> : null}
            {p.status === ST.revisi ? <div className="ps-revisi"><b>{labelSiklusRevisi(siklusRevisi(p, 100))} · hasil akhir</b><small>Batas revisi {p.batasRevisi}</small><p>{p.catatanRevisi}</p></div> : null}
            {p.catatan ? <p className="ps-catatan">{p.catatan}</p> : null}
            <RiwayatPengambilan key={`${p.id}:${tahapRiwayat}`} p={p} awal={tahapRiwayat} />
          </div> : null}

          {tabDetail === "laporan" ? <div className="pk-dpanel" role="tabpanel">
            {jadwal.length ? <ul className="pk-jadwal" aria-label="Jadwal lapor progres">{jadwal.map((t) => <li key={t.persen} className={t.selesai ? (t.telat ? "telat" : "ok") : t.lewat ? "lewat" : ""}><b>{t.persen}%</b><span>{tanggalHari(t.tanggal)} · minimal {numberID(t.min)} soal</span><span className={"pill " + (t.selesai ? (t.telat ? "qc" : "appr") : t.lewat || t.hm.hari === 0 ? "rev" : t.hm.hari <= 2 ? "qc" : "run")}>{t.selesai ? (t.telat ? "Terpenuhi · telat" : "Terpenuhi") : t.lewat ? t.h : t.h || "Menunggu"}</span></li>)}</ul> : <p className="muted">Proyek ini tidak punya tanggal lapor progres{p.tAcc ? " yang berlaku untuk pengambilan ini" : ""}.</p>}
            {laporan.length ? <div className="pg-report-reviews">{laporan.map((l) => { const s = statusLaporan(p, l); const siklus = siklusRevisi(p, l.persen, l.laporanId); const aktif = [ST.running, ST.review, ST.revisi].includes(p.status); return <div className="pg-report-review" key={l.laporanId}><div><b>Laporan {l.noLaporan} · {l.persen}% {s === "baru" && aktif ? <span className="pill qc">BARU</span> : null}</b><small>Versi {l.versi} · {numberID(l.soal)}/{numberID(p.jumlah)} soal · {l.waktu} · {s === "revisi" ? `menunggu revisi ${siklus.diminta}` : s === "dicek" ? "sudah diperiksa" : "belum diperiksa"}</small>{l.catatan ? <small>“{l.catatan}”</small> : null}</div><div className="pg-actions">{l.link ? <a className="btn btn-ghost sm" href={l.link} target="_blank" rel="noopener noreferrer"><Icon name="external" />Buka progres</a> : <small className="muted">tanpa link</small>}{aktif && s === "baru" ? <button type="button" className="btn btn-blue sm" disabled={!bisa || Boolean(sibuk)} onClick={() => aksi.dicek(p, l)}><Icon name="check" />Sudah diperiksa</button> : null}{p.status === ST.running && s !== "revisi" ? <button type="button" className="btn btn-ghost sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setRevisi({ id: p.id, laporanId: l.laporanId, versi: l.versi, catatan: "" })}>Minta revisi {l.versi}</button> : null}</div></div>; })}</div> : <p className="muted">Belum ada laporan progres dari guru.</p>}
          </div> : null}

          {tabDetail === "kabar" ? <div className="pk-dpanel" role="tabpanel"><KabarPengambilan key={`${p.id}:${drafAwal}`} p={p} wa={kontakGuru(p)?.wa} bisa={bisaKabari} sibuk={Boolean(sibuk)} drafAwal={drafAwal} onCatat={(body) => jalankan(p.id, body)} /></div> : null}

          {tabDetail === "lain" ? <div className="pk-dpanel" role="tabpanel">
            {[ST.running, ST.review, ST.revisi].includes(p.status) && FormHentikan ? (henti === p.id ? <FormHentikan key={p.id} p={p} sibuk={Boolean(sibuk)} onBatal={() => setHenti("")} onKirim={(hasil) => jalankan(p.id, { action: "hentikan", id: p.id, ...hasil }, () => { setHenti(""); onBerubah?.(); })} /> : <div className="pk-henti-ajak"><div><b>Guru mundur / pengambilan tidak dilanjutkan?</b><small>Tutup sekarang dengan menentukan berapa soal diterima dan berapa ditolak, tanpa menunggu QC selesai.</small></div><button type="button" className="btn btn-ghost sm pk-henti-btn" disabled={!bisa || Boolean(sibuk)} onClick={() => setHenti(p.id)}><Icon name="x" />Hentikan pengambilan</button></div>) : null}
            {p.status === ST.selesai && FormKoreksi ? (koreksi === p.id ? <FormKoreksi key={p.id} p={p} sibuk={Boolean(sibuk)} onBatal={() => setKoreksi("")} onKirim={(hasil) => jalankan(p.id, { action: "koreksi", id: p.id, ...hasil }, () => { setKoreksi(""); onBerubah?.(); })} /> : <div className="pk-henti-ajak pk-ubah-ajak"><div><b>Hasil akhir: {numberID(p.tepat + p.telat)} diterima · {numberID(p.tolakBuka + p.tolakHangus)} ditolak</b><small>Salah input? Koreksi jumlah yang diterima dan ditolak — log, katalog, dan arsip ikut disesuaikan.</small></div><button type="button" className="btn btn-ghost sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setKoreksi(p.id)}><Icon name="edit" />Koreksi hasil akhir</button></div>) : null}
            {(p.tolakBuka || 0) + (p.tolakHangus || 0) > 0 && FormUbahTolak ? (() => {
              const diarsipkan = (data.arsip || []).filter((a) => a.asal === p.id).reduce((n, a) => n + (a.jumlah || 0), 0);
              return ubahTolak === p.id ? <FormUbahTolak key={p.id} p={p} diarsipkan={diarsipkan} sibuk={Boolean(sibuk)} onBatal={() => setUbahTolak("")} onKirim={(hasil) => jalankan(p.id, { action: "ubahTolak", id: p.id, ...hasil }, () => { setUbahTolak(""); onBerubah?.(); })} /> : <div className="pk-henti-ajak pk-ubah-ajak"><div><b>Kuota {numberID(p.tolakBuka + p.tolakHangus)} soal ditolak</b><small>Dibuka lagi {numberID(p.tolakBuka)} · hangus {numberID(Math.max(0, p.tolakHangus - diarsipkan))} · diarsipkan {numberID(diarsipkan)}. Salah pilih? Ubah tujuannya, mis. ke arsip.</small></div><button type="button" className="btn btn-ghost sm" disabled={!bisa || Boolean(sibuk)} onClick={() => setUbahTolak(p.id)}><Icon name="edit" />Ubah tujuan kuota</button></div>;
            })() : null}
            <p className="muted">Pesan WhatsApp di bawah ikut tercatat sebagai kontak ke guru. Untuk kabar hasil pemeriksaan, pakai tab Kabar ke guru supaya tercatat per hasil.</p>
            <div className="pg-actions">{tombolWa(p, "chat", "Chat guru")}{p.status === ST.running ? tombolWa(p, "acc", "Kabari di-ACC") : null}{p.status === ST.revisi ? tombolWa(p, "revisi", "Kabari revisi") : null}{berikut ? tombolWa(p, "progres", `Ingatkan lapor ${berikut.persen}%`) : null}{laporanBaru(p).length ? tombolWa(p, "progres-terima", "Kabari progres diterima") : null}{ingat.some((i) => i.jenis === "deadline") ? tombolWa(p, "lewat", "Ingatkan deadline") : null}{ingat.some((i) => i.jenis === "revisi") ? tombolWa(p, "ingat-revisi", "Ingatkan revisi") : null}{p.status === ST.selesai ? tombolWa(p, "selesai", "Kabari hasil akhir") : null}{p.status === ST.ditolak ? tombolWa(p, "tolak", "Kabari ditolak") : null}{p.gagal >= PERINGATAN_MULAI && p.status !== ST.selesai ? tombolWa(p, "peringatan", "Kirim peringatan") : null}{!kontakGuru(p)?.wa ? <small className="muted">Nomor WhatsApp guru belum ada di Database guru.</small> : null}</div>
            <div className="pg-actions">{linkSah(p.link) ? <a className="btn btn-ghost sm" href={p.link} target="_blank" rel="noopener noreferrer"><Icon name="external" />Buka hasil akhir</a> : null}{p.gagal >= DENDA_SETELAH && !p.denda ? <button type="button" className="btn btn-red sm" disabled={!bisa || Boolean(sibuk)} onClick={() => window.confirm(`Terapkan potongan 25% untuk ${p.subtes} (${p.nama})?`) && jalankan(p.id, { action: "denda", id: p.id }, () => onBerubah?.())}>Terapkan denda 25%</button> : null}{p.denda ? <span className="pill rev">Denda 25%</span> : null}{p.gagal ? <small className="muted">Review gagal {p.gagal}×</small> : null}<span className={"pill " + kelasStatus(p.status)}>Status sheet: {labelStatus(p.status)}</span></div>
          </div> : null}
        </div>
      </Drawer>, document.body);
    })() : null}
    {info ? <p className="pk-toast" role="status"><Icon name="check" size={15} />{info}</p> : null}
  </div>;
}
