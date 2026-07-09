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
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="eyebrow mb-1">Laget</p>
        <h1 className="text-2xl font-bold">Utvecklingsträd 7v7 → 9v9</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Snitt per kategori över hela truppen. Öppna en spelare under{" "}
          <Link href="/spelare" className="underline" style={{ color: "var(--primary-fg)" }}>
            Spelare
          </Link>{" "}
          för att se och redigera individuell checklista.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => {
          const row = byCategory.get(cat.id);
          const percent = row?.avgPercent ?? 0;
          const level = row?.avgLevel ?? 1;
          return (
            <div key={cat.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{cat.icon}</span>
                <h2 className="font-semibold text-sm">{cat.name}</h2>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="level-meter">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= level ? "on" : ""} />
                  ))}
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>{percent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--bg3)" }}>
                <div className="h-full rounded-full" style={{ width: `${percent}%`, background: cat.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
