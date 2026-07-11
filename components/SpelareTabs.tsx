"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Flikrad högst upp i Spelare-sektionen. Samlar truppen och spelarsamtalen på
// ett ställe så att en ny tränare hittar "allt om spelaren" under en flik.
const TABS = [
  { href: "/spelare", label: "Spelare", needsInterviews: false },
  { href: "/spelare/intervjuer", label: "Samtal", needsInterviews: true },
];

export default function SpelareTabs({ canViewInterviews }: { canViewInterviews: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => !t.needsInterviews || canViewInterviews);
  if (tabs.length < 2) return null;

  return (
    <nav className="flex gap-1 -mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
      {tabs.map(({ href, label }) => {
        const active = href === "/spelare/intervjuer" ? pathname === href : pathname === "/spelare";
        return (
          <Link
            key={href}
            href={href}
            className="px-3.5 py-2 text-sm font-medium transition-colors"
            style={{
              color: active ? "var(--ink)" : "var(--ink-muted)",
              borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
              fontFamily: "var(--font-display)",
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
