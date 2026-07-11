"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LiveState } from "@/lib/liveTypes";
import { formatClock } from "@/lib/liveTypes";
import LiveFeed from "@/components/LiveFeed";

// Publik, read-only Livescore. Pollar serverns live-state och visar ställning,
// klocka och händelseflöde. Ingen inloggning krävs.
export default function LiveScoreboard({
  matchId,
  initial,
  homeAway,
  opponent,
}: {
  matchId: number;
  initial: LiveState;
  homeAway: string;
  opponent: string;
}) {
  const [live, setLive] = useState(initial);
  const fetchedAt = useRef(Date.now());
  const [, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/live/${matchId}`, { cache: "no-store" });
        if (res.ok && active) {
          setLive(await res.json());
          fetchedAt.current = Date.now();
        }
      } catch {
        /* offline – behåll senaste */
      }
    }
    const id = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [matchId]);

  // Lokal sekundvisare mellan pollningar
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const clockNow =
    live.clockSeconds + (live.clockRunning ? (Date.now() - fetchedAt.current) / 1000 : 0);
  const home = homeAway === "home";

  return (
    <div className="space-y-5">
      {/* Resultattavla */}
      <div className="card p-6" style={{ background: "var(--primary-deep, #0a0b0d)" }}>
        <div className="flex items-center justify-center gap-4 text-white">
          <div className="flex-1 text-right min-w-0">
            <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
              {home ? "BSK" : opponent}
            </p>
          </div>
          <div className="shrink-0 text-center">
            <p className="stat-number text-4xl leading-none tabular-nums">
              {home ? live.ourScore : live.oppScore}
              <span className="opacity-40 px-1.5">–</span>
              {home ? live.oppScore : live.ourScore}
            </p>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
              {home ? opponent : "BSK"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-white/70 text-sm">
          {live.finished ? (
            <span className="badge" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
              Slutförd
            </span>
          ) : (
            <>
              <span
                className="stat-number tabular-nums text-lg"
                style={{ color: live.clockRunning ? "var(--accent)" : "rgba(255,255,255,0.7)" }}
              >
                {formatClock(clockNow)}
              </span>
              <span className="caption uppercase tracking-[0.1em]">
                Period {live.period} av {live.periods}
              </span>
              {live.clockRunning && (
                <span className="flex h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Rapportera-knapp – bara när tränaren öppnat rapportering */}
      {live.reportOpen && !live.finished && (
        <Link
          href={`/live/${matchId}/rapportera`}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          📋 Hjälp till att rapportera
        </Link>
      )}

      {/* Händelseflöde */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Matchflöde</h2>
        <LiveFeed events={[...live.events].reverse()} opponent={opponent} />
      </div>
    </div>
  );
}
