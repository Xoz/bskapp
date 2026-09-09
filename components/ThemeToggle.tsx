"use client";

import { useEffect, useState } from "react";
import { readThemePreference, resolveTheme, THEME_COLORS, type ThemePreference } from "@/lib/theme";

export default function ThemeToggle({ className }: { className?: string }) {
  const [preference, setPreference] = useState<ThemePreference | null>(null);
  useEffect(() => {
    try { setPreference(readThemePreference(localStorage.getItem("bsk_theme"))); } catch { setPreference("light"); }
  }, []);
  useEffect(() => {
    if (preference === null) return;
    const currentPreference = preference;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = resolveTheme(currentPreference, media.matches);
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);
  function change(next: ThemePreference) {
    setPreference(next);
    try { localStorage.setItem("bsk_theme", next); } catch { /* Behåll temat i den här sessionen. */ }
  }
  return (
    <label className={className ?? "bsk-theme-field"}>
      <span>Utseende</span>
      <select className="input bsk-theme-select" value={preference ?? "light"} onChange={(event) => change(readThemePreference(event.target.value))}>
        <option value="light">Ljust</option><option value="dark">Mörkt</option><option value="system">System</option>
      </select>
    </label>
  );
}
