// Visas i rapporteringsvyn när matchen ingår i en cup – listar alla cupens
// matcher så rapportören snabbt kan hoppa mellan dem (samma trupp, flera dagar).

import Link from "next/link";
import type { Match } from "@/lib/queries";

function statusLabel(m: Match): { text: string; tone: "live" | "done" | "soon" } {
  if (m.finished) {
    const hasResult = m.our_score != null && m.opponent_score != null;
    return { text: hasResult ? `${m.our_score}–${m.opponent_score}` : "Avslutad", tone: "done" };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (m.date > today) {
    return { text: m.start_time ?? "Senare", tone: "soon" };
  }
  return { text: m.start_time ?? "Öppen", tone: "live" };
}

export default function CupReportSwitcher({
  cupName,
  matches,
  currentCode,
}: {
  cupName: string;
  matches: Match[];
  currentCode: string;
}) {
  if (matches.length < 2) return null;

  return (
    <div className="max-w-md mx-auto px-4 pt-2">
      <div className="rounded-2xl p-3" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
        <p className="text-[0.7rem] font-semibold px-1 mb-2 flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}>
          🏆 {cupName} · {matches.length} matcher
        </p>
        <div className="space-y-1.5">
          {matches.map((m) => {
            const isCurrent = m.code === currentCode;
            const st = statusLabel(m);
            // Bara den match man faktiskt rapporterar just nu (och som inte är
            // avslutad) markeras som pågående – annars visas matchens status.
            const showLive = isCurrent && !m.finished;
            const toneColor =
              st.tone === "done" ? "var(--ok)" : st.tone === "soon" ? "var(--ink-faint)" : "var(--primary)";
            return (
              <Link
                key={m.id}
                href={`/rapportera/${m.code}`}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-opacity hover:opacity-80"
                style={
                  isCurrent
                    ? { background: "var(--primary)", color: "var(--primary-deep)" }
                    : { background: "var(--bg3)", color: "var(--ink)" }
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">
                    {m.home_away === "home" ? "Hemma" : "Borta"} mot {m.opponent}
                  </span>
                  <span
                    className="block text-[0.65rem] mt-0.5"
                    style={{ color: isCurrent ? "var(--primary-deep)" : "var(--ink-faint)", opacity: isCurrent ? 0.7 : 1 }}
                  >
                    {m.date}
                  </span>
                </span>
                <span
                  className="stat-number text-xs shrink-0"
                  style={{ color: isCurrent ? "var(--primary-deep)" : toneColor }}
                >
                  {showLive ? "● pågår" : st.text}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
