import "./globals.css";
import SecretAccess from "@/components/SecretAccess";

export const metadata = {
  title: { default: "Product Freelance", template: "%s · Product Freelance" },
  description: "Proyek guru freelance: katalog soal terbuka dan dashboard internal tim akademik.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0B1A" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('gf_theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <SecretAccess />
      </body>
    </html>
  );
}
