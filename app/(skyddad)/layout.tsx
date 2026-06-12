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

  const settings = getAllSettings();

  const crest = (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black"
      style={{
        background: "linear-gradient(150deg, color-mix(in srgb, var(--accent), #fff 25%), var(--accent))",
        color: "var(--primary-deep)",
        fontFamily: "var(--font-display)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 10px -4px rgba(0,0,0,0.5)",
      }}
    >
      {settings.club_name?.slice(0, 1) || "B"}
    </div>
  );

  return (
    <div className="flex flex-1 min-h-screen">
      <aside
        className="hidden md:flex w-64 flex-col p-4 sticky top-0 h-screen relative overflow-hidden"
        style={{
          background:
            "radial-gradient(500px 280px at 120% 0%, color-mix(in srgb, var(--accent), transparent 90%), transparent 60%), linear-gradient(170deg, var(--primary-dark), var(--primary-deep) 70%)",
        }}
      >
        <PitchLines className="pointer-events-none absolute -bottom-24 -right-20 w-64 text-white/[0.05]" />

        <div className="flex items-center gap-3 px-2 py-3 mb-6 relative">
          {crest}
          <div className="min-w-0">
            <p
              className="truncate font-bold text-white leading-tight"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
            >
              {settings.team_name}
            </p>
            <p className="truncate text-xs text-white/50">{settings.club_name}</p>
          </div>
        </div>

        <p className="eyebrow px-3 mb-2 text-white/35">Meny</p>
        <NavLinks role={role} />

        <div className="mt-auto pt-4 relative">
          <div
            className="rounded-2xl p-3.5 mb-3"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="eyebrow text-white/40 mb-1">Säsong {settings.season}</p>
            <p className="text-xs text-white/65 leading-relaxed">
              Inloggad som{" "}
              <span className="font-semibold text-white">
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
          className="md:hidden flex items-center justify-between px-4 py-3"
          style={{ background: "linear-gradient(170deg, var(--primary-dark), var(--primary-deep))" }}
        >
          <div className="flex items-center gap-2.5">
            {crest}
            <p className="font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {settings.team_name}
            </p>
          </div>
          <form action={logout}>
            <button className="text-sm text-white/70 flex items-center gap-1.5" type="submit">
              <IconLogout width={15} height={15} /> Logga ut
            </button>
          </form>
        </header>
        <div className="md:hidden overflow-x-auto" style={{ background: "var(--primary-deep)" }}>
          <div className="flex gap-1 px-2 py-2 min-w-max">
            <NavLinks role={role} horizontal />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-10 max-w-6xl w-full mx-auto rise">{children}</main>
      </div>
    </div>
  );
}
