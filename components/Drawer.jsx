"use client";

// Panel samping untuk form tambah/edit. Dipilih ketimbang popup di tengah
// supaya tabel di belakangnya tetap terlihat saat mengisi — admin sering perlu
// melirik baris lain (kode proyek, nama guru) sambil mengetik.
// Konfirmasi hapus/arsip tetap popup kecil: di situ alurnya MEMANG harus berhenti.

import { useEffect, useRef } from "react";
import Icon from "./Icon";

export default function Drawer({ title, sub, onClose, busy, children, foot, wide }) {
  const ref = useRef(null);
  // Efek di bawah hanya dipasang sekali; tanpa ref ia akan terus membaca nilai
  // `busy` saat panel dibuka, dan Esc tetap menutup panel ketika sedang menyimpan.
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const prev = document.activeElement;
    // fokus ke isian pertama, bukan tombol tutup
    const first = ref.current?.querySelector("input:not([type=hidden]):not([disabled]), select, textarea");
    (first || ref.current)?.focus();
    // Esc yang sudah ditangani isian di dalamnya (mis. menutup daftar saran)
    // tidak boleh ikut menutup panel — isian form bisa hilang semua.
    const onKey = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented && !busyRef.current) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="drawer-scrim" onClick={() => !busy && onClose()} />
      <aside ref={ref} tabIndex={-1} className={"drawer" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {sub ? <p>{sub}</p> : null}
          </div>
          <button type="button" className="icon-x" onClick={onClose} disabled={busy} aria-label="Tutup">
            <Icon name="x" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot ? <div className="drawer-foot">{foot}</div> : null}
      </aside>
    </>
  );
}

/** Popup kecil untuk konfirmasi — sengaja menghentikan alur. */
export function Dialog({ title, onClose, busy, children, foot, size = "sm" }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <div className={"modal " + size} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-x" onClick={onClose} disabled={busy} aria-label="Tutup">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot ? <div className="modal-foot">{foot}</div> : null}
      </div>
    </div>
  );
}
