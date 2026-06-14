import Link from "next/link";
import { getRealRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { logout } from "@/lib/actions";
import { IconLogout } from "@/components/Icons";
import NavLinks from "@/components/NavLinks";

export default async function Navbar() {
  const [realRole, settings] = await Promise.all([
    getRealRole(),
    getAllSettings(),
  ]);
  const role = realRole;

  const homeHref = realRole === "coach" ? "/oversikt" : realRole === "parent" ? "/matcher" : "/";

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
        <Link href={homeHref} className="flex items-center gap-2.5 shrink-0 mr-1">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold"
            style={{
              background: "var(--primary)",
              color: "var(--primary-deep)",
              fontFamily: "var(--font-display)",
              borderRadius: "6px",
            }}
          >
            {settings.club_name?.slice(0, 1) || "B"}
          </div>
          <span
            className="hidden sm:block font-semibold text-sm"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)", letterSpacing: "-0.3px" }}
          >
            {settings.team_name}
          </span>
        </Link>

        {/* Navlänkar — visas på desktop */}
        <nav className="hidden md:flex flex-1 items-center gap-1">
          <NavLinks role={role} horizontal />
        </nav>

        <div className="ml-auto flex items-center gap-2">
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
