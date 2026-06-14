"use client";

import { useEffect, useState } from "react";
import { SETTINGS_SECTIONS } from "@/components/SettingsMenu";

export default function SettingsSidebar() {
  const [active, setActive] = useState<string>(SETTINGS_SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-10% 0px -70% 0px" }
    );
    SETTINGS_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="space-y-0.5">
      {SETTINGS_SECTIONS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
            style={{
              color: isActive ? "var(--primary)" : "var(--ink-soft)",
              background: isActive ? "var(--primary-ghost)" : "transparent",
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <Icon width={15} height={15} />
            {label}
          </a>
        );
      })}
    </nav>
  );
}
