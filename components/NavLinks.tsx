"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/lib/auth";
import { filterNavItems, isActive } from "@/lib/nav";

export default function NavLinks({
  permissions,
  horizontal,
}: {
  permissions: Permission[];
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const links = filterNavItems(permissions, false);

  return (
    <nav className={horizontal ? "flex gap-1" : "flex flex-col gap-1"}>
      {links.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
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
