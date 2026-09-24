// Dashboard admin bisa dipasang sebagai aplikasi "PF Admin" (ikon indigo).
// Halaman login ikut di bawah layout ini, jadi admin bisa memasangnya
// langsung dari layar login di HP.
export const metadata = {
  manifest: "/manifest-admin.webmanifest",
  appleWebApp: { capable: true, title: "PF Admin", statusBarStyle: "default" },
  // `icons` di layout anak menggantikan milik induk — favicon ikut disebut.
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" }, apple: "/icons/admin-180.png" },
};

// Warna bilah status HP = warna bilah atas admin.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#16122B" },
  ],
};

export default function AdminLayout({ children }) {
  return children;
}
