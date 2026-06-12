import { STAT_FIELDS } from "@/lib/stats";
import { OPPONENT_GOAL } from "@/lib/liveTypes";
import type { MatchEventRow } from "@/lib/queries";
import Avatar from "@/components/Avatar";

const STAT_LABEL: Record<string, string> = Object.fromEntries(
  STAT_FIELDS.map((f) => [f.id, f.label])
);
STAT_LABEL[OPPONENT_GOAL] = "Mål motståndare";

function formatTime(totalSeconds: number) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Tidslinje över matchhändelser – matchtiden gör det lätt att hitta i videon
export default function EventTimeline({ events }: { events: MatchEventRow[] }) {
  if (events.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
        <h2 className="font-semibold">Händelser</h2>
        <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
          Live-rapporterade händelser med matchtid – använd tiderna för att hitta rätt i
          matchvideon.
        </p>
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
        {events.map((e) => (
          <li key={e.id} className="px-6 py-2.5 flex items-center gap-3 text-sm" style={{ borderColor: "var(--line)" }}>
            <span className="stat-number w-14 shrink-0" style={{ color: e.stat_id === "goals" || e.stat_id === OPPONENT_GOAL ? "var(--primary)" : "var(--ink-faint)" }}>
              {e.match_second != null ? formatTime(e.match_second) : "–"}
            </span>
            {e.player_name ? (
              <span className="flex items-center gap-2.5 flex-1 min-w-0">
                <Avatar name={e.player_name} size={26} />
                <span className="truncate font-medium">{e.player_name}</span>
              </span>
            ) : (
              <span className="flex-1" style={{ color: "var(--ink-soft)" }}>
                Motståndaren
              </span>
            )}
            <span
              className={e.stat_id === "goals" || e.stat_id === OPPONENT_GOAL ? "badge" : ""}
              style={
                e.stat_id === "goals"
                  ? { background: "var(--ok-bg)", color: "var(--ok)" }
                  : e.stat_id === OPPONENT_GOAL
                    ? { background: "var(--warn-bg)", color: "var(--warn)" }
                    : { color: "var(--ink-soft)" }
              }
            >
              {STAT_LABEL[e.stat_id] ?? e.stat_id}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
