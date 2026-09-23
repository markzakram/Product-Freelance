"use client";

// ============================================================================
//  Halaman guru (/open) — ponsel dulu.
//  Alur: pilih proyek -> tekan Ambil -> atur jumlah di kartu itu juga ->
//  Ajukan. Dulu ada langkah terpisah "Masukkan ke keranjang" per kartu;
//  sekarang jumlah yang diatur di kartu LANGSUNG jadi isi pengajuan.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import Brand from "./Brand";
import Icon from "./Icon";
import DataBanner from "./DataBanner";
import GuideModal from "./GuideModal";
import CartView from "./CartView";

const clamp = (n, min, max) => (Number.isNaN(n) ? min : Math.max(min, Math.min(max, n)));
const JENIS_URUT = ["Soal", "Liveclass", "Laporan FR", "Editor", "Lainnya"];

function ProjectCard({ p, qty, setQty }) {
  const input = useRef(null);
  const [baruDiambil, setBaruDiambil] = useState(false);
  const dipilih = qty > 0;
  const pct = p.kebutuhan > 0 ? Math.round((p.sisa / p.kebutuhan) * 100) : 100;
  const menipis = p.kebutuhan > 0 && p.sisa / p.kebutuhan < 0.25;
  const set = (v) => setQty(p, clamp(parseInt(v, 10), 0, p.sisa));

  // Tepat setelah "Ambil", fokus pindah ke jumlah dengan isi terpilih: guru
  // bisa langsung mengetik "25" tanpa menekan plus berkali-kali. Sengaja
  // BUKAN autoFocus — itu akan melompatkan halaman ke kartu terakhir setiap
  // kali guru kembali dari halaman pengajuan.
  useEffect(() => {
    if (dipilih && baruDiambil) {
      input.current?.focus();
      input.current?.select();
      setBaruDiambil(false);
    }
  }, [dipilih, baruDiambil]);

  return (
    <article className={"pcard" + (dipilih ? " on" : "")}>
      <div className="pcard-top">
        <div>
          <h3>{p.subtes}</h3>
          <span className="meta">
            {p.output || "—"}
            {p.jenis !== "Soal" ? <> · <span className="tag">{p.jenis}</span></> : null}
          </span>
        </div>
        <span className="price">
          {rupiah(p.harga)}
          <small>/soal</small>
        </span>
      </div>

      <div className="pcard-bottom">
        <div className="pcard-stock">
          <div className={"meter" + (menipis ? " warn" : "")}>
            <i style={{ width: pct + "%" }} />
          </div>
          <span className={menipis ? "low" : ""}>
            Sisa {numberID(p.sisa)}
            {p.kebutuhan > 0 ? ` dari ${numberID(p.kebutuhan)}` : ""} soal
          </span>
        </div>
        {!dipilih ? (
          <button type="button" className="take" onClick={() => { setBaruDiambil(true); set(1); }}>
            Ambil
          </button>
        ) : null}
      </div>

      {dipilih ? (
        <div className="pcard-pick">
          <div className="stepper">
            <button type="button" onClick={() => set(qty - 1)} aria-label={`Kurangi ${p.subtes}`}>
              <Icon name="minus" />
            </button>
            <input
              ref={input}
              type="number"
              inputMode="numeric"
              min={0}
              max={p.sisa}
              value={qty}
              onChange={(e) => set(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-label={`Jumlah soal ${p.subtes}`}
            />
            <button type="button" onClick={() => set(qty + 1)} disabled={qty >= p.sisa} aria-label={`Tambah ${p.subtes}`}>
              <Icon name="plus" />
            </button>
            <button type="button" className="btn btn-ghost xs" onClick={() => set(p.sisa)} disabled={qty >= p.sisa}>
              Maks
            </button>
          </div>
          <span className="sub">{rupiah(qty * p.harga)}</span>
        </div>
      ) : null}
    </article>
  );
}

export default function OpenBoard({ projects, source, bulan, waNumber, panduan = [], brand = "Cerebrum" }) {
  const [q, setQ] = useState("");
  const [jenis, setJenis] = useState("Semua");
  const [sort, setSort] = useState("sisa");
  const [qty, setQtyMap] = useState({}); // id -> jumlah soal
  const [view, setView] = useState("catalog"); // "catalog" | "cart"
  const [guideOpen, setGuideOpen] = useState(false);

  // Panduan muncul di setiap kunjungan — diminta supaya guru baru selalu membacanya.
  useEffect(() => setGuideOpen(true), []);

  const setQty = (p, n) => setQtyMap((m) => ({ ...m, [p.id]: clamp(n, 0, p.sisa) }));

  const cart = useMemo(
    () =>
      projects
        .filter((p) => (qty[p.id] || 0) > 0)
        .map((p) => ({ id: p.id, subtes: p.subtes, output: p.output, harga: p.harga, sisa: p.sisa, qty: qty[p.id] })),
    [projects, qty]
  );
  const soalCart = cart.reduce((s, it) => s + it.qty, 0);
  const feeCart = cart.reduce((s, it) => s + it.qty * it.harga, 0);

  const daftarJenis = useMemo(() => {
    const c = {};
    projects.forEach((p) => (c[p.jenis] = (c[p.jenis] || 0) + 1));
    return JENIS_URUT.filter((j) => c[j]).map((j) => ({ j, n: c[j] }));
  }, [projects]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return projects
      .filter((p) => p.sisa > 0)
      .filter((p) => jenis === "Semua" || p.jenis === jenis)
      .filter((p) => words.every((w) => `${p.subtes} ${p.output} ${p.jenis}`.toLowerCase().includes(w)))
      .sort((a, b) =>
        sort === "sisa" ? b.sisa - a.sisa : sort === "harga" ? b.harga - a.harga : a.subtes.localeCompare(b.subtes)
      );
  }, [projects, q, jenis, sort]);

  const totalSisa = projects.reduce((s, p) => s + p.sisa, 0);

  return (
    <div className="pub">
      <header className="pub-head">
        <div className="container">
          <Brand size={30} row />
          <button type="button" className="btn btn-ghost sm" onClick={() => setGuideOpen(true)}>
            <Icon name="book" />
            Panduan
          </button>
        </div>
      </header>

      <main className="pub-body">
        {source !== "live" ? <DataBanner source={source} /> : null}

        {view === "cart" ? (
          <CartView
            cart={cart}
            onQty={(id, n) => setQtyMap((m) => ({ ...m, [id]: clamp(n, 0, cart.find((c) => c.id === id)?.sisa || 0) }))}
            onRemove={(id) => setQtyMap((m) => ({ ...m, [id]: 0 }))}
            onClear={() => { setQtyMap({}); setView("catalog"); }}
            onBack={() => setView("catalog")}
            waNumber={waNumber}
            brand={brand}
          />
        ) : (
          <>
            <div className="pub-title">
              <h1>Proyek {bulan || "bulan ini"}</h1>
              <p>
                {numberID(totalSisa)} soal masih tersedia di {numberID(projects.length)} proyek. Pilih, atur jumlahnya, lalu
                ajukan ke Admin Akademik.
              </p>
            </div>

            <div className="pub-tools">
              <label className="search">
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="Cari mata pelajaran atau subtes"
                  aria-label="Cari proyek"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <select className="select sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
                <option value="sisa">Sisa terbanyak</option>
                <option value="harga">Harga tertinggi</option>
                <option value="nama">Nama A–Z</option>
              </select>
            </div>

            {daftarJenis.length > 1 ? (
              <div className="chips" role="group" aria-label="Jenis proyek">
                <button type="button" className={"chip" + (jenis === "Semua" ? " active" : "")} aria-pressed={jenis === "Semua"} onClick={() => setJenis("Semua")}>
                  Semua <span className="n">{projects.length}</span>
                </button>
                {daftarJenis.map(({ j, n }) => (
                  <button key={j} type="button" className={"chip" + (jenis === j ? " active" : "")} aria-pressed={jenis === j} onClick={() => setJenis(j)}>
                    {j} <span className="n">{n}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <div className="card empty">
                {projects.length ? "Tidak ada proyek yang cocok dengan pencarian." : "Belum ada proyek yang dibuka bulan ini."}
              </div>
            ) : (
              <div className="pcards">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} p={p} qty={qty[p.id] || 0} setQty={setQty} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {view === "catalog" && cart.length ? (
        <div className="cartbar" role="region" aria-label="Pengajuan">
          <div className="sum">
            <span>
              {cart.length} proyek · {numberID(soalCart)} soal
            </span>
            <b>{rupiah(feeCart)}</b>
          </div>
          <button type="button" className="btn" onClick={() => { setView("cart"); window.scrollTo(0, 0); }}>
            Ajukan
            <Icon name="chevronRight" />
          </button>
        </div>
      ) : null}

      <div className="footer">© {new Date().getFullYear()} Product Freelance · data diperbarui otomatis dari spreadsheet</div>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} items={panduan} />
    </div>
  );
}
