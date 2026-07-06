"use client";
import { useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";

function waLink(waNumber, p) {
  const msg =
    `Halo, saya tertarik mengambil proyek freelance berikut:\n\n` +
    `• ID: ${p.id}\n• Platform: ${p.platform}\n• Subtes: ${p.subtes}\n` +
    `• Output: ${p.output}\n• Harga: ${rupiah(p.harga)}/soal\n` +
    `• Sisa kebutuhan: ${p.sisa} soal\n\nApakah masih tersedia?`;
  const base = waNumber ? `https://wa.me/${waNumber}` : `https://wa.me/`;
  return `${base}?text=${encodeURIComponent(msg)}`;
}

function tagClass(platform) {
  const p = (platform || "").toLowerCase();
  if (p.includes("asn")) return "asn";
  if (p.includes("bappenas")) return "bappenas";
  return "other";
}

export default function OpenBoard({ projects, waNumber }) {
  const [q, setQ] = useState("");
  const [plat, setPlat] = useState("Semua");
  const [sort, setSort] = useState("sisa");

  const platforms = useMemo(() => {
    const s = new Set(projects.map((p) => p.platform).filter(Boolean));
    return ["Semua", ...Array.from(s)];
  }, [projects]);

  const filtered = useMemo(() => {
    let list = projects.filter((p) => {
      const okPlat = plat === "Semua" || p.platform === plat;
      const okQ =
        !q ||
        `${p.subtes} ${p.id} ${p.output}`.toLowerCase().includes(q.toLowerCase());
      return okPlat && okQ;
    });
    list = [...list].sort((a, b) => {
      if (sort === "sisa") return b.sisa - a.sisa;
      if (sort === "harga") return b.harga - a.harga;
      return a.subtes.localeCompare(b.subtes);
    });
    return list;
  }, [projects, q, plat, sort]);

  const totalSisa = filtered.reduce((s, p) => s + p.sisa, 0);
  const potensi = filtered.reduce((s, p) => s + p.sisa * p.harga, 0);

  return (
    <>
      <div className="grid stat-grid" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <div className="label">Proyek Buka</div>
          <div className="value blue">{numberID(filtered.length)}</div>
          <div className="sub">subtes tersedia</div>
        </div>
        <div className="card stat">
          <div className="label">Total Soal Dibutuhkan</div>
          <div className="value navy">{numberID(totalSisa)}</div>
          <div className="sub">sisa kebutuhan</div>
        </div>
        <div className="card stat">
          <div className="label">Potensi Fee</div>
          <div className="value green">{rupiah(potensi)}</div>
          <div className="sub">bila semua diselesaikan</div>
        </div>
        <div className="card stat">
          <div className="label">Platform</div>
          <div className="value navy">{platforms.length - 1}</div>
          <div className="sub">jenis program</div>
        </div>
      </div>

      <div className="controls">
        <input
          className="input"
          placeholder="Cari subtes, ID, atau output…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="sisa">Urut: Sisa terbanyak</option>
          <option value="harga">Urut: Harga tertinggi</option>
          <option value="subtes">Urut: Nama subtes</option>
        </select>
      </div>
      <div className="chips" style={{ marginBottom: 18 }}>
        {platforms.map((p) => (
          <button
            key={p}
            className={"chip" + (plat === p ? " active" : "")}
            onClick={() => setPlat(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card empty">Tidak ada proyek yang cocok dengan filter.</div>
      ) : (
        <div className="grid proj-grid">
          {filtered.map((p) => (
            <div className="card proj" key={p.id}>
              <div className="proj-top">
                <span className={"tag " + tagClass(p.platform)}>{p.platform}</span>
                <span className="muted" style={{ fontSize: 12 }}>{p.id}</span>
              </div>
              <h3>{p.subtes}</h3>
              <div className="out">{p.output}</div>
              <div className="proj-meta">
                <div className="m">
                  <div className="k">Harga</div>
                  <div className="v harga">{rupiah(p.harga)}</div>
                </div>
                <div className="m">
                  <div className="k">Sisa</div>
                  <div className="v sisa">{numberID(p.sisa)} soal</div>
                </div>
                <div className="m">
                  <div className="k">Potensi</div>
                  <div className="v">{rupiah(p.sisa * p.harga)}</div>
                </div>
              </div>
              <a
                className="btn btn-wa"
                href={waLink(waNumber, p)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ambil via WhatsApp
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
