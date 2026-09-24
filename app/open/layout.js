// Halaman guru bisa dipasang sebagai aplikasi "Proyek Guru" (ikon putih).
// Manifest terpisah dari admin supaya dua aplikasi itu bisa sama-sama
// terpasang di satu HP tanpa saling menimpa.
export const metadata = {
  manifest: "/manifest-guru.webmanifest",
  appleWebApp: { capable: true, title: "Proyek Guru", statusBarStyle: "default" },
  // `icons` di layout anak menggantikan milik induk — favicon ikut disebut.
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" }, apple: "/icons/guru-180.png" },
};

// Warna bilah status HP = warna header halaman guru.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function OpenLayout({ children }) {
  return children;
}
