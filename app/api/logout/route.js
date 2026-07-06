import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";

export async function GET(req) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), {
    status: 303,
  });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
