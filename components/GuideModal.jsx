"use client";

// Popup "Tata Cara / Panduan" shown on the Open Freelance page.
// Receives the guide rows read from the Sheet's "Panduan" tab.

function youtubeId(url) {
  if (!url) return "";
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : "";
}

export default function GuideModal({ open, onClose, items = [] }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>📘 Panduan</h2>
          <button className="icon-x" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-sub">
            Baca dokumen briefing dan tonton video panduan berikut sebelum
            mengambil proyek, agar proses input dan pengumpulan soal sesuai
            standar.
          </p>

          <a
            className="guide-doc"
            href="/panduan-kerja-guru-freelance.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="doc-ico">📄</span>
            <div className="g-txt">
              <div className="g-no">DOKUMEN</div>
              <div className="g-ket">
                Briefing &amp; Panduan Kerja Guru Freelance (PDF)
              </div>
              <span className="g-go">Buka / unduh PDF →</span>
            </div>
          </a>
          {items.length === 0 ? (
            <div className="empty">Panduan belum tersedia.</div>
          ) : (
            items.map((it, i) => {
              const vid = youtubeId(it.url);
              const thumb = vid
                ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg`
                : "";
              return (
                <a
                  key={i}
                  className="guide-item"
                  href={it.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="guide-thumb">
                    {thumb ? <img src={thumb} alt="" loading="lazy" /> : null}
                    <span className="play">▶</span>
                  </div>
                  <div className="g-txt">
                    <div className="g-no">VIDEO {it.no ?? i + 1}</div>
                    <div className="g-ket">{it.keterangan}</div>
                    <span className="g-go">Tonton di YouTube →</span>
                  </div>
                </a>
              );
            })
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-blue" onClick={onClose}>
            Mengerti, lanjut pilih proyek
          </button>
        </div>
      </div>
    </div>
  );
}
