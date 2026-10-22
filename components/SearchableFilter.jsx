"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cocokTeksPengambilan } from "@/lib/pengambilanFilter";
import Icon from "./Icon";

export default function SearchableFilter({ label, icon, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const input = useRef(null);
  const list = useRef(null);
  const selected = options.find((o) => o.value === value) || options[0];
  const hasil = options.filter((o) => cocokTeksPengambilan(query, o.label, o.code || "", o.search || ""));
  const activeIndex = Math.min(active, hasil.length - 1);
  const activeId = open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;
  const close = (focus = true) => { setOpen(false); if (focus) trigger.current?.focus(); };
  const buka = () => { setQuery(""); setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (e) => { if (!root.current?.contains(e.target)) close(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (!open || activeIndex < 0 || !list.current) return;
    const item = list.current.children[activeIndex];
    if (!item) return;
    const viewport = list.current.getBoundingClientRect();
    const option = item.getBoundingClientRect();
    if (option.top < viewport.top) list.current.scrollTop += option.top - viewport.top;
    else if (option.bottom > viewport.bottom) list.current.scrollTop += option.bottom - viewport.bottom;
  }, [activeIndex, open]);
  const pilih = (o) => { if (!o) return; onChange(o.value); close(); };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close();
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!hasil.length) return;
      if (e.key === "Home") setActive(0);
      else if (e.key === "End") setActive(hasil.length - 1);
      else setActive((Math.max(0, activeIndex) + (e.key === "ArrowDown" ? 1 : -1) + hasil.length) % hasil.length);
    } else if (e.key === "Enter") { e.preventDefault(); pilih(hasil[activeIndex]); }
  };
  return (
    <div className="pg-status-picker pg-searchable-filter" ref={root}>
      <button type="button" ref={trigger} className={"pg-status-trigger" + (value !== options[0]?.value ? " active" : "")} aria-label={`${label}: ${selected?.label || ""}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => open ? close() : buka()} onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); buka(); } }}>
        <Icon name={icon} /><span className="pg-filter-value"><small>{label}</small><strong>{selected?.label || "—"}</strong></span><span className="pg-filter-count">{selected?.count || 0}</span><Icon name="chevronDown" size={14} />
      </button>
      {open ? <div className="pg-status-popup pg-searchable-popup" onKeyDown={onKey}>
        <label className="pg-dropdown-search"><Icon name="search" size={14} /><input ref={input} role="combobox" type="text" autoComplete="off" aria-label={`Cari ${label.toLocaleLowerCase("id")} dalam dropdown`} aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeId} placeholder={placeholder || `Ketik untuk mencari ${label.toLocaleLowerCase("id")}…`} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} /></label>
        <div ref={list} id={listId} role="listbox" aria-label={`Pilihan ${label.toLocaleLowerCase("id")}`} className="pg-dropdown-options">
          {hasil.map((o, i) => <button type="button" key={o.value} id={`${listId}-${i}`} role="option" aria-selected={value === o.value} tabIndex={-1} className={i === activeIndex ? "focused" : ""} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pilih(o)}><span className="pg-dropdown-option-name"><span>{o.label}</span>{o.code ? <small>ID {o.code}</small> : null}</span><span className="pg-status-option-end">{o.count || 0}{value === o.value ? <Icon name="check" size={14} /> : null}</span></button>)}
        </div>
        {!hasil.length ? <div className="pg-dropdown-empty" role="status">Tidak ada pilihan yang cocok dengan “{query}”.</div> : <div className="pg-dropdown-foot" role="status">{hasil.length} dari {options.length} pilihan</div>}
      </div> : null}
    </div>
  );
}
