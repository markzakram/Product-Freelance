// Keluar — WAJIB POST (GET bisa dipicu prefetch; lihat app/api/logout).
import { NextResponse } from "next/server";
import { COOKIE_GURU } from "@/lib/sesiGuru";

export async function POST(req) {
  const res = NextResponse.redirect(new URL("/open/masuk?keluar=1", req.nextUrl.origin), { status: 303 });
  res.cookies.set(COOKIE_GURU, "", { path: "/", maxAge: 0 });
  return res;
}
