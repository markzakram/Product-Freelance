"use client";

import { useState } from "react";
import { keputusanPengambilan, kabarKeputusan, judulKeputusan, pesanKabar, pengingatPantauan } from "@/lib/pantauanOpsi";
import { tautanWa } from "@/lib/tautan";
import Icon from "./Icon";

export default function KabarPengambilan({ p, wa, bisa, sibuk, onCatat }) {
  const [draf, setDraf] = useState("");
  const keputusan = keputusanPengambilan(p);
  const pengingat = pengingatPantauan(p);
  return <section className="pn-kabar" aria-label="Kabar ke guru">
    <div className="section-head"><h3>Kabar ke guru</h3><span className="muted">Per hasil pemeriksaan</span></div>
    {!keputusan.length ? <p className="muted">Belum ada hasil RAD untuk versi terbaru. Kiriman atau revisi baru masih perlu diperiksa.</p> : null}
    {keputusan.map((e) => {
      const kabar = kabarKeputusan(p, e);
      return <div className="pn-kabar-item" key={e.id}>
        <div className="pn-kabar-top"><b>{judulKeputusan(e)}</b><span className={"pill " + (kabar ? "appr" : "qc")}>{kabar ? "Sudah dikabari" : "Siap dikabari"}</span></div>
        <small>Hasil RAD: {e.waktu || "—"} WIB · {e.oleh || "—"}</small>
        {e.catatan ? <p>{e.catatan}</p> : null}
        {kabar ? <small className="pn-contact-stamp">Dikabari {kabar.waktu} WIB · {kabar.oleh}</small> : <>
          <div className="pg-actions"><button type="button" className="btn btn-ghost sm" aria-expanded={draf === e.id} onClick={() => setDraf(draf === e.id ? "" : e.id)}>{draf === e.id ? "Tutup draf" : "Lihat draf WA"}</button><button type="button" className="btn btn-blue sm" disabled={!bisa || sibuk} onClick={() => onCatat({ action: "kabari", id: p.id, keputusanId: e.id })}><Icon name="check" />Catat sudah dikabari</button></div>
          <small className="muted">Catat setelah pesan dikirim. Membuka draf atau WhatsApp belum menandai terkirim.</small>
        </>}
        {draf === e.id ? <div className="pn-draft"><label className="ffield"><span>Draf pesan · {judulKeputusan(e)}</span><textarea className="input" rows={5} readOnly value={pesanKabar(p, e)} /></label>{wa ? <a className="btn btn-wa sm" href={tautanWa(wa, pesanKabar(p, e))} target="_blank" rel="noopener noreferrer"><Icon name="send" />Buka WhatsApp</a> : <small className="muted">Nomor WhatsApp belum tersedia. Draf dapat disalin.</small>}</div> : null}
      </div>;
    })}
    {pengingat.map((i) => <div key={i.key} className="pn-kabar-item"><div className="pn-kabar-top"><b>{i.teks}</b><span className={"pill " + (i.terkirim ? "appr" : i.kelas)}>{i.terkirim ? "Reminder dicatat" : "Perlu reminder"}</span></div>{i.terkirim ? <small>Dikirim {i.terkirim.waktu} WIB · {i.terkirim.oleh}</small> : <><div className="pg-actions">{wa ? <a className="btn btn-ghost sm" href={tautanWa(wa, `Halo ${p.nama || "Bapak/Ibu"}, pengingat ${p.subtes} (${p.idProyek}): ${i.teks}. Mohon kabari progres dan kendalanya, ya.`)} target="_blank" rel="noopener noreferrer"><Icon name="send" />Buka WhatsApp</a> : null}<button type="button" className="btn btn-ghost sm" disabled={!bisa || sibuk} onClick={() => onCatat({ action: "reminder", id: p.id, pengingatId: i.key })}>Catat reminder dikirim</button></div><small className="muted">Konfirmasi setelah mengirim. Pengingat yang belum selesai dapat muncul kembali pada hari berikutnya.</small></>}</div>)}
    {!bisa ? <small className="muted">Pencatatan kabar dilakukan oleh tim CLO atau pemilik dengan akses tulis.</small> : null}
  </section>;
}
