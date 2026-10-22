"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

export default function PengambilanFilters({ cari, setCari, status, setStatus, options, statusCounts, tahap, setTahap, tahapCounts }) {
  const [open, setOpen] = useState(false);
  const popupId = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const popup = useRef(null);
  const current = options.find(([k]) => k === status);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector('[aria-checked="true"]')?.focus();
    const outside = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") setOpen(false);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const items = [...popup.current.querySelectorAll('[role="menuitemradio"]')];
      const index = items.indexOf(document.activeElement);
      const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };
  return (
    <div className="pg-filter-panel">
      <div className="pg-filter-toolbar">
        <label className="pg-search-field"><Icon name="search" /><input aria-label="Cari guru, subtes, atau ID proyek" type="search" placeholder="Cari guru, subtes, atau ID proyek…" value={cari} onChange={(e) => setCari(e.target.value)} />{cari ? <button type="button" className="pg-clear-search" aria-label="Hapus pencarian" onClick={() => setCari("")}><Icon name="x" size={14} /></button> : null}</label>
        <div className="pg-status-picker" ref={root}>
          <button type="button" ref={trigger} className={"pg-status-trigger" + (status !== "semua" ? " active" : "")} aria-haspopup="menu" aria-expanded={open} aria-controls={popupId} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}><Icon name="filter" /><span>{current[1]}</span><span className="pg-filter-count">{statusCounts[status] || 0}</span><Icon name="chevronDown" size={14} /></button>
          {open ? <div ref={popup} id={popupId} className="pg-status-popup" role="menu" aria-label="Status pekerjaan" onKeyDown={onKey}>{options.map(([key, label]) => <button key={key} type="button" role="menuitemradio" aria-checked={status === key} onClick={() => { setStatus(key); close(); }}><span>{label}</span><span className="pg-status-option-end">{statusCounts[key] || 0}{status === key ? <Icon name="check" size={14} /> : null}</span></button>)}</div> : null}
        </div>
      </div>
      <div className="pg-slicer-row">
        <span className="pg-slicer-label"><Icon name="layers" size={14} />Tahap aktif</span>
        <div className="pg-slicer" role="group" aria-label="Filter tahap aktif">{["semua", 30, 50, 100].map((n) => <button type="button" key={n} aria-pressed={tahap === String(n)} onClick={() => setTahap(String(n))}><span>{n === "semua" ? "Semua" : `${n}%`}</span><span className="pg-slicer-count">{tahapCounts[n] || 0}</span></button>)}</div>
        {cari || status !== "semua" || tahap !== "semua" ? <button type="button" className="pg-reset-filters" onClick={() => { setCari(""); setStatus("semua"); setTahap("semua"); }}><Icon name="restore" size={14} />Reset filter</button> : null}
      </div>
    </div>
  );
}
