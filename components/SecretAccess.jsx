"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Akses tersembunyi ke dashboard internal — tanpa tombol/link yang terlihat.
// Cara masuk: tekan Ctrl + Shift + L, atau ketik kata "adminx" di halaman.
export default function SecretAccess() {
  const router = useRouter();
  useEffect(() => {
    let buf = "";
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        router.push("/admin");
        return;
      }
      if (e.key && e.key.length === 1) {
        buf = (buf + e.key).slice(-6).toLowerCase();
        if (buf === "adminx") {
          buf = "";
          router.push("/admin");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
