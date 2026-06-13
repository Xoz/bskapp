// Live score-flöde i klassisk matchtidslinje-stil: mittspine med matchtid,
// våra händelser till vänster, motståndarens mål till höger, periodavdelare
// och ställning efter varje mål. Ren komponent utan hooks – renderas både
// på servern (matchsidan) och i live-rapporteringen.

import { STAT_FIELDS } from "@/lib/stats";
import { OPPONENT_GOAL, formatClock } from "@/lib/liveTypes";
import {
  IconBall,
  IconSpark,
  IconTarget,
  IconArrowRight,
  IconShield,
  IconGlove,
} from "@/components/Icons";
import type { SVGProps } from "react";

export interface FeedEvent {
  id: number;
  player_name: string | null;
  stat_id: string;
  match_second: number | null;
  period: number | null;
}

const STAT_LABEL: Record<string, string> = Object.fromEntries(
  STAT_FIELDS.map((f) => [f.id, f.label])
);

const STAT_ICON: Record<string, (p: SVGProps<SVGSVGElement>) => React.ReactNode> = {
  goals: IconBall,
  [OPPONENT_GOAL]: IconBall,
  assists: IconSpark,
  shots: IconTarget,
  shots_on_target: IconTarget,
  passes_completed: IconArrowRight,
  interceptions: IconShield,
  saves: IconGlove,
};

function firstName(name: string) {
  return name.replace(/^Exempel:\s*/, "").split(" ")[0];
}

type Row =
  | { kind: "period"; key: string; period: number }
  | {
      kind: "event";
      key: string;
      event: FeedEvent;
      ourScore: number;
      oppScore: number;
      side: "us" | "them";
    };

// events i kronologisk ordning (äldst först)
function buildRows(events: FeedEvent[]): Row[] {
  const rows: Row[] = [];
  let our = 0;
  let opp = 0;
  let lastPeriod: number | null = null;

  for (const e of events) {
    if (e.period != null && e.period !== lastPeriod) {
      rows.push({ kind: "period", key: `p${e.period}`, period: e.period });
      lastPeriod = e.period;
    }
    if (e.stat_id === "goals") our++;
    if (e.stat_id === OPPONENT_GOAL) opp++;
    rows.push({
      kind: "event",
      key: `e${e.id}`,
      event: e,
      ourScore: our,
      oppScore: opp,
      side: e.stat_id === OPPONENT_GOAL ? "them" : "us",
    });
  }
  // Live-känsla: senaste överst
  return rows.reverse();
}

function EventCard({
  row,
  opponent,
  reporters,
}: {
  row: Extract<Row, { kind: "event" }>;
  opponent: string;
  reporters: Record<string, string>;
}) {
  const { event: e, side } = row;
  const isGoal = e.stat_id === "goals" || e.stat_id === OPPONENT_GOAL;
  const Icon = STAT_ICON[e.stat_id] ?? IconTarget;
  const reporter = reporters[e.stat_id];

  if (isGoal) {
    const ourGoal = side === "us";
    return (
      <div
        className="rounded-2xl px-3.5 py-2.5"
        style={{
          background: ourGoal ? "var(--primary)" : "var(--bg3)",
          border: ourGoal ? "1px solid transparent" : "1px solid var(--coral)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{
              background: ourGoal ? "var(--primary-deep)" : "var(--coral-dim)",
              color: ourGoal ? "var(--primary)" : "var(--coral)",
            }}
          >
            <Icon width={15} height={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="text-[0.7rem] font-bold uppercase tracking-[0.1em] leading-none"
              style={{
                fontFamily: "var(--font-display)",
                color: ourGoal ? "var(--primary-deep)" : "var(--coral)",
              }}
            >
              Mål!
            </p>
            <p
              className="truncate text-sm font-semibold mt-0.5"
              style={{ color: ourGoal ? "var(--primary-deep)" : "var(--ink)" }}
            >
              {ourGoal ? (e.player_name ? firstName(e.player_name) : "Vi") : opponent}
            </p>
            {reporter && (
              <p className="text-[0.65rem] mt-0.5 opacity-60" style={{ color: ourGoal ? "var(--primary-deep)" : "var(--ink)" }}>
                via {reporter}
              </p>
            )}
          </div>
          <span
            className="stat-number ml-auto text-lg whitespace-nowrap"
            style={{ color: ourGoal ? "var(--primary-deep)" : "var(--ink)" }}
          >
            {row.ourScore}–{row.oppScore}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl px-3.5 py-2 flex items-center gap-2"
      style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        <Icon width={13} height={13} />
      </span>
      <p className="min-w-0 truncate text-sm">
        <span className="font-semibold">
          {e.player_name ? firstName(e.player_name) : "Laget"}
        </span>
        <span className="block text-xs leading-tight" style={{ color: "var(--ink-soft)" }}>
          {STAT_LABEL[e.stat_id] ?? e.stat_id}
          {reporter && <span className="opacity-60"> · via {reporter}</span>}
        </span>
      </p>
    </div>
  );
}

export default function LiveFeed({
  events,
  opponent,
  reporters = {},
  emptyText = "Inga händelser ännu – flödet fylls på när matchen börjar.",
}: {
  events: FeedEvent[];
  opponent: string;
  reporters?: Record<string, string>;
  emptyText?: string;
}) {
  const rows = buildRows(events);

  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed p-6 text-center text-sm"
        style={{ borderColor: "var(--line-strong)", color: "var(--ink-soft)" }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Mittspine */}
      <div
        className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2"
        style={{ background: "var(--line-strong)" }}
        aria-hidden
      />
      <ul className="space-y-2.5 relative">
        {rows.map((row) => {
          if (row.kind === "period") {
            return (
              <li key={row.key} className="flex justify-center py-1.5">
                <span
                  className="badge relative"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-deep)",
                    boxShadow: "0 0 0 4px var(--bg)",
                  }}
                >
                  Period {row.period}
                </span>
              </li>
            );
          }
          const time = (
            <span
              className="stat-number relative z-10 flex h-7 min-w-12 items-center justify-center rounded-full px-1.5 text-[0.7rem]"
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--line-strong)",
                color: "var(--ink-soft)",
                boxShadow: "0 0 0 3px var(--bg)",
              }}
            >
              {row.event.match_second != null ? formatClock(row.event.match_second) : "–"}
            </span>
          );
          return (
            <li key={row.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div>{row.side === "us" && <EventCard row={row} opponent={opponent} reporters={reporters} />}</div>
              {time}
              <div>{row.side === "them" && <EventCard row={row} opponent={opponent} reporters={reporters} />}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
