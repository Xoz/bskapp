import {
  IconOverview,
  IconPlayers,
  IconPitch,
  IconChart,
} from "@/components/Icons";
import type { Permission } from "@/lib/auth";

export interface NavItem {
  href: string;
  label: string;
  Icon: typeof IconOverview;
  permission?: Permission;
}

/**
 * Enda källan för navigationslänkar. Används av både NavLinks (desktop)
 * och BottomNav (mobil). Eliminerar duplicering av nav-config.
 *
 * Produktens fyra primära arbetsytor. Kalender, matchadministration och statistik
 * är sekundära verktyg och ska inte konkurrera om huvudnavigationen.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/idag", label: "Idag", Icon: IconOverview },
  { href: "/observera", label: "Observera", Icon: IconChart, permission: "manage_evaluations" },
  { href: "/spelare", label: "Spelare", Icon: IconPlayers, permission: "view_players" },
  { href: "/uttagning", label: "Uttagning", Icon: IconPitch, permission: "manage_squads" },
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
    void mobile;
    return !item.permission || permissions.includes(item.permission);
  });
}

/**
 * Kontrollera om en path är aktiv för en given href.
 * /idag och / är exakta matchningar; övriga använder startsWith.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/idag" || href === "/") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href);
}
