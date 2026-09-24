import "./globals.css";
import SecretAccess from "@/components/SecretAccess";

export const metadata = {
  title: { default: "Product Freelance", template: "%s · Product Freelance" },
  description: "Proyek guru freelance: katalog soal terbuka dan dashboard internal tim akademik.",
  // Favicon lewat metadata, BUKAN berkas app/icon.svg: ikon berbasis berkas
  // menimpa `icons` di layout anak, sehingga ikon iPhone (apple-touch-icon)
  // halaman guru & admin tidak pernah terpasang.
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" } },
};

export const viewport = {
  // "cover": isi boleh sampai tepi layar ber-notch; bilah bawah (menu admin,
  // bilah pengajuan guru) memberi jarak sendiri lewat env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0B1A" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('gf_theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

// Aplikasi terpasang (PWA). Tawaran pasang dari Chrome bisa datang sebelum
// React siap, jadi ditangkap sedini mungkin dan disimpan untuk tombol
// "Pasang aplikasi" (components/PasangApp.jsx). Service worker hanya di
// produksi: di dev ia akan ikut campur dengan hot reload.
const pwaScript =
  `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pasang=e;window.dispatchEvent(new Event('pasang-siap'));});` +
  (process.env.NODE_ENV === "production"
    ? `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`
    : "");

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: pwaScript }} />
      </head>
      <body>
        {children}
        <SecretAccess />
      </body>
    </html>
  );
}
