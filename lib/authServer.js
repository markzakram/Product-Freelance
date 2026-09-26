// Cek sesi admin di DALAM route/halaman (runtime Node) — lapis kedua di
// belakang middleware. Seluruh area admin dulu hanya bergantung pada
// middleware, padahal Next.js beberapa kali punya celah "middleware bypass".
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, tokenFor, passwordConfigured, bolehTanpaPassword } from "./auth";

export async function adminSah() {
  if (!passwordConfigured()) return bolehTanpaPassword();
  const c = cookies().get(COOKIE)?.value;
  return Boolean(c) && c === (await tokenFor(process.env.INTERNAL_PASSWORD));
}

/** Untuk route API: NextResponse 401 bila bukan admin, atau null bila sah. */
export async function tolakBukanAdmin() {
  return (await adminSah()) ? null : NextResponse.json({ error: "Sesi berakhir. Silakan login ulang." }, { status: 401 });
}
