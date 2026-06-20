"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/lib/auth";
import {
  IconOverview,
  IconPlayers,
  IconPitch,
  IconChart,
  IconChat,
  IconBook,
} from "@/components/Icons";

const STAFF_LINKS: { href: string; label: string; Icon: typeof IconOverview; permission?: Permission }[] = [
  { href: "/oversikt", label: "Översikt", Icon: IconOverview },
  { href: "/spelare", label: "Spelare", Icon: IconPlayers, permission: "view_players" },
  { href: "/matcher", label: "Matcher", Icon: IconPitch, permission: "view_matches" },
  { href: "/statistik", label: "Statistik", Icon: IconChart, permission: "view_statistics" },
  { href: "/intervjuer", label: "Intervjuer", Icon: IconChat, permission: "view_interviews" },
  { href: "/administration", label: "Administration", Icon: IconPlayers, permission: "manage_users" },
  { href: "/guide", label: "Guide", Icon: IconBook },
];

export default function NavLinks({ permissions, horizontal }: { permissions: Permission[]; horizontal?: boolean }) {
  const pathname = usePathname();
  const links = STAFF_LINKS.filter((link) =>
    link.href === "/administration"
      ? permissions.includes("manage_users") || permissions.includes("manage_groups")
      : !link.permission || permissions.includes(link.permission)
  );

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
