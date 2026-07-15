"use client";
import { useEffect, useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import DataBanner from "@/components/DataBanner";
import GuideModal from "@/components/GuideModal";
import CartView from "@/components/CartView";

function clamp(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ---- one catalog card with its own quantity row + live fee ----------------
// "Stok soal" = kolom Sisa di spreadsheet (Kebutuhan - yang sudah diambil),
// bukan Kebutuhan. Kalau Sisa <= 0 kartu ini tidak bisa dipesan sama sekali.
function ProjectCard({ p, inCartQty, onAdd }) {
  const [qty, setQty] = useState(0);
  const habis = (p.sisa || 0) <= 0;
  const setSafe = (v) => setQty(clamp(parseInt(v, 10), 0, p.sisa || 0));
  const inCart = inCartQty > 0;
  const canAdd = qty > 0 && !habis;

  return (
    <div className={"card proj" + (habis ? " habis" : "")}>
      <h3>{p.subtes}</h3>
      <div className="out">{p.output}</div>
      <div className="proj-meta">
        <div className="m">
          <div className="k">Harga</div>
          <div className="v harga">{rupiah(p.harga)}</div>
        </div>
        <div className="m">
          <div className="k">Stok soal</div>
          <div className="v sisa">{numberID(p.sisa)}</div>
        </div>
      </div>

      <div className="qrow">
        <span className="qlbl">Jumlah</span>
        <button
          className="qbtn"
          onClick={() => setSafe(qty - 1)}
          disabled={habis || qty <= 0}
          aria-label="Kurangi"
        >
          −
        </button>
        <input
          className="qval qinp"
          type="number"
          min={0}
          max={p.sisa}
          value={qty}
          onChange={(e) => setSafe(e.target.value)}
          onFocus={(e) => e.target.select()}
          disabled={habis}
          aria-label="Jumlah soal"
        />
        <button
          className="qbtn"
          onClick={() => setSafe(qty + 1)}
          disabled={habis || qty >= p.sisa}
          aria-label="Tambah"
        >
          +
        </button>
        <button
          className="qbtn qmax"
          onClick={() => setSafe(p.sisa)}
          disabled={habis || qty >= p.sisa}
          title="Ambil semua stok (maks)"
        >
          Max
        </button>
        <span className="qfee">
          = <b>{rupiah(qty * p.harga)}</b>
        </span>
      </div>

      <button
        className={"btn btn-blue add-btn" + (inCart ? " in-cart" : "")}
        onClick={() => onAdd(p, qty)}
        disabled={!canAdd}
      >
        {habis
          ? "Stok habis"
          : inCart
          ? `✓ Di keranjang (${numberID(inCartQty)})`
          : "＋ Masukkan ke Keranjang"}
      </button>
    </div>
  );
}

export default function OpenBoard({
  projects,
  source,
  waNumber,
  panduan = [],
  brand = "Cerebrum",
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("sisa");

  const [cart, setCart] = useState([]);
  const [view, setView] = useState("catalog"); // "catalog" | "cart"
  const [guideOpen, setGuideOpen] = useState(false);

  // Show the guide popup on every visit to this page.
  useEffect(() => {
    setGuideOpen(true);
  }, []);

  // Adding sets the cart quantity to the card's chosen amount (replace).
  const addToCart = (p, qty) => {
    if (qty <= 0 || (p.sisa || 0) <= 0) return;
    setCart((prev) => {
      const nq = clamp(qty, 1, p.sisa);
      const found = prev.find((it) => it.id === p.id);
      if (found) {
        return prev.map((it) => (it.id === p.id ? { ...it, qty: nq } : it));
      }
      return [
        ...prev,
        {
          id: p.id,
          subtes: p.subtes,
          output: p.output,
          harga: p.harga,
          sisa: p.sisa,
          qty: nq,
        },
      ];
    });
  };

  const updateQty = (id, qty) =>
    setCart((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, qty: clamp(qty, 0, it.sisa) } : it))
        .filter((it) => it.qty > 0)
    );

  const removeItem = (id) => setCart((prev) => prev.filter((it) => it.id !== id));
  const clearCart = () => {
    setCart([]);
    setView("catalog");
  };

  const cartQtyById = useMemo(() => {
    const m = {};
    cart.forEach((it) => (m[it.id] = it.qty));
    return m;
  }, [cart]);

  const feeCart = cart.reduce((s, it) => s + it.qty * it.harga, 0);

  const filtered = useMemo(() => {
    // Hanya yang stoknya masih ada. Pengaman lapis kedua: halaman sudah
    // menyaring sisa > 0, tapi katalog tidak boleh pernah menawarkan stok habis.
    let list = projects.filter((p) => {
      if ((p.sisa || 0) <= 0) return false;
      return !q || `${p.subtes} ${p.output}`.toLowerCase().includes(q.toLowerCase());
    });
    list = [...list].sort((a, b) => {
      if (sort === "sisa") return b.sisa - a.sisa;
      if (sort === "harga") return b.harga - a.harga;
      return a.subtes.localeCompare(b.subtes);
    });
    return list;
  }, [projects, q, sort]);

  const totalSisa = filtered.reduce((s, p) => s + p.sisa, 0);

  return (
    <>
      {view === "catalog" ? (
        <div className="hero">
          <div className="container">
            <h1>Open Freelance — Proyek Bulan Ini</h1>
            <p>
              Pilih submateri, tentukan jumlah soal yang mau kamu ambil,
              masukkan ke keranjang, lalu kirim pesananmu ke Admin Akademik via
              WhatsApp.
            </p>
          </div>
        </div>
      ) : (
        <div className="hero" style={{ padding: "30px 0" }}>
          <div className="container">
            <h1>🛒 Keranjang Soal</h1>
            <p>
              Periksa daftar soal yang mau kamu ambil. Ubah jumlah bila perlu,
              lalu kirim pesananmu ke Admin Akademik via WhatsApp.
            </p>
          </div>
        </div>
      )}

      <div className="container section">
        {view === "cart" ? (
          <CartView
            cart={cart}
            onQty={updateQty}
            onRemove={removeItem}
            onClear={clearCart}
            onBack={() => setView("catalog")}
            waNumber={waNumber}
            brand={brand}
          />
        ) : (
          <>
            <DataBanner source={source} />

            <div className="grid stat-grid" style={{ marginBottom: 20 }}>
              <div className="card stat">
                <div className="label">Proyek Buka</div>
                <div className="value blue">{numberID(filtered.length)}</div>
                <div className="sub">subtes tersedia</div>
              </div>
              <div className="card stat">
                <div className="label">Total Soal Tersedia</div>
                <div className="value navy">{numberID(totalSisa)}</div>
                <div className="sub">sisa yang belum diambil</div>
              </div>
            </div>

            <div className="controls">
              <input
                className="input"
                placeholder="Cari submateri atau output…"
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
              <button
                className="btn btn-ghost"
                onClick={() => setGuideOpen(true)}
              >
                📘 Tata Cara
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setView("cart")}
              >
                🛒 Keranjang ({cart.length})
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="card empty">
                Tidak ada proyek yang cocok dengan pencarian.
              </div>
            ) : (
              <div className="grid proj-grid">
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    p={p}
                    inCartQty={cartQtyById[p.id] || 0}
                    onAdd={addToCart}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {view === "catalog" && cart.length > 0 ? (
        <button className="cart-fab" onClick={() => setView("cart")}>
          🛒 Keranjang ({cart.length}) · {rupiah(feeCart)}
        </button>
      ) : null}

      <GuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        items={panduan}
      />
    </>
  );
}
