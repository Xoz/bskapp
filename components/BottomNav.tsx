"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/lib/auth";
import { filterNavItems, isActive } from "@/lib/nav";

export default function BottomNav({ permissions, staff = true }: { permissions: Permission[]; staff?: boolean }) {
  const pathname = usePathname();
  const items = filterNavItems(permissions, true);
  const isFocusedEvaluation = /^\/matcher\/[^/]+\/utvardera\/?$/.test(pathname);
  if (!staff || items.length === 0 || isFocusedEvaluation) return null;
  return <nav className="bsk-bottom-nav" aria-label="Huvudnavigation">{items.map(({ href, label, Icon }) =>
    <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}><Icon width={22} height={22} /><span>{label}</span></Link>
  )}</nav>;
}
