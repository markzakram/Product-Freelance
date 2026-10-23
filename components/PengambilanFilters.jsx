"use client";

import Icon from "./Icon";
import SearchableFilter from "./SearchableFilter";

export default function PengambilanFilters({ cari, setCari, status, setStatus, options, statusCounts, tahap, setTahap, tahapCounts, subtes, setSubtes, opsiSubtes, guru, setGuru, opsiGuru, fokusAktif, onReset }) {
  const reset = () => { setCari(""); setStatus("semua"); setTahap("semua"); setSubtes(""); setGuru(""); onReset?.(); };
  return (
    <div className="pg-filter-panel">
      <div className="pg-filter-toolbar">
        <label className="pg-search-field"><Icon name="search" /><input aria-label="Cari guru, subtes, atau ID proyek" type="search" placeholder="Cari guru, subtes, atau ID proyek…" value={cari} onChange={(e) => setCari(e.target.value)} />{cari ? <button type="button" className="pg-clear-search" aria-label="Hapus pencarian" onClick={() => setCari("")}><Icon name="x" size={14} /></button> : null}</label>
        <SearchableFilter label="Status" icon="filter" value={status} onChange={setStatus} options={options.map(([value, label]) => ({ value, label, count: statusCounts[value] || 0 }))} />
      </div>
      <div className="pg-entity-filters">
        <SearchableFilter label="Subtes" icon="layers" value={subtes} onChange={setSubtes} options={opsiSubtes} placeholder="Cari nama subtes atau ID proyek…" />
        <SearchableFilter label="Guru" icon="users" value={guru} onChange={setGuru} options={opsiGuru} placeholder="Cari nama guru, ID, atau email…" />
      </div>
      <div className="pg-slicer-row">
        <span className="pg-slicer-label"><Icon name="layers" size={14} />Tahap aktif</span>
        <div className="pg-slicer" role="group" aria-label="Filter tahap aktif">{["semua", 30, 50, 100].map((n) => <button type="button" key={n} aria-pressed={tahap === String(n)} onClick={() => setTahap(String(n))}><span>{n === "semua" ? "Semua" : `${n}%`}</span><span className="pg-slicer-count">{tahapCounts[n] || 0}</span></button>)}</div>
        {cari || status !== "semua" || tahap !== "semua" || subtes || guru || fokusAktif ? <button type="button" className="pg-reset-filters" onClick={reset}><Icon name="restore" size={14} />Reset filter</button> : null}
      </div>
    </div>
  );
}
