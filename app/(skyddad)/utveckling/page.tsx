import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getTeamSkillOverview } from "@/lib/queries";
import { CATEGORIES } from "@/lib/skillTrappan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utvecklingsträd – laget" };

export default async function TeamSkillTreePage() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const overview = await getTeamSkillOverview();
  const byCategory = new Map(overview.map((o) => [o.category, o]));

  return (
    <div className="core-page max-w-4xl">
      <header className="core-header">
        <div className="core-header-copy">
        <p className="core-kicker">Laget</p>
        <h1 className="core-title">Utvecklingsträd</h1>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          Snitt per kategori över hela truppen. Öppna en spelare under{" "}
          <Link href="/spelare" className="underline" style={{ color: "var(--primary)" }}>
            Spelare
          </Link>{" "}
          för att se och uppdatera spelarens utvecklingsträd från 7v7 till 9v9.
        </p>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => {
          const row = byCategory.get(cat.id);
          const percent = row?.avgPercent ?? 0;
          const level = row?.avgLevel ?? 1;
          return (
            <div key={cat.id} className="core-panel p-4">
              <h2 className="font-semibold text-sm mb-2">{cat.name}</h2>
              <div className="flex items-center justify-between mb-2">
                <span className="level-meter">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= level ? "on" : ""} />
                  ))}
                </span>
                <span className="caption tabular-nums" style={{ color: "var(--ink-muted)" }}>{percent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--elevated)" }}>
                <div className="h-full rounded-full" style={{ width: `${percent}%`, background: "var(--primary)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
