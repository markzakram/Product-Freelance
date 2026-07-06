// Lightweight auth shared by middleware (edge) and API routes (node).
// crypto.subtle is available in both the Edge runtime and Node 18+.
export const COOKIE = "gf_auth";

export async function tokenFor(pw) {
  const data = new TextEncoder().encode("guru-freelance:" + pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// No password configured => treat area as "open preview" (with a warning in UI).
export function passwordConfigured() {
  return Boolean(process.env.INTERNAL_PASSWORD && process.env.INTERNAL_PASSWORD.length);
}
