import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { logout } from "@/lib/actions";
import NavLinks from "@/components/NavLinks";
import PitchLines from "@/components/PitchLines";
import { IconLogout } from "@/components/Icons";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (!role) redirect("/login");

  const settings = await getAllSettings();

  const crest = (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center text-base font-bold"
      style={{
        background: "var(--primary)",
        color: "var(--primary-deep)",
        fontFamily: "var(--font-display)",
        borderRadius: "6px",
      }}
    >
      {settings.club_name?.slice(0, 1) || "B"}
    </div>
  );

  return (
    <div className="flex flex-1 min-h-screen">
      <aside
        className="hidden md:flex w-60 flex-col p-4 sticky top-0 h-screen relative overflow-hidden"
        style={{ background: "var(--bg-nav)", borderRight: "1px solid var(--line)" }}
      >
        <PitchLines className="pointer-events-none absolute -bottom-24 -right-20 w-64 text-white/[0.03]" />

        <div className="flex items-center gap-3 px-2 py-3 mb-6 relative">
          {crest}
          <div className="min-w-0">
            <p
              className="truncate font-semibold leading-tight text-sm"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)", letterSpacing: "-0.3px" }}
            >
              {settings.team_name}
            </p>
            <p className="truncate text-[0.625rem]" style={{ color: "var(--ink-faint)" }}>
              {settings.club_name}
            </p>
          </div>
        </div>

        <p className="eyebrow px-3 mb-2">Meny</p>
        <NavLinks role={role} />

        <div className="mt-auto pt-4 relative">
          <div
            className="p-3.5 mb-3"
            style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
          >
            <p className="eyebrow mb-1">Säsong {settings.season}</p>
            <p className="text-[0.6875rem] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Inloggad som{" "}
              <span style={{ color: "var(--ink)" }}>
                {role === "coach" ? "tränare" : "förälder"}
              </span>
            </p>
          </div>
          <form action={logout}>
            <button className="nav-link w-full text-left cursor-pointer" type="submit">
              <IconLogout />
              Logga ut
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobilmeny */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-2.5"
          style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-2.5">
            {crest}
            <p
              className="font-semibold text-sm"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
            >
              {settings.team_name}
            </p>
          </div>
          <form action={logout}>
            <button
              className="text-[0.6875rem] uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: "var(--ink-faint)" }}
              type="submit"
            >
              <IconLogout width={13} height={13} /> Logga ut
            </button>
          </form>
        </header>
        <div
          className="md:hidden overflow-x-auto"
          style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex gap-1 px-2 py-1.5 min-w-max">
            <NavLinks role={role} horizontal />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto rise">{children}</main>
      </div>
    </div>
  );
}
