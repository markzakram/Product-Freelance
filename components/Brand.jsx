// Logo "Product Freelance" = berkas asli di folder /logo, dibersihkan dari
// sisa hapus-latar (tepi magenta & bintik biru) dan hanya memakai dua warna
// logo: public/logo/logo-mark.png (256px, tampil tajam sampai ukuran ~120px).
export function LogoMark({ size = 32 }) {
  return <img src="/logo/logo-mark.png" width={size} height={size} alt="" aria-hidden="true" className="icon logo-mark" decoding="async" />;
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
