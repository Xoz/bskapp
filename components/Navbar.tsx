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
  const homeHref = isStaff ? "/idag" : user ? "/mina-spelare" : "/";

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        paddingTop: "env(safe-area-inset-top)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Huvudrad */}
      <div className="flex items-center h-14 px-4 md:px-6 gap-3">
        <Link href={homeHref} className="flex items-center gap-2 shrink-0 mr-1">
          <Logo90Mark size={22} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "24px",
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            <span style={{ color: "var(--primary)" }}>+</span>
            <span style={{ color: "var(--ink)" }}>90</span>
          </span>
        </Link>

        {/* Navlänkar — visas på desktop */}
        {isStaff && (
          <nav className="hidden md:flex flex-1 items-center gap-1">
            <NavLinks permissions={user?.permissions ?? []} horizontal />
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isStaff && coachName && (
            <span
              className="hidden sm:block body-small font-medium px-2"
              style={{ color: "var(--ink-secondary)" }}
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
                aria-label="Logga ut"
                className="icon-btn"
                style={{ width: 32, height: 32 }}
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
