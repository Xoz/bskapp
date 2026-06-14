"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  IconSettings,
  IconPitch,
  IconOverview,
  IconPlayers,
  IconShield,
} from "@/components/Icons";

export const SETTINGS_SECTIONS = [
  { id: "matcher", label: "Matcher", Icon: IconPitch },
  { id: "laget", label: "Laget", Icon: IconOverview },
  { id: "trupp", label: "Trupp", Icon: IconPlayers },
  { id: "tranare", label: "Tränare", Icon: IconShield },
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
        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg2)]"
        style={{ color: open ? "var(--primary)" : "var(--ink-faint)" }}
      >
        <IconSettings width={17} height={17} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl py-1.5 z-50"
          style={{
            background: "var(--bg-nav)",
            border: "1px solid var(--line)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}
        >
          <p
            className="text-[0.6rem] uppercase tracking-[0.1em] px-4 pt-2 pb-1.5"
            style={{ color: "var(--ink-faint)" }}
          >
            Inställningar
          </p>
          {SETTINGS_SECTIONS.map(({ id, label, Icon }) => (
            <Link
              key={id}
              href={`/installningar#${id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--bg2)]"
              style={{ color: "var(--ink)" }}
            >
              <Icon width={15} height={15} style={{ color: "var(--ink-faint)" }} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
