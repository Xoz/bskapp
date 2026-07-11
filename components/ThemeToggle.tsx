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
      aria-label={theme === "dark" ? "Växla till ljust läge" : "Växla till mörkt läge"}
      className={className ?? "icon-btn"}
      style={{ width: 32, height: 32 }}
    >
      {theme === "dark" ? (
        <IconSun width={17} height={17} />
      ) : (
        <IconMoon width={17} height={17} />
      )}
    </button>
  );
}
