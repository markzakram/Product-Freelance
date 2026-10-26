import AdminBoard from "@/components/AdminBoard";
import { getBoard } from "@/lib/juli";
import { canWrite, credsDiagnosis } from "@/lib/gauth";
import { passwordConfigured } from "@/lib/auth";
import { sesiAdmin } from "@/lib/authServer";
import { redirect } from "next/navigation";
import { bacaTampilan } from "@/lib/cacheTampilan";

// Halaman/sesi tetap dinamis. Hanya data tampilan yang memakai cache singkat;
// validasi penyimpanan membaca spreadsheet langsung.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Dashboard admin" };

export default async function AdminPage() {
  // Lapis kedua di belakang middleware (lihat lib/authServer.js).
  let sesi;
  try {
    sesi = await sesiAdmin();
  } catch (e) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Server sedang sibuk</h1>
          <p>{e.message}</p>
          <a className="btn btn-blue block" href="/admin">
            Muat ulang
          </a>
        </div>
      </div>
    );
  }
  if (!sesi) redirect("/admin/login?next=%2Fadmin");
  if (sesi.wajibGanti) redirect("/admin/ganti-password");
  const board = await bacaTampilan("board:", () => getBoard(), { grup: ["bulan", "guru"] }).catch((e) => ({ source: "error", error: e.message, projects: [], assignments: [], teachers: [], months: [], tab: "" }));
  const diag = board.source === "sample" ? await credsDiagnosis() : null;
  const brand = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";

  // Kerangka (sidebar, header, banner) sepenuhnya milik AdminBoard: di desain
  // ini tidak ada top bar terpisah — logo, bulan & tombol keluar ada di sidebar.
  return (
    <AdminBoard
      initial={{ ...board, canWrite: board.source === "live" && canWrite(), diag }}
      brand={brand}
      peringatanPassword={!passwordConfigured()}
      pengguna={{ nama: sesi.nama, email: sesi.email, peran: sesi.peran, pemilik: sesi.pemilik, akunTim: sesi.akunTim }}
    />
  );
}
