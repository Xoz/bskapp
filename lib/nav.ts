import {
  IconOverview,
  IconPlayers,
  IconPitch,
  IconWhistle,
} from "../components/Icons";
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
 * Fyra arbetsytor. Uttagning och uppföljning hör till Matcher.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/idag", label: "Idag", Icon: IconOverview },
  { href: "/spelare", label: "Spelare", Icon: IconPlayers, permission: "view_players" },
  { href: "/matcher", label: "Matcher", Icon: IconPitch },
  { href: "/traning", label: "Träning", Icon: IconWhistle, permission: "manage_evaluations" },
];

/**
 * Filtrera nav-items efter behörigheter.
 * Samma arbetsytor på mobil och större skärmar.
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
 * Undersidor markeras inom sitt område. Äldre matchlänkar hör till Matcher.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/idag" || href === "/") {
    return pathname === href;
  }
  if (href === "/matcher" && ["/uttagning", "/observera"].includes(pathname)) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
