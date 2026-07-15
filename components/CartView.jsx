"use client";

import { useState } from "react";
import { rupiah, numberID } from "@/lib/format";

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdESBDdyAEaQfk7WllFk57qVb5_Kslm1zoi04wwL3OOLN1BJg/viewform";

// Catatan: ID Project sengaja tetap ikut di pesan WhatsApp (walau tidak
// ditampilkan di katalog). Ada beberapa submateri dengan NAMA SAMA pada proyek
// berbeda, jadi tanpa ID admin tidak bisa memastikan baris mana yang dicatat.
function buildWaMessage(cart, brand, nama, wa) {
  const lines = cart
    .map(
      (it, i) =>
        `${i + 1}. ${it.subtes} [${it.id}]\n   ${numberID(
          it.qty
        )} soal x ${rupiah(it.harga)} = ${rupiah(it.qty * it.harga)}`
    )
    .join("\n");
  const items = cart.length;
  const soal = cart.reduce((s, it) => s + it.qty, 0);
  const fee = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  let msg =
    `Halo kak, saya mau mengambil proyek soal berikut:\n\n` +
    `${lines}\n\n———\n` +
    `Total: ${items} submateri · ${numberID(soal)} soal\n` +
    `Total fee: ${rupiah(fee)}`;
  if (nama) msg += `\n\nNama: ${nama}`;
  if (wa) msg += `\nWA: ${wa}`;
  return msg;
}

export default function CartView({
  cart = [],
  onQty,
  onRemove,
  onClear,
  onBack,
  waNumber,
  brand = "Cerebrum",
}) {
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [showForm, setShowForm] = useState(false);

  const items = cart.length;
  const soal = cart.reduce((s, it) => s + it.qty, 0);
  const fee = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  const base = waNumber ? `https://wa.me/${waNumber}` : "https://wa.me/";
  const waHref = `${base}?text=${encodeURIComponent(
    buildWaMessage(cart, brand, nama, wa)
  )}`;
  const canCheckout = nama.trim() !== "" && wa.trim() !== "";

  if (items === 0) {
    return (
      <div className="card empty" style={{ marginTop: 10 }}>
        Keranjang masih kosong.
        <br />
        <br />
        <button className="btn btn-blue" onClick={onBack}>
          Pilih soal dulu
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Submateri</th>
              <th className="num">Harga/soal</th>
              <th style={{ textAlign: "center" }}>Jumlah</th>
              <th className="num">Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cart.map((it) => (
              <tr key={it.id}>
                <td>
                  <b>{it.subtes}</b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {it.output}
                  </div>
                </td>
                <td className="num">{rupiah(it.harga)}</td>
                <td>
                  <div
                    className="qrow"
                    style={{
                      border: "none",
                      padding: 0,
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <button
                      className="qbtn"
                      onClick={() => onQty(it.id, it.qty - 1)}
                      disabled={it.qty <= 1}
                    >
                      −
                    </button>
                    <span className="qval">{it.qty}</span>
                    <button
                      className="qbtn"
                      onClick={() => onQty(it.id, it.qty + 1)}
                      disabled={it.qty >= it.sisa}
                    >
                      +
                    </button>
                  </div>
                  <div
                    className="muted"
                    style={{ fontSize: 11, textAlign: "center", marginTop: 2 }}
                  >
                    maks {numberID(it.sisa)}
                  </div>
                </td>
                <td className="num">
                  <b>{rupiah(it.qty * it.harga)}</b>
                </td>
                <td>
                  <button
                    className="xbtn"
                    onClick={() => onRemove(it.id)}
                    title="Hapus"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div className="card card-p">
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>
            Data pengambil (wajib diisi)
          </h2>
          <input
            className="input"
            placeholder="Nama guru *"
            style={{ width: "100%", marginBottom: 10 }}
            value={nama}
            onChange={(e) => setNama(e.target.value)}
          />
          <input
            className="input"
            placeholder="Nomor WhatsApp kamu * (mis. 0812…)"
            style={{ width: "100%" }}
            value={wa}
            onChange={(e) => setWa(e.target.value)}
          />
          <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            Wajib diisi — ikut tercantum di pesan WhatsApp untuk konfirmasi.
          </div>
        </div>

        <div className="card card-p summary">
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Ringkasan Pesanan</h2>
          <div className="sum-row">
            <span>Jumlah submateri</span>
            <span>{items}</span>
          </div>
          <div className="sum-row">
            <span>Total soal</span>
            <span>{numberID(soal)} soal</span>
          </div>
          <div className="sum-total">
            <span>Total Fee</span>
            <span>{rupiah(fee)}</span>
          </div>
          <button
            className="btn btn-wa"
            style={{ width: "100%", marginTop: 14 }}
            onClick={() => setShowForm(true)}
            disabled={!canCheckout}
          >
            📩 Kirim Pesanan
          </button>
          {!canCheckout ? (
            <div
              className="muted"
              style={{
                color: "var(--red-600)",
                fontSize: 12.5,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Isi nama &amp; nomor WhatsApp dulu untuk mengirim.
            </div>
          ) : null}
          <button
            className="btn btn-ghost"
            style={{ width: "100%", marginTop: 8 }}
            onClick={onBack}
          >
            + Tambah soal lagi
          </button>
          <button className="btn-link" onClick={onClear}>
            Kosongkan keranjang
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>📋 Pendataan Guru Freelance</h2>
              <button
                className="icon-x"
                onClick={() => setShowForm(false)}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-sub">
                Sebelum mengirim pesanan, mohon isi form pendataan berikut agar
                kamu terdaftar di database kami, mendapat info proyek
                selanjutnya, dan dihubungi untuk pencairan fee.
              </p>
              <a
                className="btn btn-blue"
                style={{ width: "100%", marginBottom: 10 }}
                href={FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                📋 Isi Form Pendataan Guru
              </a>
              <a
                className="btn btn-wa"
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowForm(false)}
              >
                Lanjut kirim pesanan ke WhatsApp
              </a>
              <button className="btn-link" onClick={() => setShowForm(false)}>
                Nanti saja
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
