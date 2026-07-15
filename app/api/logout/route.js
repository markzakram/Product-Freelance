import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";

// WAJIB POST — jangan pernah dikembalikan ke GET.
//
// Sebelumnya ini handler GET yang dipanggil lewat <Link href="/api/logout">.
// Di production, Next.js mem-PREFETCH setiap <Link> yang terlihat/di-hover
// (prefetch dimatikan saat dev, jadi bug ini tak muncul di lokal): router
// menembak "/api/logout?_rsc=..." sendiri, handler jalan, cookie terhapus, dan
// user ter-logout tanpa mengklik apa pun. Aturan umumnya: GET tidak boleh
// mengubah state — prefetcher, antivirus, dan pembuat preview link bebas
// memanggil GET kapan saja.
export async function POST(req) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), { status: 303 });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
