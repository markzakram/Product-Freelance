"use client";

// ============================================================================
//  Tombol "Pasang aplikasi" (PWA) — halaman guru & admin.
//
//  - Android / Chrome / Edge: memakai tawaran pasang bawaan browser, yang
//    ditangkap sedini mungkin di app/layout.js (window.__pasang).
//  - iPhone / iPad: Safari tidak punya tawaran otomatis — tombolnya membuka
//    petunjuk "Bagikan → Tambah ke Layar Utama".
//  - Sudah terpasang, atau browser tidak mendukung: tidak tampil sama
//    sekali, jadi tidak ada tombol yang tidak bisa berbuat apa-apa.
//
//  variant "banner": kartu ajakan di halaman guru (HP saja), bisa ditutup —
//  ikon di header terlalu samar untuk guru yang belum tahu bisa memasang.
// ============================================================================

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { Dialog } from "./Drawer";

const KUNCI_TUTUP = "gf_pasang_tutup";

function terpasang() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function perangkatIos() {
  const ua = window.navigator.userAgent;
  // iPadOS 13+ mengaku sebagai Mac; bedanya ia punya layar sentuh.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
}

export default function PasangApp({
  variant = "button",
  className = "btn btn-ghost",
  labelClass,
  label = "Pasang aplikasi",
  nama = "aplikasi ini",
  ikon,
  iconSize = 16,
}) {
  const [tawaran, setTawaran] = useState(null);
  const [ios, setIos] = useState(false);
  const [petunjuk, setPetunjuk] = useState(false);
  const [ditutup, setDitutup] = useState(true);

  useEffect(() => {
    if (terpasang()) return undefined;
    setIos(perangkatIos());
    try {
      setDitutup(localStorage.getItem(KUNCI_TUTUP) === "1");
    } catch (_) {
      setDitutup(false);
    }
    const ambil = () => setTawaran(window.__pasang || null);
    const selesai = () => {
      window.__pasang = null;
      setTawaran(null);
    };
    ambil();
    window.addEventListener("pasang-siap", ambil);
    window.addEventListener("appinstalled", selesai);
    return () => {
      window.removeEventListener("pasang-siap", ambil);
      window.removeEventListener("appinstalled", selesai);
    };
  }, []);

  if (!tawaran && !ios) return null;
  if (variant === "banner" && ditutup) return null;

  const pasang = async () => {
    if (!tawaran) return setPetunjuk(true);
    tawaran.prompt();
    await tawaran.userChoice.catch(() => null);
    // Tawaran hanya bisa dipakai sekali; kalau ditolak, Chrome akan
    // mengirim yang baru nanti (ditangkap lagi lewat "pasang-siap").
    window.__pasang = null;
    setTawaran(null);
  };

  const tutup = () => {
    setDitutup(true);
    try {
      localStorage.setItem(KUNCI_TUTUP, "1");
    } catch (_) {}
  };

  const dialog = petunjuk ? (
    <Dialog title="Pasang di iPhone" onClose={() => setPetunjuk(false)}>
      <p className="modal-sub">
        Setelah dipasang, {nama} terbuka dari ikon di layar utama — layar penuh, tanpa bilah alamat, seperti aplikasi biasa.
      </p>
      <ol className="langkah">
        <li>
          <span className="langkah-ico">
            <Icon name="share" size={18} />
          </span>
          <div>
            Ketuk <b>Bagikan</b> di bilah Safari.
            <small>Dibuka dari WhatsApp? Pilih dulu “Buka di Safari”.</small>
          </div>
        </li>
        <li>
          <span className="langkah-ico">
            <Icon name="plusSquare" size={18} />
          </span>
          <div>
            Gulir, lalu pilih <b>Tambah ke Layar Utama</b>.
          </div>
        </li>
        <li>
          <span className="langkah-ico">
            <Icon name="check" size={18} stroke={2.2} />
          </span>
          <div>
            Ketuk <b>Tambah</b> di kanan atas.
          </div>
        </li>
      </ol>
    </Dialog>
  ) : null;

  if (variant === "banner") {
    return (
      <>
        <div className="pasang-banner" role="region" aria-label="Pasang aplikasi">
          {ikon ? <img src={ikon} alt="" width={40} height={40} /> : null}
          <div className="pb-teks">
            <b>Pasang {nama} di HP</b>
            <span>Buka langsung dari layar utama, layar penuh seperti aplikasi.</span>
          </div>
          <button type="button" className="btn btn-blue sm" onClick={pasang}>
            Pasang
          </button>
          <button type="button" className="pb-x" onClick={tutup} aria-label="Tutup ajakan pasang">
            <Icon name="x" />
          </button>
        </div>
        {dialog}
      </>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={pasang} title={label}>
        <Icon name="download" size={iconSize} />
        <span className={labelClass}>{label}</span>
      </button>
      {dialog}
    </>
  );
}
