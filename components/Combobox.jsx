"use client";

// ============================================================================
//  Kotak pencarian dengan saran — pengganti <datalist>.
//
//  <datalist> tidak bisa menampilkan apa pun selain teks polos: tidak ada kode,
//  sisa kuota, atau sorotan huruf yang cocok, dan tampilannya beda di tiap
//  browser (di Safari ponsel nyaris tak terlihat). Komponen ini:
//    - tetap menerima ketikan bebas (nama guru baru, PIC baru) — `allowFree`
//    - menyaring per KATA ("mat lanj" menemukan "Matematika Tingkat Lanjut")
//    - bisa dipakai penuh dengan keyboard: ↑ ↓ Enter Esc Tab
//    - mode `multiple`: tiap pilihan jadi token (dipakai untuk Output master)
// ============================================================================

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

const lower = (s) => String(s ?? "").toLowerCase();

function Sorot({ text, words }) {
  const s = String(text ?? "");
  if (!words.length || !s) return s;
  // tandai kemunculan pertama tiap kata, tanpa tumpang-tindih
  const ranges = [];
  const l = s.toLowerCase();
  words.forEach((w) => {
    const i = l.indexOf(w);
    if (i >= 0 && !ranges.some(([a, b]) => i < b && i + w.length > a)) ranges.push([i, i + w.length]);
  });
  if (!ranges.length) return s;
  ranges.sort((a, b) => a[0] - b[0]);
  const out = [];
  let pos = 0;
  ranges.forEach(([a, b], k) => {
    if (a > pos) out.push(s.slice(pos, a));
    out.push(<mark key={k}>{s.slice(a, b)}</mark>);
    pos = b;
  });
  if (pos < s.length) out.push(s.slice(pos));
  return out;
}

export default function Combobox({
  id,
  value,
  onChange,
  options = [],
  placeholder,
  multiple = false,
  allowFree = true,
  invalid = false,
  icon,
  label, // aria-label bila tak ada <label for>
  footNote,
  max = 60,
}) {
  const autoId = useId();
  const inputId = id || "cbx-" + autoId;
  const listId = inputId + "-list";
  const root = useRef(null);
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // saring hanya setelah mengetik
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const tokens = multiple ? (Array.isArray(value) ? value : []) : [];
  // Tanpa ketikan bebas, kotak menampilkan teks yang sedang diketik — bukan
  // nilai terpilih — kalau tidak, huruf yang diketik tidak pernah tampil.
  const text = multiple || !allowFree ? query : String(value ?? "");
  const words = typed ? lower(text).split(/\s+/).filter(Boolean) : [];

  const hasil = useMemo(() => {
    const pakai = new Set(tokens.map(lower));
    const list = options.filter((o) => !multiple || !pakai.has(lower(o.value)));
    if (!words.length) return list;
    return list.filter((o) => {
      const hay = lower(o.search || `${o.code || ""} ${o.label} ${o.meta || ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [options, words.join(" "), tokens.join("|"), multiple]); // eslint-disable-line react-hooks/exhaustive-deps

  const tampil = hasil.slice(0, max);

  useEffect(() => {
    const off = (e) => {
      if (root.current && !root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  useEffect(() => setActive(0), [words.join(" ")]); // eslint-disable-line react-hooks/exhaustive-deps

  const pilih = (o) => {
    if (!o || o.disabled) return;
    if (multiple) {
      onChange([...tokens, o.value]);
      setQuery("");
      setTyped(false);
      input.current?.focus();
    } else {
      onChange(o.value);
      if (!allowFree) setQuery("");
      setTyped(false);
      setOpen(false);
    }
  };

  const tambahBebas = () => {
    const t = query.trim();
    if (!t || tokens.some((x) => lower(x) === lower(t))) return;
    onChange([...tokens, t]);
    setQuery("");
    setTyped(false);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, tampil.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && tampil[active] && (typed || !multiple)) {
        e.preventDefault();
        pilih(tampil[active]);
      } else if (multiple && allowFree && query.trim()) {
        e.preventDefault();
        tambahBebas();
      }
    } else if (e.key === "Escape") {
      if (open) {
        // Tandai "sudah ditangani" supaya panel samping tidak ikut tertutup.
        // stopPropagation saja tidak cukup: di App Router, React memasang
        // pendengarnya di `document` — node yang SAMA dengan pendengar panel.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "Backspace" && multiple && !query && tokens.length) {
      onChange(tokens.slice(0, -1));
    }
  };

  const activeId = open && tampil[active] ? `${inputId}-opt-${active}` : undefined;

  return (
    <div ref={root} className={"cbx" + (open ? " open" : "") + (invalid ? " err" : "")}>
      <div className="cbx-field" onClick={() => input.current?.focus()}>
        {icon ? <Icon name={icon} /> : null}
        {tokens.map((t) => (
          <span key={t} className="cbx-token">
            {t}
            <button type="button" aria-label={`Hapus ${t}`} onClick={(e) => { e.stopPropagation(); onChange(tokens.filter((x) => x !== t)); }}>
              <Icon name="x" size={12} stroke={2.2} />
            </button>
          </span>
        ))}
        <input
          ref={input}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={label}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          value={text}
          placeholder={tokens.length ? "" : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setTyped(true);
            setOpen(true);
            if (multiple) setQuery(e.target.value);
            else if (allowFree) onChange(e.target.value);
            else setQuery(e.target.value);
          }}
          onKeyDown={onKey}
        />
      </div>

      {open && (tampil.length || (multiple && allowFree && query.trim())) ? (
        <div className="cbx-list" id={listId} role="listbox">
          {tampil.map((o, i) => (
            <div
              key={o.value + "-" + i}
              id={`${inputId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={o.disabled || undefined}
              className={"cbx-opt" + (i === active ? " active" : "")}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pilih(o)}
            >
              {o.code ? <span className="cbx-code"><Sorot text={o.code} words={words} /></span> : null}
              <span className="cbx-main">
                <b><Sorot text={o.label} words={words} /></b>
                {o.meta ? <small>{o.meta}</small> : null}
              </span>
              {o.side ? <span className={"cbx-side" + (o.sideOff ? " off" : "")}>{o.side}</span> : null}
            </div>
          ))}
          {multiple && allowFree && query.trim() && !tampil.some((o) => lower(o.value) === lower(query.trim())) ? (
            <div className="cbx-opt" onMouseDown={(e) => e.preventDefault()} onClick={tambahBebas}>
              <span className="cbx-main"><b>Tambahkan “{query.trim()}”</b><small>tipe baru, tekan Enter</small></span>
            </div>
          ) : null}
          <div className="cbx-foot">
            {hasil.length > tampil.length
              ? `${tampil.length} dari ${hasil.length} — ketik lebih spesifik`
              : footNote || `${hasil.length} dari ${options.length} pilihan`}
          </div>
        </div>
      ) : null}
    </div>
  );
}
