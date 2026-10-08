"use client";

// ============================================================================
//  DATA DEMO — hanya di situs demo (MODE_DEMO). Menjelaskan skenario data
//  contoh, daftar akun untuk mencoba, dan tombol untuk memulihkan data.
// ============================================================================

import { useState } from "react";
import Icon from "./Icon";
import { Dialog } from "./Drawer";
import { GURU_DEMO, TIM_DEMO, PASSWORD_DEMO } from "@/lib/demo";

const SKENARIO = [
  ["Tim seleksi", "Pendaftar di setiap tahap: baru masuk, ditinjau, sampel (perlu revisi), lolos sampel & siap dibuatkan akun, ditolak; plus kontak WA yang perlu ditindaklanjuti."],
  ["Tim akademik", "Katalog 8 proyek bulan ini dengan deadline & wajib lapor progres, satu pengajuan menunggu acc, satu hasil menunggu review, satu revisi berjalan, dan log pembayaran."],
  ["Guru (freelance)", "Ayu: proyek berjalan dengan lapor 30% besok (H-1) dan 50% H-3 + pengajuan menunggu acc. Bima: hasil menunggu review + progres 30% baru masuk, lapor 50% hari ini. Citra: sedang revisi dengan batas 3 hari."],
];

export default function DemoPanel() {
  const [tanya, setTanya] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState("");

  const pulihkan = async () => {
    setBusy(true);
    setGalat("");
    setHasil(null);
    try {
      const res = await fetch("/api/admin/demo", { method: "POST", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Gagal (HTTP ${res.status})`);
      setHasil(j.hasil);
      setTanya(false);
    } catch (e) {
      setGalat(e.message);
      setTanya(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demo-panel">
      <div className="card card-p">
        <h2 className="demo-judul">
          <Icon name="info" /> Ini situs demo
        </h2>
        <p className="muted">
          Semua data di sini fiktif dan tersimpan di spreadsheet demo yang terpisah — data guru, proyek, dan pembayaran yang asli tidak
          tersentuh. Silakan mencoba apa saja: acc pengajuan, review, lapor progres, membuat akun, mengirim WA (hanya pratinjau).
        </p>
        <ul className="demo-skenario">
          {SKENARIO.map(([judul, isi]) => (
            <li key={judul}>
              <b>{judul}</b>
              <span>{isi}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card card-p">
        <h2 className="demo-judul">
          <Icon name="kunci" /> Akun untuk mencoba
        </h2>
        <p className="muted">
          Password semua akun: <code>{PASSWORD_DEMO}</code>. Akun tim masuk lewat <a href="/admin/login">/admin/login</a>, akun guru lewat{" "}
          <a href="/open/masuk">/open/masuk</a> (buka di jendela penyamaran agar bisa masuk sebagai tim dan guru sekaligus).
        </p>
        <div className="demo-akun">
          {[...TIM_DEMO.map((a) => ({ ...a, ket: a.peran.join(", "), jenis: "Tim" })), ...GURU_DEMO.map((a) => ({ ...a, jenis: "Guru" }))].map((a) => (
            <div key={a.email}>
              <span className={"pill " + (a.jenis === "Tim" ? "run" : "appr")}>{a.jenis}</span>
              <b>{a.nama}</b>
              <small>{a.email}</small>
              <small className="muted">{a.ket}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-p">
        <h2 className="demo-judul">
          <Icon name="refresh" /> Pulihkan data contoh
        </h2>
        <p className="muted">
          Mengembalikan seluruh data demo ke kondisi awal: semua perubahan hasil mencoba-coba dihapus, tanggal & deadline disesuaikan ke hari ini.
          Berlaku untuk semua orang yang sedang memakai situs demo.
        </p>
        {hasil ? (
          <div className="banner live" role="status" style={{ margin: "0 0 12px" }}>
            <Icon name="check" />
            <div>
              Data contoh dipulihkan ({hasil.waktu}): {hasil.katalog} proyek di {hasil.bulan}, {hasil.pengerjaan} pengambilan, {hasil.guru} guru,{" "}
              {hasil.pendaftar} pendaftar. Muat ulang halaman untuk melihatnya.
            </div>
          </div>
        ) : null}
        {galat ? (
          <div className="banner err" role="alert" style={{ margin: "0 0 12px" }}>
            <Icon name="alert" />
            <div>{galat}</div>
          </div>
        ) : null}
        <button type="button" className="btn btn-blue" onClick={() => setTanya(true)} disabled={busy}>
          <Icon name="refresh" />
          {busy ? "Memulihkan…" : "Pulihkan data contoh"}
        </button>
      </div>

      {tanya ? (
        <Dialog title="Pulihkan data contoh?" onClose={() => !busy && setTanya(false)}>
          <p className="modal-sub">Semua perubahan di situs demo akan hilang dan diganti data contoh awal. Proses ini ±20 detik.</p>
          <button type="button" className="btn btn-blue block" onClick={pulihkan} disabled={busy}>
            <Icon name="refresh" />
            {busy ? "Memulihkan…" : "Ya, pulihkan"}
          </button>
          <button type="button" className="btn btn-ghost block" onClick={() => setTanya(false)} disabled={busy}>
            Batal
          </button>
        </Dialog>
      ) : null}
    </div>
  );
}
