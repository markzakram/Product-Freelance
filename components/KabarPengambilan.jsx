"use client";

import { useEffect, useRef, useState } from "react";
import { labelPemeriksaan } from "@/lib/notifikasiClo";
import { keputusanPengambilan, kabarKeputusan, judulKeputusan, pesanKabar, pesanReminder, pengingatPantauan, catatanWajib } from "@/lib/pantauanOpsi";
import { tautanWa } from "@/lib/tautan";
import Icon from "./Icon";

// Draf pesan untuk satu hasil RAD: bisa diedit sebelum dikirim. Catatan RAD
// wajib ikut untuk penolakan/revisi; untuk hasil yang beres hanya bila dicentang.
function Draf({ p, e, wa }) {
  const wajib = catatanWajib(e);
  const [pakaiCatatan, setPakaiCatatan] = useState(wajib);
  const [teks, setTeks] = useState(() => pesanKabar(p, e, { sertakanCatatan: wajib }));
  const gantiCatatan = (v) => { setPakaiCatatan(v); setTeks(pesanKabar(p, e, { sertakanCatatan: v })); };
  return <div className="pn-draft">
    {e.catatan && !wajib ? <label className="pn-opsi"><input type="checkbox" checked={pakaiCatatan} onChange={(x) => gantiCatatan(x.target.checked)} /> Sertakan catatan RAD di pesan</label> : null}
    <label className="ffield"><span>Draf pesan · {judulKeputusan(e)} <small className="muted">(boleh diubah)</small></span><textarea className="input" rows={6} value={teks} onChange={(x) => setTeks(x.target.value)} /></label>
    <div className="pg-actions">
      {wa ? <a className="btn btn-wa sm" href={tautanWa(wa, teks)} target="_blank" rel="noopener noreferrer"><Icon name="send" />Buka WhatsApp</a> : <small className="muted">Nomor WhatsApp belum tersedia. Draf dapat disalin.</small>}
      <button type="button" className="btn btn-ghost sm" onClick={() => setTeks(pesanKabar(p, e, { sertakanCatatan: pakaiCatatan }))}>Kembalikan draf awal</button>
    </div>
  </div>;
}

export default function KabarPengambilan({ p, wa, bisa, sibuk, onCatat, drafAwal = "" }) {
  const [draf, setDraf] = useState(drafAwal);
  const hasilRef = useRef(null);
  useEffect(() => { hasilRef.current?.scrollIntoView({ block: "nearest" }); }, [drafAwal]);
  const keputusan = keputusanPengambilan(p);
  const pengingat = pengingatPantauan(p);
  return <section className="pn-kabar" aria-label="Kabar ke guru">
    <div className="section-head"><h3>Kabar ke guru</h3><span className="muted">Per hasil pemeriksaan</span></div>
    {!keputusan.length ? <p className="muted">Belum ada hasil RAD untuk versi terbaru. Kiriman atau revisi baru masih perlu diperiksa.</p> : null}
    {keputusan.map((e) => {
      const kabar = kabarKeputusan(p, e);
      return <div className={"pn-kabar-item" + (e.id === drafAwal ? " nc-target" : "")} key={e.id} ref={e.id === drafAwal ? hasilRef : undefined}>
        <div className="pn-kabar-top"><b>{judulKeputusan(e)}</b><span className={"pill " + (kabar ? "appr" : "qc")}>{kabar ? "Sudah dikabari" : "Siap dikabari"}</span></div>
        {["review", "dicek", "minta_revisi"].includes(e.jenis) ? <b className="nc-review-label">{labelPemeriksaan(e)}</b> : null}
        <small>Hasil RAD: {e.waktu || "—"} WIB · {e.oleh || "—"}</small>
        {e.catatan ? <p><small className="muted">Catatan RAD{catatanWajib(e) ? "" : " (opsional, tidak otomatis ikut di pesan)"}:</small><br />{e.catatan}</p> : null}
        {kabar ? <small className="pn-contact-stamp">Dikabari {kabar.waktu} WIB · {kabar.oleh}</small> : <>
          <div className="pg-actions"><button type="button" className="btn btn-ghost sm" aria-expanded={draf === e.id} onClick={() => setDraf(draf === e.id ? "" : e.id)}>{draf === e.id ? "Tutup draf" : "Lihat draf WA"}</button><button type="button" className="btn btn-blue sm" disabled={!bisa || sibuk} onClick={() => onCatat({ action: "kabari", id: p.id, keputusanId: e.id })}><Icon name="check" />Catat sudah dikabari</button></div>
          <small className="muted">Catat setelah pesan dikirim. Membuka draf atau WhatsApp belum menandai terkirim.</small>
        </>}
        {draf === e.id ? <Draf p={p} e={e} wa={wa} /> : null}
      </div>;
    })}
    {pengingat.map((i) => <div key={i.key} className="pn-kabar-item"><div className="pn-kabar-top"><b>{i.teks}</b><span className={"pill " + (i.terkirim ? "appr" : i.kelas)}>{i.terkirim ? "Reminder dicatat" : "Perlu reminder"}</span></div>{i.terkirim ? <small>Dikirim {i.terkirim.waktu} WIB · {i.terkirim.oleh}</small> : <><div className="pg-actions">{wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, pesanReminder(p, i))} target="_blank" rel="noopener noreferrer"><Icon name="send" />Buka WhatsApp</a> : null}<button type="button" className="btn btn-ghost sm" disabled={!bisa || sibuk} onClick={() => onCatat({ action: "reminder", id: p.id, pengingatId: i.key })}>Catat reminder dikirim</button></div><small className="muted">Konfirmasi setelah mengirim. Pengingat yang belum selesai dapat muncul kembali pada hari berikutnya.</small></>}</div>)}
    {!bisa ? <small className="muted">Pencatatan kabar dilakukan oleh tim CLO atau pemilik dengan akses tulis.</small> : null}
  </section>;
}
