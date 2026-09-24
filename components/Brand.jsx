// Logo "Product Freelance" digambar ulang sebagai SVG. PNG aslinya punya tepi
// magenta sisa penghapusan latar yang terlihat kotor di latar putih; versi
// vektor ini tajam di semua ukuran dan ikut tema (lubang pegangan kotak
// memakai warna permukaan, bukan putih mati).
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="icon">
      <path d="M24 4.5L41.5 13L24 21.5L6.5 13Z" fill="#3B12C9" stroke="#3B12C9" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5.5 17L21 24.8V43.5L5.5 35.7Z" fill="#3B12C9" stroke="#3B12C9" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 25.2L15.5 28.2" stroke="var(--surface)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M27 24.8L42.5 17V35.7L27 43.5Z" stroke="#9B3BFF" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M30.5 27.6L38.8 23.4V31.2L30.5 35.4Z" stroke="#9B3BFF" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M29.6 38.2L40 33" stroke="#9B3BFF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M33.3 28.6l3.3 1.7-1.5.5.9 1.8" stroke="#9B3BFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// `versi` & `sub` dipakai di sidebar admin, meniru ProductTrack: nomor versi
// kecil di samping nama supaya jelas build mana yang sedang terpasang, dan
// nama divisi di bawahnya.
export default function Brand({ size = 34, row = false, versi, sub }) {
  const kata = (
    <span className={"brand-word" + (row || sub ? " row" : "")}>
      <b>Product</b>
      <i>Freelance</i>
      {versi ? <span className="brand-ver">v{versi}</span> : null}
    </span>
  );
  return (
    <span className="brand">
      <LogoMark size={size} />
      {sub ? (
        <span className="brand-stack">
          {kata}
          <span className="brand-sub">{sub}</span>
        </span>
      ) : (
        kata
      )}
    </span>
  );
}
