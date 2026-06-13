import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import { getMatch, getPlayersLevelInfo, getMatchSquad } from "@/lib/queries";
import { LEVELS, level as levelInfo, suggestLevel, fit, type Fit } from "@/lib/levels";
import { setMatchLevel, saveSquad } from "@/lib/actions";
import Avatar from "@/components/Avatar";
import { positionLabel } from "@/lib/positions";
import { IconArrowLeft } from "@/components/Icons";

export const dynamic = "force-dynamic";

const TONE_STYLE: Record<Fit["tone"], { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  warn: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  danger: { bg: "var(--coral-dim, var(--warn-bg))", fg: "var(--coral, var(--danger))" },
  neutral: { bg: "var(--bg2)", fg: "var(--ink-soft)" },
};

export default async function SquadPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (role !== "coach") redirect("/matcher");

  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const [playersInfo, squadIds] = await Promise.all([
    getPlayersLevelInfo(),
    getMatchSquad(match.id),
  ]);
  const squad = new Set(squadIds);
  const mLevel = levelInfo(match.level);

  // Bygg rader med passform och gruppera
  const rows = playersInfo.map((p) => ({
    p,
    fit: fit(p.level, match.level),
    suggested: suggestLevel(p.eval_avg),
  }));
  rows.sort((a, b) => a.fit.order - b.fit.order || a.p.name.localeCompare(b.p.name, "sv"));

  // Gruppera på fit.key i ordningsföljd
  const groupOrder: string[] = [];
  const groups = new Map<string, { fit: Fit; rows: typeof rows }>();
  for (const r of rows) {
    if (!groups.has(r.fit.key)) {
      groups.set(r.fit.key, { fit: r.fit, rows: [] });
      groupOrder.push(r.fit.key);
    }
    groups.get(r.fit.key)!.rows.push(r);
  }

  const recommendedCount = rows.filter((r) => r.fit.key === "fit" || r.fit.key === "challenge").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href={`/matcher/${match.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Tillbaka till matchen
        </Link>
        <h1 className="text-[1.6rem] font-bold mt-2">Laguttagning</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {match.home_away === "home" ? "Hemma mot" : "Borta mot"} {match.opponent} · {match.date}
          {match.start_time ? ` · ${match.start_time}` : ""}
        </p>
      </div>

      {/* Matchnivå – sätts/ändras här */}
      <form action={setMatchLevel} className="card p-5 flex items-end gap-4 flex-wrap" style={{ background: "var(--primary-ghost)" }}>
        <input type="hidden" name="id" value={match.id} />
        <div className="flex-1 min-w-48">
          <label className="label" htmlFor="level">Matchens svårighetsnivå</label>
          <select id="level" name="level" defaultValue={match.level ?? ""} className="input">
            <option value="">Ej satt</option>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Spara nivå</button>
      </form>

      {!mLevel ? (
        <div className="card p-6 text-sm" style={{ color: "var(--ink-soft)" }}>
          Sätt matchens svårighetsnivå ovan så grupperar appen spelarna efter hur de passar.
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          Matchnivå: <strong style={{ color: mLevel.color }}>{mLevel.label}</strong> ·{" "}
          {recommendedCount} spelare passar bra eller kan utmanas.
        </p>
      )}

      <form action={saveSquad} className="space-y-5">
        <input type="hidden" name="match_id" value={match.id} />

        {groupOrder.map((key) => {
          const g = groups.get(key)!;
          const tone = TONE_STYLE[g.fit.tone];
          return (
            <div key={key} className="card overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="badge" style={{ background: tone.bg, color: tone.fg }}>{g.fit.label}</span>
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{g.fit.hint}</span>
                </div>
                <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{g.rows.length} st</span>
              </div>
              <ul>
                {g.rows.map(({ p, suggested }) => {
                  const pLevel = levelInfo(p.level);
                  const checked = squad.has(p.id);
                  return (
                    <li key={p.id} style={{ borderTop: "1px solid var(--line)" }} className="first:border-t-0">
                      <label className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-[var(--primary-ghost)]">
                        <input
                          type="checkbox"
                          name="player_id"
                          value={p.id}
                          defaultChecked={checked}
                          className="h-5 w-5 rounded accent-[var(--primary)] shrink-0"
                        />
                        <Avatar name={p.name} jersey={p.jersey_number} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium truncate">{p.name.replace(/^Exempel:\s*/, "")}</span>
                          <span className="block text-xs" style={{ color: "var(--ink-faint)" }}>
                            {positionLabel(p.position) ?? "Position ej satt"}
                          </span>
                        </span>
                        {pLevel ? (
                          <span className="badge shrink-0" style={{ background: "var(--bg2)", color: pLevel.color }}>
                            {pLevel.short}
                          </span>
                        ) : suggested ? (
                          <span className="text-xs shrink-0 italic" style={{ color: "var(--ink-faint)" }}>
                            förslag: {suggested.short}
                          </span>
                        ) : (
                          <span className="text-xs shrink-0" style={{ color: "var(--ink-faint)" }}>–</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {playersInfo.length === 0 ? (
          <div className="card p-6 text-sm" style={{ color: "var(--ink-soft)" }}>
            Inga aktiva spelare i truppen ännu.
          </div>
        ) : (
          <div className="flex gap-3">
            <button type="submit" className="btn-primary px-6">Spara trupp</button>
            <Link href={`/matcher/${match.id}`} className="btn-secondary">Avbryt</Link>
          </div>
        )}
      </form>

      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
        Spelnivån sätts per spelare under deras profil – med förslag från SvFF-utvärderingen. Ändrar
        du matchnivån grupperas listan om.
      </p>
    </div>
  );
}
