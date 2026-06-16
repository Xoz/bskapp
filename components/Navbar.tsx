import Link from "next/link";
import { getRealRole, getCoachName } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { logout } from "@/lib/actions";
import { IconLogout } from "@/components/Icons";
import NavLinks from "@/components/NavLinks";
import SettingsMenu from "@/components/SettingsMenu";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Navbar() {
  const [realRole, settings, coachName] = await Promise.all([
    getRealRole(),
    getAllSettings(),
    getCoachName(),
  ]);
  const role = realRole;

  const homeHref = realRole === "coach" ? "/oversikt" : "/";

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
        <Link href={homeHref} className="flex items-center shrink-0 mr-1">
          <span
            className="font-bold text-lg tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}
          >
            <span style={{ color: "var(--primary)" }}>+</span>
            <span style={{ color: "var(--ink)" }}>90</span>
          </span>
        </Link>

        {/* Navlänkar — visas på desktop */}
        <nav className="hidden md:flex flex-1 items-center gap-1">
          <NavLinks role={role} horizontal />
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {realRole === "coach" && coachName && (
            <span
              className="hidden sm:block text-sm font-medium px-2"
              style={{ color: "var(--ink-soft)" }}
            >
              {coachName.split(" ")[0]}
            </span>
          )}
          <ThemeToggle />
          {realRole === "coach" && <SettingsMenu />}
          {realRole && (
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
