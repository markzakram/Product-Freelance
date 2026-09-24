"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

// Bilah status HP (aplikasi terpasang) mengikuti tema di aplikasi, bukan
// tema sistem: kalau tidak, memilih gelap di HP bertema terang menyisakan
// bilah putih di atas halaman gelap. Warnanya = --surface halaman ini
// (header guru / bilah atas admin).
function samakanBilahStatus() {
  const el = document.querySelector(".pub") || document.body;
  const warna = getComputedStyle(el).getPropertyValue("--surface").trim();
  if (!warna) return;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", warna));
}

export default function ThemeToggle({ className = "ibtn" }) {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
    samakanBilahStatus();
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    samakanBilahStatus();
    try {
      localStorage.setItem("gf_theme", next);
    } catch (_) {}
  };
  const label = theme === "dark" ? "Pakai tema terang" : "Pakai tema gelap";
  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
