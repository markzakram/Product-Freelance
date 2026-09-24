"use client";

// ============================================================================
//  Pemilih subtes dari Master — dengan "slicer" seperti di Excel.
//  Dipakai di Katalog bulan ini (Tambah proyek) dan Proyek bulan baru.
//
//  - Slicer Jenis / Kategori / Platform; angka di tiap chip dihitung terhadap
//    slicer LAIN yang sedang aktif (perilaku slicer), jadi chip yang tidak
//    akan menghasilkan apa-apa ikut hilang dan admin tidak buntu.
//  - Hasil selalu tampil sebagai daftar (bukan dropdown tersembunyi), supaya
//    admin bisa membandingkan nama yang mirip sebelum memilih.
//  - "Termasuk arsip": sejak master dirapikan (v1.1.0), subtes bulan-bulan
//    lalu diarsipkan. Memilihnya tetap boleh; subtes itu diaktifkan kembali
//    saat disimpan (lihat aktifkanKembali).
// ============================================================================

import { useMemo, useState } from "react";
import { rupiah, numberID, parseHarga, formatHarga } from "@/lib/format";
import { JENIS } from "@/lib/jenis";
import Icon from "./Icon";

const SEMUA = "__semua";
const TANPA = "(tanpa kategori)";
const lower = (s) => String(s ?? "").toLowerCase();
const platformsOf = (m) => String(m.platform || "").split(",").map((s) => s.trim()).filter(Boolean);
const HARGA = [
  ["Lengkap", "hargaLengkap"],
  ["Video", "hargaVideo"],
  ["Soal & Pemb.", "hargaSoal"],
  ["Liveclass", "hargaLive"],
];

function ringkasHarga(m) {
  for (const [label, k] of HARGA) {
    const h = parseHarga(m[k]);
    if (h.ada) return `${label} ${h.tentatif ? formatHarga(m[k], { pendek: true }) : rupiah(h.min)}`;
  }
  return "harga belum diisi";
}

function Sorot({ text, words }) {
  const s = String(text ?? "");
  const w = words.find((x) => lower(s).includes(x));
  if (!w) return s;
  const i = lower(s).indexOf(w);
  return (
    <>
      {s.slice(0, i)}
      <mark>{s.slice(i, i + w.length)}</mark>
      {s.slice(i + w.length)}
    </>
  );
}

/** Aktifkan kembali subtes arsip yang dipilih — dipanggil sebelum menyimpan. */
export async function aktifkanKembali(rows) {
  for (const r of rows.filter((x) => x && x.status === "Arsip")) {
    const res = await fetch("/api/admin/master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", row: r.row, status: "Aktif" }),
      cache: "no-store",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(`Gagal mengaktifkan kembali ${r.id}: ${j.error || "HTTP " + res.status}`);
    }
  }
}

export default function MasterPicker({ master, onPick, dipilih = [], autoFocus = false }) {
  const [q, setQ] = useState("");
  const [jenis, setJenis] = useState(SEMUA);
  const [kategori, setKategori] = useState(SEMUA);
  const [platform, setPlatform] = useState(SEMUA);
  const [arsip, setArsip] = useState(false);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const nArsip = master.filter((m) => m.status === "Arsip").length;

  // Satu fungsi saring; `kecuali` dipakai untuk menghitung chip sebuah slicer
  // terhadap slicer LAIN saja.
  const saring = (kecuali) =>
    master.filter((m) => {
      if (!arsip && m.status === "Arsip") return false;
      if (kecuali !== "jenis" && jenis !== SEMUA && m.jenis !== jenis) return false;
      if (kecuali !== "kategori" && kategori !== SEMUA && (m.kategori || TANPA) !== kategori) return false;
      if (kecuali !== "platform" && platform !== SEMUA && !platformsOf(m).includes(platform)) return false;
      const hay = lower(`${m.id} ${m.subtes} ${m.kategori} ${m.platform} ${m.jenis} ${m.idLama}`);
      return words.every((w) => hay.includes(w));
    });

  const hasil = useMemo(
    () => saring().sort((a, b) => (a.status === "Arsip") - (b.status === "Arsip") || a.subtes.localeCompare(b.subtes)),
    [master, q, jenis, kategori, platform, arsip] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hitung = (key) => {
    const c = {};
    saring(key).forEach((m) => {
      const vals = key === "platform" ? platformsOf(m) : [key === "jenis" ? m.jenis : m.kategori || TANPA];
      vals.forEach((v) => (c[v] = (c[v] || 0) + 1));
    });
    return c;
  };
  const cJenis = hitung("jenis");
  const cKat = hitung("kategori");
  const cPlat = hitung("platform");
  const urut = (c) => Object.keys(c).sort((a, b) => (a === TANPA) - (b === TANPA) || c[b] - c[a] || a.localeCompare(b));

  const aktif = [jenis, kategori, platform].filter((x) => x !== SEMUA).length + (q.trim() ? 1 : 0);
  const reset = () => {
    setQ("");
    setJenis(SEMUA);
    setKategori(SEMUA);
    setPlatform(SEMUA);
  };

  const baris = (label, nilai, set, daftar, hitungan) => (
    <div className="mpick-row">
      <span className="mpick-lbl">{label}</span>
      <div className="chips" role="group" aria-label={`Saring ${label.toLowerCase()}`}>
        <button type="button" className={"chip sm" + (nilai === SEMUA ? " active" : "")} aria-pressed={nilai === SEMUA} onClick={() => set(SEMUA)}>
          Semua
        </button>
        {daftar
          .filter((v) => hitungan[v] || v === nilai)
          .map((v) => (
            <button key={v} type="button" className={"chip sm" + (nilai === v ? " active" : "")} aria-pressed={nilai === v} onClick={() => set(nilai === v ? SEMUA : v)}>
              {v} <span className="n">{numberID(hitungan[v] || 0)}</span>
            </button>
          ))}
      </div>
    </div>
  );

  return (
    <div className="mpick">
      <div className="mpick-top">
        <label className="search sm" style={{ flex: 1 }}>
          <Icon name="search" />
          <input
            type="search"
            placeholder="Cari nama, ID, kategori"
            aria-label="Cari subtes di master"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus={autoFocus}
          />
        </label>
        {nArsip ? (
          <label className="mpick-arsip">
            <input type="checkbox" checked={arsip} onChange={(e) => setArsip(e.target.checked)} />
            Termasuk arsip <span className="muted">({numberID(nArsip)})</span>
          </label>
        ) : null}
      </div>

      {baris("Jenis", jenis, setJenis, JENIS.map((j) => j.nama), cJenis)}
      {urut(cKat).length > 1 || kategori !== SEMUA ? baris("Kategori", kategori, setKategori, urut(cKat), cKat) : null}
      {urut(cPlat).length > 1 || platform !== SEMUA ? baris("Platform", platform, setPlatform, urut(cPlat), cPlat) : null}

      <div className="mpick-count">
        <span>
          {numberID(hasil.length)} subtes{arsip ? "" : " aktif"}
        </span>
        {aktif ? (
          <button type="button" className="btn-link" onClick={reset}>
            Hapus filter
          </button>
        ) : null}
      </div>

      <div className="mpick-list" role="listbox" aria-label="Hasil subtes">
        {hasil.length === 0 ? (
          <div className="cbx-empty">
            Tidak ada subtes yang cocok.{" "}
            {!arsip && nArsip ? "Coba centang “Termasuk arsip”, atau tambahkan lewat Master subtes." : "Tambahkan dulu lewat Master subtes."}
          </div>
        ) : (
          hasil.map((m) => {
            const sudah = dipilih.includes(m.id);
            return (
              <button key={m.id} type="button" role="option" aria-selected={false} className={"mpick-item" + (m.status === "Arsip" ? " arsip" : "")} onClick={() => onPick(m)}>
                <span className="cbx-code">
                  <Sorot text={m.id} words={words} />
                </span>
                <span className="cbx-main">
                  <b>
                    <Sorot text={m.subtes} words={words} />
                  </b>
                  <small>
                    {m.jenis} · {m.kategori || "tanpa kategori"} · {m.platform || "—"}
                  </small>
                </span>
                <span className="mpick-side">
                  {m.status === "Arsip" ? <span className="pill batal" style={{ textDecoration: "none" }}>Arsip</span> : null}
                  {sudah ? <span className="pill run">sudah ditambahkan</span> : null}
                  <small>{ringkasHarga(m)}</small>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
