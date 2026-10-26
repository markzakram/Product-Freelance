"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { notifikasiClo } from "@/lib/notifikasiClo";
import Icon from "./Icon";

export default function NotifikasiClo({ data, bulan, namaBulan, onPilih }) {
  const [buka, setBuka] = useState(false);
  const [baru, setBaru] = useState([]);
  const terlihat = useRef(null), root = useRef(null), tombol = useRef(null);
  const daftar = useMemo(() => notifikasiClo(data?.pengerjaan || []), [data]);
  const siap = Boolean(data && !data.error);
  // Baseline pertama menampilkan antrean lama di lonceng. Hanya hasil baru
  // setelah sinkronisasi berikutnya memunculkan pemberitahuan singkat.
  useEffect(() => {
    if (!siap) return;
    const keys = new Set(daftar.map((n) => n.key));
    if (terlihat.current) {
      const masuk = daftar.filter((n) => !terlihat.current.has(n.key));
      if (masuk.length) setBaru(masuk.map((n) => n.key));
    }
    terlihat.current = new Set([...(terlihat.current || []), ...keys]);
  }, [daftar, siap]);
  useEffect(() => {
    if (!buka) return;
    root.current?.querySelector(".nc-list button")?.focus();
    const click = (e) => { if (!root.current?.contains(e.target)) setBuka(false); };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); setBuka(false); tombol.current?.focus(); } };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", click); document.removeEventListener("keydown", key); };
  }, [buka]);
  const pilih = (n) => { setBuka(false); setBaru([]); tombol.current?.focus(); onPilih({ ...n, bulan }); };
  const pesan = siap ? daftar.filter((n) => baru.includes(n.key)) : [];
  return <div className="nc" ref={root}>
    <button type="button" ref={tombol} className={"btn btn-ghost nc-trigger" + (daftar.length && siap ? " has-items" : "")} aria-expanded={buka} aria-controls="notifikasi-clo" aria-label={`Notifikasi CLO${siap ? `: ${daftar.length} hasil siap dikabari` : ": data belum tersedia"}`} onClick={() => setBuka(!buka)}><Icon name="bell" /><span>Hasil RAD</span>{siap ? <span className="badge-n">{daftar.length}</span> : null}</button>
    {buka ? <section id="notifikasi-clo" className="nc-panel" aria-label="Notifikasi hasil RAD">
      <div className="nc-head"><div><b>Siap dikabari CLO</b><small>{namaBulan || bulan} · {siap ? `${daftar.length} hasil pemeriksaan` : "Data belum tersedia"}</small></div><button type="button" className="icon-x" aria-label="Tutup notifikasi" onClick={() => { setBuka(false); tombol.current?.focus(); }}><Icon name="x" /></button></div>
      {data?.error ? <p className="nc-empty" role="status">Notifikasi belum dapat diperbarui. Gunakan Segarkan atau buka kembali halaman.</p> : !data ? <p className="nc-empty">Memuat hasil pemeriksaan…</p> : !daftar.length ? <p className="nc-empty">Tidak ada hasil pemeriksaan yang menunggu kabar pada bulan ini.</p> : <ul className="nc-list">{daftar.map((n) => <li key={n.key}><button type="button" onClick={() => pilih(n)}><span className="nc-item-top"><b>{n.nama}</b><Icon name="chevronRight" /></span><small>{n.idProyek} · {n.subtes}</small><strong>{n.judul}</strong><span>{n.hasil}</span><small>{n.waktu || "Waktu belum tercatat"}{n.waktu ? " WIB" : ""} · {n.oleh || "RAD"}</small></button></li>)}</ul>}
      <p className="nc-note">Klik untuk membuka detail di kanan. Hasil keluar dari antrean setelah CLO mencatat sudah dikabari atau ada kiriman guru yang lebih baru.</p>
    </section> : null}
    <div className="nc-announcement" role="status" aria-live="polite">{pesan.length ? <div className="nc-toast"><button type="button" className="nc-toast-link" onClick={() => pilih(pesan[0])}><Icon name="bell" /><span><b>{pesan.length > 1 ? `${pesan.length} hasil RAD baru siap dikabari` : `${pesan[0].nama} · siap dikabari`}</b><small>{pesan[0].judul} · {pesan[0].hasil}</small><span>Lihat detail<Icon name="chevronRight" size={14} /></span></span></button><button type="button" className="icon-x" aria-label="Tutup pemberitahuan" onClick={() => setBaru([])}><Icon name="x" /></button></div> : null}</div>
  </div>;
}
