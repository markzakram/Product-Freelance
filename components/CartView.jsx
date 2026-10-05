"use client";

// ============================================================================
//  Pengajuan pengambilan proyek. Sejak v3.2.0 pengajuan langsung tersimpan
//  di dashboard (tab "Pengerjaan") dan menunggu acc tim akademik; chat WA ke
//  admin hanya pemberitahuan opsional. Wajib login sebagai guru.
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah, numberID } from "@/lib/format";
import Icon from "./Icon";
import { Dialog } from "./Drawer";
import { tautanWa } from "@/lib/tautan";

// ID proyek ikut di pesan WA: ada subtes bernama sama pada proyek berbeda.
function pesanWa(dibuat, guru) {
  const baris = dibuat.map((d, i) => `${i + 1}. ${d.subtes} [${d.idProyek}] — ${numberID(d.jumlah)} soal`).join("\n");
  return `Halo kak, saya ${guru?.nama || ""} baru mengajukan pengambilan proyek lewat dashboard:\n\n${baris}\n\nMohon di-acc ya. Terima kasih!`;
}

export default function CartView({ cart = [], onQty, onRemove, onClear, onBack, waNumber, guru = null, aktif = 0, maks = 3, onSelesai }) {
  const router = useRouter();
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState(null); // { dibuat, ditolak }

  const soal = cart.reduce((s, it) => s + it.qty, 0);
  const fee = cart.reduce((s, it) => s + it.qty * it.harga, 0);
  const sisaSlot = Math.max(0, maks - aktif);
  const lebih = cart.length > sisaSlot;

  const ajukan = async () => {
    setKirim(true);
    setGalat("");
    try {
      const res = await fetch("/api/guru/ambil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.map((it) => ({ idProyek: it.id, jumlah: it.qty })) }),
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      setHasil({ dibuat: j.dibuat || [], ditolak: j.ditolak || [] });
    } catch (e) {
      setGalat(e.message);
    } finally {
      setKirim(false);
    }
  };

  const tutupHasil = () => {
    const adaYangMasuk = hasil?.dibuat?.length;
    setHasil(null);
    if (adaYangMasuk) {
      onSelesai?.(); // kosongkan pilihan
      router.refresh(); // sisa kuota & status terbaru
    }
  };

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
            <button type="button" className="btn btn-blue" onClick={onBack}>
              Pilih proyek
            </button>
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
            {guru ? (
              <div className="auth-akun">
                <Icon name="userCheck" size={18} />
                <span>
                  <b>{guru.nama}</b>
                  {guru.email}
                </span>
              </div>
            ) : null}
            <div>
              <div className="sum-row">
                <span>Proyek</span>
                <span>{cart.length}</span>
              </div>
              <div className="sum-row">
                <span>Total soal</span>
                <span>{numberID(soal)}</span>
              </div>
              <div className="sum-total">
                <span>Perkiraan fee</span>
                <span>{rupiah(fee)}</span>
              </div>
            </div>
            {guru ? (
              <small className={lebih ? "neg" : "muted"}>
                Proyek aktifmu {numberID(aktif)} dari maks. {numberID(maks)}.
                {lebih ? ` Hanya ${numberID(sisaSlot)} proyek lagi yang bisa diajukan — kurangi pilihanmu.` : ""}
              </small>
            ) : null}
            {galat ? (
              <div className="banner err" role="alert" style={{ margin: 0 }}>
                <Icon name="alert" />
                <div>{galat}</div>
              </div>
            ) : null}
            {guru ? (
              <button type="button" className="btn btn-blue block" onClick={ajukan} disabled={kirim || lebih}>
                <Icon name="send" />
                {kirim ? "Mengajukan…" : "Ajukan pengambilan"}
              </button>
            ) : (
              <a className="btn btn-blue block" href="/open/masuk">
                <Icon name="kunci" />
                Masuk sebagai guru untuk mengajukan
              </a>
            )}
            <small className="muted" style={{ textAlign: "center" }}>
              Kuota langsung dipesan untukmu dan menunggu acc tim akademik. Pantau statusnya di Proyek saya.
            </small>
            <button type="button" className="btn-link" onClick={onClear}>
              Kosongkan pengajuan
            </button>
          </div>
        </div>
      )}

      {hasil ? (
        <Dialog title={hasil.dibuat.length ? "Pengajuan terkirim" : "Pengajuan belum masuk"} onClose={tutupHasil}>
          {hasil.dibuat.length ? (
            <>
              <p className="modal-sub">
                {numberID(hasil.dibuat.length)} proyek menunggu acc tim akademik. Kuotanya sudah dipesan untukmu — pantau statusnya di Proyek saya.
              </p>
              <ul className="hasil-ajuan">
                {hasil.dibuat.map((d) => (
                  <li key={d.id}>
                    <Icon name="check" size={14} stroke={2.4} /> {d.subtes} · {numberID(d.jumlah)} soal
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {hasil.ditolak.length ? (
            <>
              <p className="modal-sub">{hasil.dibuat.length ? "Yang tidak bisa diajukan:" : "Tidak ada yang bisa diajukan:"}</p>
              <ul className="hasil-ajuan gagal">
                {hasil.ditolak.map((d, i) => (
                  <li key={i}>
                    <Icon name="x" size={14} stroke={2.4} /> {d.subtes || d.idProyek}: {d.alasan}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {hasil.dibuat.length ? (
            <>
              <a className="btn btn-blue block" href="/open/saya">
                <Icon name="clipboard" />
                Lihat Proyek saya
              </a>
              {waNumber ? (
                <a className="btn btn-ghost block" href={tautanWa(waNumber, pesanWa(hasil.dibuat, guru))} target="_blank" rel="noopener noreferrer">
                  <Icon name="send" />
                  Kabari tim akademik via WA (opsional)
                </a>
              ) : null}
            </>
          ) : (
            <button type="button" className="btn btn-ghost block" onClick={tutupHasil}>
              Tutup
            </button>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
