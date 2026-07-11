"use client";

import { useEffect, useState } from "react";

// Tickande klocka som alltid visar svensk tid (Europe/Stockholm), oberoende av
// besökarens egna tidszon. Renderar en platshållare tills klienten hunnit ticka
// (undviker hydrerings-mismatch).
const TZ = "Europe/Stockholm";

export default function LiveClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("sv-SE", {
          timeZone: TZ,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tabular-nums ${className}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--ink-secondary)",
        fontFamily: "var(--font-display)",
      }}
      aria-label="Aktuell tid (svensk tid)"
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--live)" }}
      />
      <span suppressHydrationWarning>{time ?? "––:––:––"}</span>
    </div>
  );
}
