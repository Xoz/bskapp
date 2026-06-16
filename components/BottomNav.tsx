"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";
import {
  IconOverview,
  IconPlayers,
  IconPitch,
  IconChart,
  IconChat,
} from "@/components/Icons";

const COACH_ITEMS = [
  { href: "/oversikt", label: "Hem", Icon: IconOverview },
  { href: "/spelare", label: "Spelare", Icon: IconPlayers },
  { href: "/matcher", label: "Matcher", Icon: IconPitch },
  { href: "/statistik", label: "Statistik", Icon: IconChart },
  { href: "/intervjuer", label: "Intervjuer", Icon: IconChat },
];

export default function BottomNav({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const items = role === "coach" ? COACH_ITEMS : [];

  if (items.length === 0) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        background: "var(--bg-nav)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map(({ href, label, Icon }) => {
        const active =
          pathname === href ||
          (href !== "/oversikt" && href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center pt-2 pb-1.5 gap-1 transition-colors"
            style={{ color: active ? "var(--primary)" : "var(--ink-faint)" }}
          >
            <Icon width={22} height={22} />
            <span
              className="text-[0.625rem] font-medium"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
