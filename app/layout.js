import "./globals.css";
import SecretAccess from "@/components/SecretAccess";

export const metadata = {
  title: "Proyek Guru Freelance — Dashboard",
  description: "Papan proyek freelance & dashboard internal untuk tim akademik.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {children}
        <SecretAccess />
      </body>
    </html>
  );
}
