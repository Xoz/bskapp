"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@/components/Icons";

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("bsk_theme") as "dark" | "light" | null;
    setTheme(saved ?? "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("bsk_theme", next);
    if (next === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Ljust läge" : "Mörkt läge"}
      className={className ?? "p-1.5 rounded-lg transition-colors hover:bg-[var(--bg2)]"}
      style={{ color: "var(--ink-faint)" }}
    >
      {theme === "dark" ? <IconSun width={17} height={17} /> : <IconMoon width={17} height={17} />}
    </button>
  );
}
