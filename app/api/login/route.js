import { NextResponse } from "next/server";
import { COOKIE, tokenFor, passwordConfigured } from "@/lib/auth";

export async function POST(req) {
  const form = await req.formData();
  const pw = String(form.get("password") || "");
  const next = String(form.get("next") || "/admin");
  const origin = req.nextUrl.origin;

  if (!passwordConfigured()) {
    return NextResponse.redirect(new URL(next, origin), { status: 303 });
  }
  if (pw && pw === process.env.INTERNAL_PASSWORD) {
    const token = await tokenFor(pw);
    const res = NextResponse.redirect(new URL(next, origin), { status: 303 });
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
    return res;
  }
  return NextResponse.redirect(new URL("/admin/login?error=1", origin), {
    status: 303,
  });
}
