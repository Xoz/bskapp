import Link from "next/link";
import { getCurrentUser, getCoachName, isStaffRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { logout } from "@/lib/actions";
import { IconLogout } from "@/components/Icons";
import { Logo90Mark } from "@/components/Logo90";
import NavLinks from "@/components/NavLinks";
import SettingsMenu from "@/components/SettingsMenu";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Navbar() {
  const [user, settings, coachName] = await Promise.all([
    getCurrentUser(),
    getAllSettings(),
    getCoachName(),
  ]);
  const isStaff = !!user && isStaffRole(user.primaryRole);
  const homeHref = isStaff ? "/oversikt" : user ? "/mina-spelare" : "/";

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--bg-nav)",
        borderBottom: "1px solid var(--line)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Huvudrad */}
      <div className="flex items-center h-14 px-4 gap-3">
        <Link href={homeHref} className="flex items-center gap-2 shrink-0 mr-1">
          <Logo90Mark size={22} />
          <span
            className="font-bold text-lg tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}
          >
            <span style={{ color: "var(--primary-fg)" }}>+</span>
            <span style={{ color: "var(--ink)" }}>90</span>
          </span>
        </Link>

        {/* Navlänkar — visas på desktop */}
        {isStaff && <nav className="hidden md:flex flex-1 items-center gap-1"><NavLinks permissions={user?.permissions ?? []} horizontal /></nav>}

        <div className="ml-auto flex items-center gap-1">
          {isStaff && coachName && (
            <span
              className="hidden sm:block text-sm font-medium px-2"
              style={{ color: "var(--ink-soft)" }}
            >
              {coachName.split(" ")[0]}
            </span>
          )}
          <ThemeToggle />
          {user?.permissions.includes("manage_settings") && <SettingsMenu />}
          {user && (
            <form action={logout}>
              <button
                type="submit"
                title="Logga ut"
                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg2)]"
                style={{ color: "var(--ink-faint)" }}
              >
                <IconLogout width={15} height={15} />
              </button>
            </form>
          )}
        </div>
      </div>

    </header>
  );
}
