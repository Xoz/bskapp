// Coach-only: lista över alla rapporterade händelser med möjlighet att ta bort
// felaktiga rader. Borttagning justerar både matchflödet och spelarens räknare.

import { STAT_FIELDS, CARD_FIELDS } from "@/lib/stats";
import { OPPONENT_GOAL, formatClock } from "@/lib/liveTypes";
import { deleteMatchEvent } from "@/lib/actions";
import ConfirmForm from "@/components/ConfirmForm";
import type { MatchEventRow } from "@/lib/queries";

const STAT_LABEL: Record<string, string> = {
  ...Object.fromEntries([...STAT_FIELDS, ...CARD_FIELDS].map((f) => [f.id, f.label])),
  [OPPONENT_GOAL]: "Motståndarmål",
};

function firstName(name: string) {
  return name.replace(/^Exempel:\s*/, "").split(" ")[0];
}

export default function EventEditor({
  events,
  matchId,
  reporters = {},
}: {
  events: MatchEventRow[];
  matchId: number;
  reporters?: Record<string, string>;
}) {
  // Senaste överst
  const ordered = [...events].reverse();

  return (
    <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
      {ordered.map((e) => {
        const who = e.stat_id === OPPONENT_GOAL ? "Motståndare" : e.player_name ? firstName(e.player_name) : "Laget";
        const reporter = reporters[e.stat_id];
        return (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <span
              className="stat-number shrink-0 text-[0.7rem] rounded-full px-2 py-0.5"
              style={{ background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}
            >
              {e.period ? `P${e.period} ` : ""}
              {e.match_second != null ? formatClock(e.match_second) : "–"}
            </span>
            <p className="min-w-0 flex-1 text-sm truncate">
              <span className="font-semibold">{who}</span>
              <span style={{ color: "var(--ink-soft)" }}> · {STAT_LABEL[e.stat_id] ?? e.stat_id}</span>
              {reporter && <span className="text-xs opacity-60"> · via {reporter}</span>}
            </p>
            <ConfirmForm
              action={deleteMatchEvent}
              message={`Ta bort: ${who} – ${STAT_LABEL[e.stat_id] ?? e.stat_id}?`}
              className="shrink-0"
            >
              <input type="hidden" name="event_id" value={e.id} />
              <input type="hidden" name="match_id" value={matchId} />
              <button
                type="submit"
                className="text-xs hover:underline cursor-pointer"
                style={{ color: "var(--danger)" }}
              >
                Ta bort
              </button>
            </ConfirmForm>
          </li>
        );
      })}
    </ul>
  );
}
