import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const BRAND = process.env.NEXT_PUBLIC_BRAND || "Cerebrum";

export default function TopBar({ active, variant = "public" }) {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-badge">{BRAND.slice(0, 1)}</span>
          <span>{BRAND} · Guru Freelance</span>
        </Link>
        <nav className="nav">
          <ThemeToggle />
          {variant === "public" ? (
            <>
              <Link href="/open" className={active === "open" ? "active" : ""}>
                Open Freelance
              </Link>
            </>
          ) : (
            <>
              <Link href="/admin" className={active === "admin" ? "active" : ""}>
                Dashboard
              </Link>
              <Link href="/open">Open Freelance</Link>
              {/* Logout lewat form POST, bukan <Link>. Sebagai <Link>, Next.js
                  mem-prefetch-nya di production begitu tombol terlihat/di-hover
                  dan user jadi ter-logout sendiri tanpa mengklik. */}
              <form method="POST" action="/api/logout" className="nav-form">
                <button type="submit" className="navlink">
                  Keluar
                </button>
              </form>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
