"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

export default function ThemeToggle({ className = "ibtn" }) {
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
  const label = theme === "dark" ? "Pakai tema terang" : "Pakai tema gelap";
  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
