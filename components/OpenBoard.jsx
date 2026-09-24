"use client";

// ============================================================================
//  Halaman guru (/open) — gaya mengikuti Product Task Tracker (Inter, abu-abu
//  netral, kartu bergaris tipis, KPI berikon), dengan tombol terang/gelap.
//  Alur: pilih proyek -> "Ambil" -> atur jumlah di kartu itu juga -> Ajukan.
//  Jumlah yang diatur di kartu LANGSUNG jadi isi pengajuan; tidak ada langkah
//  "masukkan ke keranjang" terpisah.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah, numberID } from "@/lib/format";
import Brand from "./Brand";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import DataBanner from "./DataBanner";
import GuideModal from "./GuideModal";
import CartView from "./CartView";
import PasangApp from "./PasangApp";

const clamp = (n, min, max) => (Number.isNaN(n) ? min : Math.max(min, Math.min(max, n)));
const JENIS_URUT = ["Soal", "Liveclass", "Laporan FR", "Editor", "Lainnya"];
const SEMUA = "Semua";

function ProjectCard({ p, qty, setQty }) {
  const input = useRef(null);
  const [baruDiambil, setBaruDiambil] = useState(false);
  const dipilih = qty > 0;
  const pct = p.kebutuhan > 0 ? Math.round((p.sisa / p.kebutuhan) * 100) : 100;
  const menipis = p.kebutuhan > 0 && p.sisa / p.kebutuhan < 0.25;
  const set = (v) => setQty(p, clamp(parseInt(v, 10), 0, p.sisa));

  // Tepat setelah "Ambil", fokus pindah ke jumlah dengan isi terpilih: guru
  // bisa langsung mengetik "25". Sengaja bukan autoFocus — itu akan
  // melompatkan halaman ke kartu terakhir tiap kembali dari halaman pengajuan.
  useEffect(() => {
    if (dipilih && baruDiambil) {
      input.current?.focus();
      input.current?.select();
      setBaruDiambil(false);
    }
  }, [dipilih, baruDiambil]);

  return (
    <article className={"pc" + (dipilih ? " on" : "")}>
      <div className="pc-top">
        <div className="pc-chips">
          <span className="mini brand">{p.jenis}</span>
          {p.output ? <span className="mini">{p.output}</span> : null}
        </div>
        {menipis ? <span className="flag">HAMPIR HABIS</span> : null}
      </div>

      <h3>{p.subtes}</h3>

      <div className="pc-price">
        <b>{rupiah(p.harga)}</b>
        <span>/soal</span>
      </div>

      <div className="pc-stock">
        <div className={"meter" + (menipis ? " warn" : "")} aria-hidden="true">
          <i style={{ width: pct + "%" }} />
        </div>
        <div className="row">
          <span>Sisa kuota</span>
          <b className={menipis ? "low" : ""}>
            {numberID(p.sisa)}
            {p.kebutuhan > 0 ? ` / ${numberID(p.kebutuhan)}` : ""} soal
          </b>
        </div>
      </div>

      <div className="pc-foot">
        {!dipilih ? (
          <>
            <span className="muted">Belum diambil</span>
            <button
              type="button"
              className="take"
              onClick={() => {
                setBaruDiambil(true);
                set(1);
              }}
            >
              <Icon name="plus" stroke={2.2} />
              Ambil
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </article>
  );
}

export default function OpenBoard({ projects, source, bulan, waNumber, panduan = [], brand = "Cerebrum" }) {
  const [q, setQ] = useState("");
  const [jenis, setJenis] = useState(SEMUA);
  const [output, setOutput] = useState(SEMUA);
  const [sort, setSort] = useState("sisa");
  const [qty, setQtyMap] = useState({}); // id -> jumlah soal
  const [view, setView] = useState("catalog"); // "catalog" | "cart"
  const [guideOpen, setGuideOpen] = useState(false);

  // Panduan muncul di setiap kunjungan — supaya guru baru selalu membacanya.
  useEffect(() => setGuideOpen(true), []);

  // Aplikasi terpasang di HP tidak dimuat ulang saat dibuka lagi — ia
  // melanjutkan tampilan terakhir, bisa berjam-jam lalu. Setelah >1 menit di
  // latar belakang, sisa kuota diambil ulang dari spreadsheet (pilihan guru
  // tetap tersimpan).
  const router = useRouter();
  useEffect(() => {
    let sejak = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") sejak = Date.now();
      else if (sejak && Date.now() - sejak > 60000) router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  const setQty = (p, n) => setQtyMap((m) => ({ ...m, [p.id]: clamp(n, 0, p.sisa) }));

  const cart = useMemo(
    () =>
      projects
        .filter((p) => (qty[p.id] || 0) > 0)
        .map((p) => ({ id: p.id, subtes: p.subtes, output: p.output, harga: p.harga, sisa: p.sisa, qty: Math.min(qty[p.id], p.sisa) })),
    [projects, qty]
  );
  const soalCart = cart.reduce((s, it) => s + it.qty, 0);
  const feeCart = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  const totalSisa = projects.reduce((s, p) => s + p.sisa, 0);

  const hitung = (key, urut) => {
    const c = {};
    projects.forEach((p) => {
      const k = p[key] || "Lainnya";
      c[k] = (c[k] || 0) + 1;
    });
    const keys = urut ? urut.filter((k) => c[k]) : Object.keys(c).sort((a, b) => c[b] - c[a]);
    return keys.map((k) => ({ k, n: c[k] }));
  };
  const daftarJenis = useMemo(() => hitung("jenis", JENIS_URUT), [projects]); // eslint-disable-line react-hooks/exhaustive-deps
  const daftarOutput = useMemo(() => hitung("output"), [projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return projects
      .filter((p) => p.sisa > 0)
      .filter((p) => jenis === SEMUA || p.jenis === jenis)
      .filter((p) => output === SEMUA || (p.output || "Lainnya") === output)
      .filter((p) => words.every((w) => `${p.subtes} ${p.output} ${p.jenis}`.toLowerCase().includes(w)))
      .sort((a, b) =>
        sort === "sisa" ? b.sisa - a.sisa : sort === "harga" ? b.harga - a.harga : a.subtes.localeCompare(b.subtes)
      );
  }, [projects, q, jenis, output, sort]);

  const keCart = () => {
    setView("cart");
    window.scrollTo(0, 0);
  };

  const chip = (aktif, label, n, onClick) => (
    <button key={label} type="button" className={"chip" + (aktif ? " active" : "")} aria-pressed={aktif} onClick={onClick}>
      {label} <span className="n">{n}</span>
    </button>
  );

  return (
    <div className={"pub" + (cart.length && view === "catalog" ? " ada-pilihan" : "")}>
      <header className="pub-head">
        <div className="in">
          <Brand size={30} row />
          <div className="pub-actions">
            <PasangApp className="btn btn-ghost" labelClass="lbl" label="Pasang" nama="Proyek Guru" />
            <button type="button" className="btn btn-ghost" onClick={() => setGuideOpen(true)}>
              <Icon name="book" />
              <span className="lbl">Panduan</span>
            </button>
            <ThemeToggle className="sq" />
            {cart.length && view === "catalog" ? (
              <button type="button" className="btn btn-blue ke-pengajuan" onClick={keCart}>
                <Icon name="bag" />
                <span className="lbl">Pengajuan</span>
                <span className="badge">{cart.length}</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="pub-body">
        {source !== "live" ? <DataBanner source={source} /> : null}
        {view === "catalog" ? <PasangApp variant="banner" nama="Proyek Guru" ikon="/icons/guru-192.png" /> : null}

        {view === "cart" ? (
          <CartView
            cart={cart}
            onQty={(id, n) => setQtyMap((m) => ({ ...m, [id]: clamp(n, 0, cart.find((c) => c.id === id)?.sisa || 0) }))}
            onRemove={(id) => setQtyMap((m) => ({ ...m, [id]: 0 }))}
            onClear={() => {
              setQtyMap({});
              setView("catalog");
            }}
            onBack={() => setView("catalog")}
            waNumber={waNumber}
            brand={brand}
          />
        ) : (
          <>
            <div className="pub-title">
              <span className="pub-ico">
                <Icon name="layers" size={20} />
              </span>
              <div>
                <h1>Proyek {bulan || "bulan ini"}</h1>
                <p>Pilih proyek, atur jumlah soalnya, lalu ajukan ke Admin Akademik.</p>
              </div>
            </div>

            <div className="kpis">
              <div className="kpi">
                <span className="kpi-ico i1">
                  <Icon name="layers" size={18} />
                </span>
                <b>{numberID(totalSisa)}</b>
                <span>soal masih tersedia</span>
              </div>
              <div className="kpi">
                <span className="kpi-ico i2">
                  <Icon name="check" size={18} stroke={2.2} />
                </span>
                <b>{numberID(projects.length)}</b>
                <span>proyek dibuka</span>
              </div>
              <div className="kpi">
                <span className="kpi-ico i3">
                  <Icon name="bag" size={18} />
                </span>
                <b>{rupiah(feeCart)}</b>
                <span>{cart.length ? `${numberID(soalCart)} soal di pengajuanmu` : "belum ada yang diambil"}</span>
              </div>
            </div>

            <div className="toolbar">
              <label className="search">
                <Icon name="search" />
                <input type="search" placeholder="Cari mata pelajaran atau subtes" aria-label="Cari proyek" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
                <option value="sisa">Sisa terbanyak</option>
                <option value="harga">Harga tertinggi</option>
                <option value="nama">Nama A–Z</option>
              </select>
              {daftarOutput.length > 1 || daftarJenis.length > 1 ? <span className="sep" aria-hidden="true" /> : null}
              {daftarOutput.length > 1 ? (
                <div className="chips" role="group" aria-label="Saring output">
                  {chip(output === SEMUA, "Semua", projects.length, () => setOutput(SEMUA))}
                  {daftarOutput.map(({ k, n }) => chip(output === k, k, n, () => setOutput(k)))}
                </div>
              ) : null}
              {daftarJenis.length > 1 ? (
                <div className="chips" role="group" aria-label="Saring jenis">
                  {daftarJenis.map(({ k, n }) => chip(jenis === k, k, n, () => setJenis(jenis === k ? SEMUA : k)))}
                </div>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <div className="card empty">
                {projects.length ? "Tidak ada proyek yang cocok dengan pencarian." : "Belum ada proyek yang dibuka bulan ini."}
              </div>
            ) : (
              <>
                <div className="eyebrow">{numberID(filtered.length)} proyek</div>
                <div className="pcards">
                  {filtered.map((p) => (
                    <ProjectCard key={p.id} p={p} qty={qty[p.id] || 0} setQty={setQty} />
                  ))}
                </div>
              </>
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
          <button type="button" className="btn btn-blue" onClick={keCart}>
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
