import { NextResponse } from "next/server";
import { COOKIE, tokenFor, passwordConfigured } from "@/lib/auth";

// The write API lives under /api/admin and must be gated by the same cookie as
// the pages — otherwise anyone could POST edits straight into the spreadsheet.
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Always allow the login page itself.
  if (pathname === "/admin/login") return NextResponse.next();

  // If no password set, allow through (preview mode).
  if (!passwordConfigured()) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE)?.value;
  const expected = await tokenFor(process.env.INTERNAL_PASSWORD);
  if (cookie && cookie === expected) return NextResponse.next();

  // API callers get a 401 rather than an HTML redirect they cannot follow.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login ulang." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
