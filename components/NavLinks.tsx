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
  IconBook,
} from "@/components/Icons";

const COACH_LINKS = [
  { href: "/oversikt", label: "Översikt", Icon: IconOverview },
  { href: "/spelare", label: "Spelare", Icon: IconPlayers },
  { href: "/matcher", label: "Matcher", Icon: IconPitch },
  { href: "/statistik", label: "Statistik", Icon: IconChart },
  { href: "/intervjuer", label: "Intervjuer", Icon: IconChat },
  { href: "/guide", label: "Guide", Icon: IconBook },
];

export default function NavLinks({ role, horizontal }: { role: Role | null; horizontal?: boolean }) {
  const pathname = usePathname();
  const links = role === "coach" ? COACH_LINKS : [];

  return (
    <nav className={horizontal ? "flex gap-1" : "flex flex-col gap-1"}>
      {links.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== "/oversikt" && href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`nav-link whitespace-nowrap ${active ? "active" : ""}`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
