"use client";
import { useEffect, useMemo, useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import GuideModal from "@/components/GuideModal";
import CartDrawer from "@/components/CartDrawer";

function tagClass(platform) {
  const p = (platform || "").toLowerCase();
  if (p.includes("asn")) return "asn";
  if (p.includes("bappenas")) return "bappenas";
  return "other";
}

function clamp(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ---- one project card with its own quantity stepper ----------------------
function ProjectCard({ p, inCartQty, onAdd }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const setSafe = (v) => setQty(clamp(parseInt(v, 10), 1, p.sisa || 1));

  const handleAdd = () => {
    onAdd(p, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <div className="card proj">
      <div className="proj-top">
        <span className={"tag " + tagClass(p.platform)}>{p.platform}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {p.id}
        </span>
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
      </div>

      {inCartQty > 0 ? (
        <div className="incart-hint">
          Di keranjang: {numberID(inCartQty)} soal
        </div>
      ) : null}

      <div className="qty-row">
        <div className="stepper">
          <button
            onClick={() => setSafe(qty - 1)}
            disabled={qty <= 1}
            aria-label="Kurangi"
          >
            −
          </button>
          <input
            type="number"
            value={qty}
            min={1}
            max={p.sisa}
            onChange={(e) => setSafe(e.target.value)}
          />
          <button
            onClick={() => setSafe(qty + 1)}
            disabled={qty >= p.sisa}
            aria-label="Tambah"
          >
            +
          </button>
        </div>
        <div className="subtotal">
          <span className="k">Subtotal</span>
          <span className="v">{rupiah(qty * p.harga)}</span>
        </div>
      </div>

      <button
        className={"btn btn-blue btn-add" + (added ? " done" : "")}
        onClick={handleAdd}
      >
        {added ? "✓ Ditambahkan" : "＋ Masukkan ke Keranjang"}
      </button>
    </div>
  );
}

export default function OpenBoard({ projects, waNumber, panduan = [], brand = "Cerebrum" }) {
  const [q, setQ] = useState("");
  const [plat, setPlat] = useState("Semua");
  const [sort, setSort] = useState("sisa");

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Auto-show the guide once per browser (first visit).
  useEffect(() => {
    try {
      if (!localStorage.getItem("gf_guide_seen")) {
        setGuideOpen(true);
        localStorage.setItem("gf_guide_seen", "1");
      }
    } catch (_) {
      /* localStorage unavailable — skip auto popup */
    }
  }, []);

  const addToCart = (p, qty) => {
    setCart((prev) => {
      const found = prev.find((it) => it.id === p.id);
      if (found) {
        return prev.map((it) =>
          it.id === p.id
            ? { ...it, qty: clamp(it.qty + qty, 1, p.sisa) }
            : it
        );
      }
      return [
        ...prev,
        {
          id: p.id,
          platform: p.platform,
          subtes: p.subtes,
          output: p.output,
          harga: p.harga,
          sisa: p.sisa,
          qty: clamp(qty, 1, p.sisa),
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
  const clearCart = () => setCart([]);

  const cartQtyById = useMemo(() => {
    const m = {};
    cart.forEach((it) => (m[it.id] = it.qty));
    return m;
  }, [cart]);

  const totalSoalCart = cart.reduce((s, it) => s + it.qty, 0);

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
          <div className="label">Di Keranjang</div>
          <div className="value amber">{numberID(cart.length)}</div>
          <div className="sub">{numberID(totalSoalCart)} soal dipilih</div>
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
        <button
          className="btn btn-ghost guide-btn"
          onClick={() => setGuideOpen(true)}
        >
          📘 Tata Cara
        </button>
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
            <ProjectCard
              key={p.id}
              p={p}
              inCartQty={cartQtyById[p.id] || 0}
              onAdd={addToCart}
            />
          ))}
        </div>
      )}

      {cart.length > 0 ? (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          🛒 Keranjang
          <span className="fab-badge">{cart.length}</span>
        </button>
      ) : null}

      <GuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        items={panduan}
      />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onQty={updateQty}
        onRemove={removeItem}
        onClear={clearCart}
        waNumber={waNumber}
        brand={brand}
      />
    </>
  );
}
