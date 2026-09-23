"use client";

// Popup "Panduan" di halaman guru. Isinya dibaca dari tab "Panduan" di sheet.
import Icon from "./Icon";
import { Dialog } from "./Drawer";

function youtubeId(url) {
  if (!url) return "";
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}

export default function GuideModal({ open, onClose, items = [] }) {
  if (!open) return null;
  return (
    <Dialog
      title="Sebelum mengambil proyek"
      onClose={onClose}
      size=""
      foot={
        <button type="button" className="btn btn-blue" onClick={onClose}>
          Mengerti, lihat proyek
        </button>
      }
    >
      <p className="modal-sub">
        Baca briefing dan tonton video panduan ini dulu, supaya soal yang kamu kirim sesuai standar dan tidak perlu revisi.
      </p>
      <a className="guide-doc" href="/panduan-kerja-guru-freelance.pdf" target="_blank" rel="noopener noreferrer">
        <span className="doc-ico"><Icon name="file" size={20} /></span>
        <span className="g-txt">
          <span className="g-no">DOKUMEN</span>
          <span className="g-ket" style={{ display: "block" }}>Briefing &amp; panduan kerja guru freelance (PDF)</span>
          <span className="g-go">Buka PDF</span>
        </span>
      </a>
      {items.length === 0 ? (
        <div className="empty" style={{ padding: 16 }}>Video panduan belum tersedia.</div>
      ) : (
        items.map((it, i) => {
          const vid = youtubeId(it.url);
          return (
            <a key={i} className="guide-item" href={it.url || "#"} target="_blank" rel="noopener noreferrer">
              <span className="guide-thumb">
                {vid ? <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="" loading="lazy" /> : null}
                <span className="play"><Icon name="play" size={22} /></span>
              </span>
              <span className="g-txt">
                <span className="g-no">VIDEO {it.no ?? i + 1}</span>
                <span className="g-ket" style={{ display: "block" }}>{it.keterangan}</span>
                <span className="g-go">Tonton di YouTube</span>
              </span>
            </a>
          );
        })
      )}
    </Dialog>
  );
}
