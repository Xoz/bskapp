"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";

const COACH_LINKS = [
  { href: "/", label: "Översikt", icon: "◧" },
  { href: "/spelare", label: "Spelare", icon: "⚽" },
  { href: "/matcher", label: "Matcher", icon: "🏟" },
  { href: "/statistik", label: "Statistik", icon: "📈" },
  { href: "/installningar", label: "Inställningar", icon: "⚙" },
];

const PARENT_LINKS = [{ href: "/matcher", label: "Matcher", icon: "🏟" }];

export default function NavLinks({ role, horizontal }: { role: Role; horizontal?: boolean }) {
  const pathname = usePathname();
  const links = role === "coach" ? COACH_LINKS : PARENT_LINKS;

  return (
    <nav className={horizontal ? "flex gap-1" : "flex flex-col gap-1"}>
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link whitespace-nowrap ${active ? "active" : ""}`}
          >
            <span aria-hidden className="text-base leading-none">
              {link.icon}
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
