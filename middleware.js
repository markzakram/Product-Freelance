import { NextResponse } from "next/server";
import { COOKIE, tokenFor, passwordConfigured } from "@/lib/auth";

export const config = { matcher: ["/admin/:path*"] };

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Always allow the login page itself.
  if (pathname === "/admin/login") return NextResponse.next();

  // If no password set, allow through (preview mode).
  if (!passwordConfigured()) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE)?.value;
  const expected = await tokenFor(process.env.INTERNAL_PASSWORD);
  if (cookie && cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
