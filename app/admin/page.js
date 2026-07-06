import TopBar from "@/components/TopBar";
import DataBanner from "@/components/DataBanner";
import AdminDashboard from "@/components/AdminDashboard";
import { getMaster, getFeeRecaps, getTeachers } from "@/lib/sheets";
import { passwordConfigured } from "@/lib/auth";

export const revalidate = 300;
export const metadata = { title: "Dashboard Internal" };

export default async function AdminPage() {
  const [master, recaps, teachers] = await Promise.all([
    getMaster(),
    getFeeRecaps(),
    getTeachers(),
  ]);
  const source =
    master.source === "live" || recaps.source === "live" || teachers.source === "live"
      ? "live"
      : "sample";

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
        <DataBanner source={source} />
        <AdminDashboard
          projects={master.projects}
          feeLog={master.feeLog}
          recaps={recaps.rows}
          teachers={teachers.rows}
        />
      </div>
      <div className="footer">© {new Date().getFullYear()} · Dashboard Internal</div>
    </>
  );
}
