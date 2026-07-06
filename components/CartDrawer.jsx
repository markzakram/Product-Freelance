"use client";

import { rupiah, numberID } from "@/lib/format";

function buildWaMessage(cart, brand) {
  const lines = [];
  lines.push(`Halo ${brand}, saya ingin mengambil proyek freelance berikut:`);
  lines.push("");
  cart.forEach((it, i) => {
    lines.push(`${i + 1}. [${it.platform}] ${it.subtes}`);
    lines.push(
      `   ${numberID(it.qty)} soal × ${rupiah(it.harga)} = ${rupiah(
        it.qty * it.harga
      )}`
    );
  });
  const totalSoal = cart.reduce((s, it) => s + it.qty, 0);
  const totalFee = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  lines.push("");
  lines.push(
    `Total: ${numberID(totalSoal)} soal · Estimasi fee ${rupiah(totalFee)}`
  );
  lines.push("");
  lines.push("Mohon konfirmasi ketersediaannya. Terima kasih.");
  return lines.join("\n");
}

export default function CartDrawer({
  open,
  onClose,
  cart = [],
  onQty,
  onRemove,
  onClear,
  waNumber,
  brand = "Cerebrum",
}) {
  if (!open) return null;

  const totalSoal = cart.reduce((s, it) => s + it.qty, 0);
  const totalFee = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  const base = waNumber ? `https://wa.me/${waNumber}` : `https://wa.me/`;
  const waHref =
    cart.length > 0
      ? `${base}?text=${encodeURIComponent(buildWaMessage(cart, brand))}`
      : "#";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>🛒 Keranjang Saya</h2>
          <button className="icon-x" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {cart.length === 0 ? (
            <div className="drawer-empty">
              Keranjang masih kosong.
              <br />
              Pilih proyek dan tekan “Masukkan ke Keranjang”.
            </div>
          ) : (
            cart.map((it) => (
              <div className="cart-item" key={it.id}>
                <div className="ci-top">
                  <div>
                    <span className="tag other">{it.platform}</span>
                    <h4>{it.subtes}</h4>
                    <div className="ci-price">
                      {rupiah(it.harga)} / soal · sisa {numberID(it.sisa)}
                    </div>
                  </div>
                  <button
                    className="link-rm"
                    onClick={() => onRemove(it.id)}
                    aria-label="Hapus"
                  >
                    Hapus
                  </button>
                </div>
                <div className="ci-bottom">
                  <div className="stepper">
                    <button
                      onClick={() => onQty(it.id, it.qty - 1)}
                      disabled={it.qty <= 1}
                      aria-label="Kurangi"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={it.qty}
                      min={1}
                      max={it.sisa}
                      onChange={(e) => onQty(it.id, parseInt(e.target.value, 10))}
                    />
                    <button
                      onClick={() => onQty(it.id, it.qty + 1)}
                      disabled={it.qty >= it.sisa}
                      aria-label="Tambah"
                    >
                      +
                    </button>
                  </div>
                  <div className="ci-sub">{rupiah(it.qty * it.harga)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="drawer-foot">
          <div className="foot-line">
            <span>Total soal</span>
            <span>{numberID(totalSoal)} soal</span>
          </div>
          <div className="foot-line total">
            <span>Estimasi fee</span>
            <span>{rupiah(totalFee)}</span>
          </div>
          <div className="foot-actions">
            {cart.length > 0 ? (
              <button className="btn btn-ghost" onClick={onClear}>
                Kosongkan
              </button>
            ) : null}
            <a
              className="btn btn-wa"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (cart.length === 0) e.preventDefault();
              }}
              aria-disabled={cart.length === 0}
              style={cart.length === 0 ? { opacity: 0.5, pointerEvents: "none" } : null}
            >
              Kirim ke WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
