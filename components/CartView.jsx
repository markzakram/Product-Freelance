"use client";

import { useState } from "react";
import { rupiah, numberID } from "@/lib/format";
import Icon from "./Icon";
import { Dialog } from "./Drawer";
import { FORM_DAFTAR } from "@/lib/tautan";

// Catatan: ID Project sengaja tetap ikut di pesan WhatsApp (walau tidak
// ditampilkan di katalog). Ada beberapa submateri dengan NAMA SAMA pada proyek
// berbeda, jadi tanpa ID admin tidak bisa memastikan baris mana yang dicatat.
function buildWaMessage(cart, brand, nama, wa, email) {
  const lines = cart
    .map((it, i) => `${i + 1}. ${it.subtes} [${it.id}]\n   ${numberID(it.qty)} soal x ${rupiah(it.harga)} = ${rupiah(it.qty * it.harga)}`)
    .join("\n");
  const soal = cart.reduce((s, it) => s + it.qty, 0);
  const fee = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  let msg =
    `Halo kak, saya mau mengambil proyek soal berikut:\n\n` +
    `${lines}\n\n———\n` +
    `Total: ${cart.length} submateri · ${numberID(soal)} soal\n` +
    `Total fee: ${rupiah(fee)}`;
  if (nama) msg += `\n\nNama: ${nama}`;
  if (wa) msg += `\nWA: ${wa}`;
  if (email) msg += `\nEmail akun: ${email}`;
  return msg;
}

// `guru` = guru yang sedang login: nama & WA terisi dari Database guru, dan
// langkah "belum terdaftar? isi form" dilewati — ia jelas sudah terdaftar.
export default function CartView({ cart = [], onQty, onRemove, onClear, onBack, waNumber, brand = "Cerebrum", guru = null }) {
  const [nama, setNama] = useState(guru?.nama || "");
  const [wa, setWa] = useState(guru?.wa || "");
  const [showForm, setShowForm] = useState(false);

  const soal = cart.reduce((s, it) => s + it.qty, 0);
  const fee = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  const base = waNumber ? `https://wa.me/${waNumber}` : "https://wa.me/";
  const waHref = `${base}?text=${encodeURIComponent(buildWaMessage(cart, brand, nama, wa, guru?.email))}`;
  const lengkap = nama.trim() !== "" && wa.trim() !== "";

  return (
    <>
      <div className="section-head">
        <div>
          <button type="button" className="btn-link" onClick={onBack} style={{ paddingLeft: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="chevronLeft" />
            Kembali ke daftar proyek
          </button>
          <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800 }}>Periksa pengajuan</h1>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="card empty">
          Belum ada proyek yang diambil.
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-blue" onClick={onBack}>Pilih proyek</button>
          </div>
        </div>
      ) : (
        <div className="cart-grid">
          <div className="cart-list">
            {cart.map((it) => (
              <div key={it.id} className="cart-item">
                <div>
                  <b>{it.subtes}</b>
                  <span className="meta">
                    {it.output || "—"} · {rupiah(it.harga)}/soal · maks {numberID(it.sisa)}
                  </span>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => onQty(it.id, it.qty - 1)} disabled={it.qty <= 1} aria-label={`Kurangi ${it.subtes}`}>
                    <Icon name="minus" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={it.qty}
                    min={1}
                    max={it.sisa}
                    onChange={(e) => onQty(it.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Jumlah soal ${it.subtes}`}
                  />
                  <button type="button" onClick={() => onQty(it.id, it.qty + 1)} disabled={it.qty >= it.sisa} aria-label={`Tambah ${it.subtes}`}>
                    <Icon name="plus" />
                  </button>
                  <button type="button" className="ibtn danger" onClick={() => onRemove(it.id)} aria-label={`Hapus ${it.subtes}`}>
                    <Icon name="trash" />
                  </button>
                </div>
                <b className="subtotal">{rupiah(it.qty * it.harga)}</b>
              </div>
            ))}
          </div>

          <div className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ffield">
              <label htmlFor="c-nama">Nama lengkap</label>
              <input id="c-nama" className="input" value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" />
            </div>
            <div className="ffield">
              <label htmlFor="c-wa">Nomor WhatsApp</label>
              <input id="c-wa" className="input" inputMode="tel" placeholder="mis. 0812…" value={wa} onChange={(e) => setWa(e.target.value)} autoComplete="tel" />
              <small>Dipakai admin untuk konfirmasi dan pencairan fee.</small>
            </div>

            <div>
              <div className="sum-row"><span>Proyek</span><span>{cart.length}</span></div>
              <div className="sum-row"><span>Total soal</span><span>{numberID(soal)}</span></div>
              <div className="sum-total"><span>Total fee</span><span>{rupiah(fee)}</span></div>
            </div>

            {guru && lengkap ? (
              <a className="btn btn-wa block" href={waHref} target="_blank" rel="noopener noreferrer">
                <Icon name="send" />
                Kirim pengajuan lewat WhatsApp
              </a>
            ) : (
              <button type="button" className="btn btn-blue block" onClick={() => setShowForm(true)} disabled={!lengkap}>
                <Icon name="send" />
                Kirim pengajuan
              </button>
            )}
            {!lengkap ? <small className="muted" style={{ textAlign: "center" }}>Isi nama dan nomor WhatsApp dulu.</small> : null}
            <button type="button" className="btn-link" onClick={onClear}>Kosongkan pengajuan</button>
          </div>
        </div>
      )}

      {showForm ? (
        <Dialog title="Satu langkah lagi" onClose={() => setShowForm(false)}>
          <p className="modal-sub">
            Belum terdaftar? Isi form pendataan dulu supaya kamu masuk database guru, dapat info proyek berikutnya, dan
            bisa dihubungi untuk pencairan fee.
          </p>
          <a className="btn btn-ghost block" href={FORM_DAFTAR} target="_blank" rel="noopener noreferrer">
            <Icon name="file" />
            Isi form pendataan guru
          </a>
          <a className="btn btn-wa block" href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => setShowForm(false)}>
            <Icon name="send" />
            Kirim ke Admin lewat WhatsApp
          </a>
        </Dialog>
      ) : null}
    </>
  );
}
