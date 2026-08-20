"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/lib/auth";
import { filterNavItems, isActive } from "@/lib/nav";

export default function BottomNav({
  permissions,
  staff = true,
}: {
  permissions: Permission[];
  staff?: boolean;
}) {
  const pathname = usePathname();
  const items = filterNavItems(permissions, true);
  const isFocusedEvaluation = /^\/matcher\/[^/]+\/utvardera\/?$/.test(pathname);

  if (!staff || items.length === 0 || isFocusedEvaluation) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {items.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center pt-2 pb-1.5 gap-1 transition-colors"
            style={{
              color: active ? "var(--primary)" : "var(--ink-muted)",
            }}
          >
            <Icon width={22} height={22} />
            <span
              className="caption font-semibold"
              style={{ fontSize: "11px", letterSpacing: "0.02em" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
