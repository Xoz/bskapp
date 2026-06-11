import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import {
  getPlayers,
  getMatches,
  getSeasonStats,
  getLatestEvaluationDates,
  countEvaluations,
} from "@/lib/queries";
import { SVFF_PRINCIPLES, GAME_FORMAT } from "@/lib/svff";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const settings = getAllSettings();
  const players = getPlayers();
  const matches = getMatches();
  const stats = getSeasonStats();
  const latestEvals = getLatestEvaluationDates();
  const totalEvals = countEvaluations();

  // Spelare som inte utvärderats på 60 dagar (eller aldrig)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const needsEval = players.filter((p) => !latestEvals[p.id] || latestEvals[p.id] < cutoffStr);

  // Jämn speltid – avvikelse från snittet
  const withMinutes = stats.filter((s) => s.total_minutes > 0);
  const avgMinutes =
    withMinutes.length > 0
      ? withMinutes.reduce((a, b) => a + b.total_minutes, 0) / withMinutes.length
      : 0;
  const lowPlaytime = stats.filter(
    (s) => avgMinutes > 0 && s.total_minutes < avgMinutes * 0.75
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Översikt</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Säsong {settings.season} · Spelform {GAME_FORMAT.format} · {GAME_FORMAT.periods}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Spelare i truppen", value: players.length, href: "/spelare" },
          { label: "Matcher", value: matches.length, href: "/matcher" },
          { label: "Utvärderingar", value: totalEvals, href: "/spelare" },
          {
            label: "Att utvärdera",
            value: needsEval.length,
            href: "/spelare",
            warn: needsEval.length > 0,
          },
        ].map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="card p-5 hover:shadow-md transition-shadow">
            <p
              className="text-3xl font-bold"
              style={{ color: kpi.warn ? "#d97706" : "var(--primary)" }}
            >
              {kpi.value}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              {kpi.label}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Dags att utvärdera</h2>
            <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
              60+ dagar sedan
            </span>
          </div>
          {needsEval.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Alla spelare har en aktuell utvärdering. Bra jobbat! 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {needsEval.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/spelare/${p.id}/utvardera`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
                      {latestEvals[p.id] ? `Senast ${latestEvals[p.id]}` : "Aldrig utvärderad"} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Jämn speltid</h2>
            <Link href="/statistik" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
              Visa allt →
            </Link>
          </div>
          {avgMinutes === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Registrera matchstatistik så ser du speltidsfördelningen här – enligt SvFF ska alla
              spela lika mycket.
            </p>
          ) : lowPlaytime.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Speltiden är jämnt fördelad i truppen. 👍
            </p>
          ) : (
            <>
              <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
                Dessa spelare ligger under 75 % av lagets snitt ({Math.round(avgMinutes)} min):
              </p>
              <ul className="space-y-2">
                {lowPlaytime.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm font-semibold text-amber-700">{p.total_minutes} min</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">SvFF:s riktlinjer som appen bygger på</h2>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {SVFF_PRINCIPLES.map((p) => (
            <li key={p} className="flex gap-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              <span style={{ color: "var(--primary)" }}>✓</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
