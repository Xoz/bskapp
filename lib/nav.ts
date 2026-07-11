import {
  IconOverview,
  IconPlayers,
  IconPitch,
  IconChart,
  IconBook,
} from "@/components/Icons";
import type { Permission } from "@/lib/auth";
import { FEATURES } from "@/lib/features";

export interface NavItem {
  href: string;
  label: string;
  Icon: typeof IconOverview;
  permission?: Permission;
  /** Special-behörighet för Administration (ska synas om man har någon av dessa) */
  permissionAny?: Permission[];
}

/**
 * Enda källan för navigationslänkar. Används av både NavLinks (desktop)
 * och BottomNav (mobil). Eliminerar duplicering av nav-config.
 *
 * "Administration" och "Guide" visas inte i BottomNav (desktop-only / sekundärt).
 * Det styrs via `desktopOnly`-flaggan.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/oversikt", label: "Översikt", Icon: IconOverview },
  { href: "/spelare", label: "Spelare", Icon: IconPlayers, permission: "view_players" },
  { href: "/matcher", label: "Matcher", Icon: IconPitch, permission: "view_matches" },
  { href: "/statistik", label: "Statistik", Icon: IconChart, permission: "view_statistics" },
  {
    href: "/administration",
    label: "Administration",
    Icon: IconPlayers,
    permissionAny: ["manage_users", "manage_groups"],
    desktopOnly: true,
  } as NavItem & { desktopOnly: true },
  { href: "/guide", label: "Guide", Icon: IconBook, desktopOnly: true } as NavItem & { desktopOnly: true },
];

/**
 * Filtrera nav-items efter behörigheter.
 * `mobile` = true exkluderar desktopOnly-items.
 */
export function filterNavItems(
  permissions: Permission[],
  mobile = false
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    // Göm funktioner som är avstängda via feature-flags
    if (item.href === "/matcher" && !FEATURES.matchStats) return false;
    if (item.href === "/statistik" && !FEATURES.matchStats) return false;

    if (mobile && (item as NavItem & { desktopOnly?: boolean }).desktopOnly) {
      return false;
    }
    if (item.permissionAny) {
      return item.permissionAny.some((p) => permissions.includes(p));
    }
    return !item.permission || permissions.includes(item.permission);
  });
}

/**
 * Kontrollera om en path är aktiv för en given href.
 * /oversikt och / är exakta matchningar; övriga använder startsWith.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/oversikt" || href === "/") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href);
}
