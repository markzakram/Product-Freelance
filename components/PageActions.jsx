"use client";

// Tombol utama tiap halaman (Tambah, Cetak, cari) digambar di header halaman,
// di kanan judul — tapi logikanya tetap tinggal di panel masing-masing.
// Portal dipakai supaya state form/simpan/hapus tidak perlu diangkat ke
// AdminBoard hanya demi posisi tombol. Tanpa target (mis. di uji render),
// tombolnya tampil di tempat seperti biasa.
import { createPortal } from "react-dom";

export default function PageActions({ el, children }) {
  if (el) return createPortal(children, el);
  return <div className="section-head"><div className="head-actions">{children}</div></div>;
}
