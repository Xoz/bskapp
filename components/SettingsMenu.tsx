"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  IconSettings,
  IconPitch,
  IconOverview,
  IconPlayers,
  IconShield,
  IconWhistle,
} from "@/components/Icons";

export const SETTINGS_SECTIONS = [
  { id: "profil", label: "Profil", Icon: IconWhistle },
  { id: "matcher", label: "Matcher", Icon: IconPitch },
  { id: "laget", label: "Laget", Icon: IconOverview },
  { id: "trupp", label: "Trupp", Icon: IconPlayers },
  { id: "tranare", label: "Tränare", Icon: IconShield },
] as const;

const SECONDARY_TOOLS = [
  { href: "/matcher", label: "Matcharkiv" },
  { href: "/statistik", label: "Äldre statistik" },
  { href: "/administration", label: "Administration" },
  { href: "/guide", label: "Guide" },
] as const;

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Inställningar"
        aria-label="Inställningar"
        className="icon-btn"
        style={{
          width: 32,
          height: 32,
          color: open ? "var(--primary)" : undefined,
          borderColor: open ? "var(--primary)" : undefined,
        }}
      >
        <IconSettings width={17} height={17} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 fade-in"
          style={{
            width: 208,
            borderRadius: "var(--r-card)",
            padding: "6px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <p
            className="caption px-3 pt-2 pb-1.5"
            style={{
              color: "var(--ink-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 600,
            }}
          >
            Inställningar
          </p>
          {SETTINGS_SECTIONS.map(({ id, label, Icon }) => (
            <Link
              key={id}
              href={`/installningar#${id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 body-small transition-colors"
              style={{
                color: "var(--ink)",
                borderRadius: "var(--r-button)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--elevated)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon width={16} height={16} style={{ color: "var(--ink-muted)" }} />
              {label}
            </Link>
          ))}
          <p className="caption px-3 pt-3 pb-1.5" style={{ color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            Sekundära verktyg
          </p>
          {SECONDARY_TOOLS.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block px-3 py-2 body-small" style={{ color: "var(--ink-secondary)", borderRadius: "var(--r-button)" }}>
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
