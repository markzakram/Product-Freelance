import TopBar from "@/components/TopBar";
import DataBanner from "@/components/DataBanner";
import AdminBoard from "@/components/AdminBoard";
import { getBoard } from "@/lib/juli";
import { canWrite, credsDiagnosis } from "@/lib/gauth";
import { passwordConfigured } from "@/lib/auth";

// Selalu dibaca ulang dari spreadsheet — tanpa cache — supaya angka di admin
// persis sama dengan isi sheet saat halaman dibuka.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Dashboard Internal" };

export default async function AdminPage() {
  const board = await getBoard();
  const diag = board.source === "sample" ? await credsDiagnosis() : null;
  const brand = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";

  return (
    <>
      <TopBar active="admin" variant="admin" />
      <div className="container section">
        {!passwordConfigured() ? (
          <div className="banner sample" style={{ marginBottom: 12 }}>
            <span>⚠</span> Area internal belum dilindungi password. Set
            <b>&nbsp;INTERNAL_PASSWORD</b>&nbsp;di Environment Variables.
          </div>
        ) : null}
        <DataBanner source={board.source} />
        <AdminBoard
          initial={{ ...board, canWrite: board.source === "live" && canWrite(), diag }}
          brand={brand}
        />
      </div>
      <div className="footer">© {new Date().getFullYear()} · Dashboard Internal</div>
    </>
  );
}
