"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("gf_theme", next);
    } catch (_) {}
  };
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Ganti tema terang/gelap"
      title="Ganti tema terang/gelap"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
