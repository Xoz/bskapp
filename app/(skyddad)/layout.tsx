import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { logout } from "@/lib/actions";
import NavLinks from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (!role) redirect("/login");

  const settings = getAllSettings();

  return (
    <div className="flex flex-1 min-h-screen">
      <aside
        className="hidden md:flex w-64 flex-col p-4 sticky top-0 h-screen"
        style={{ background: "var(--primary)" }}
      >
        <div className="flex items-center gap-3 px-2 py-3 mb-6">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black"
            style={{ background: "var(--accent)", color: "var(--primary)" }}
          >
            {settings.club_name?.slice(0, 1) || "B"}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-white leading-tight">{settings.team_name}</p>
            <p className="truncate text-xs text-white/60">{settings.club_name}</p>
          </div>
        </div>

        <NavLinks role={role} />

        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="px-3 pb-2 text-xs text-white/50">
            Inloggad som {role === "coach" ? "tränare" : "förälder"}
          </p>
          <form action={logout}>
            <button className="nav-link w-full text-left cursor-pointer" type="submit">
              <span aria-hidden>↩</span> Logga ut
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobilmeny */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3"
          style={{ background: "var(--primary)" }}
        >
          <p className="font-bold text-white">{settings.team_name}</p>
          <form action={logout}>
            <button className="text-sm text-white/70" type="submit">
              Logga ut
            </button>
          </form>
        </header>
        <div className="md:hidden overflow-x-auto" style={{ background: "var(--primary-dark)" }}>
          <div className="flex gap-1 px-2 py-2 min-w-max">
            <NavLinks role={role} horizontal />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
