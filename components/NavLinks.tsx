"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";
import {
  IconOverview,
  IconPlayers,
  IconPitch,
  IconChart,
  IconSettings,
} from "@/components/Icons";

const COACH_LINKS = [
  { href: "/", label: "Översikt", Icon: IconOverview },
  { href: "/spelare", label: "Spelare", Icon: IconPlayers },
  { href: "/matcher", label: "Matcher", Icon: IconPitch },
  { href: "/statistik", label: "Statistik", Icon: IconChart },
  { href: "/installningar", label: "Inställningar", Icon: IconSettings },
];

const PARENT_LINKS = [{ href: "/matcher", label: "Matcher", Icon: IconPitch }];

export default function NavLinks({ role, horizontal }: { role: Role; horizontal?: boolean }) {
  const pathname = usePathname();
  const links = role === "coach" ? COACH_LINKS : PARENT_LINKS;

  return (
    <nav className={horizontal ? "flex gap-1" : "flex flex-col gap-1"}>
      {links.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
