import AdminBoard from "@/components/AdminBoard";
import { getBoard } from "@/lib/juli";
import { canWrite, credsDiagnosis } from "@/lib/gauth";
import { passwordConfigured } from "@/lib/auth";
import { adminSah } from "@/lib/authServer";
import { redirect } from "next/navigation";

// Selalu dibaca ulang dari spreadsheet — tanpa cache — supaya angka di admin
// persis sama dengan isi sheet saat halaman dibuka.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Dashboard admin" };

export default async function AdminPage() {
  // Lapis kedua di belakang middleware (lihat lib/authServer.js).
  if (!(await adminSah())) redirect("/admin/login?next=%2Fadmin");
  const board = await getBoard();
  const diag = board.source === "sample" ? await credsDiagnosis() : null;
  const brand = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";

  // Kerangka (sidebar, header, banner) sepenuhnya milik AdminBoard: di desain
  // ini tidak ada top bar terpisah — logo, bulan & tombol keluar ada di sidebar.
  return (
    <AdminBoard
      initial={{ ...board, canWrite: board.source === "live" && canWrite(), diag }}
      brand={brand}
      peringatanPassword={!passwordConfigured()}
    />
  );
}
