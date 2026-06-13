"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STAT_FIELDS } from "@/lib/stats";
import {
  LiveState,
  LiveAction,
  Reporter,
  OPPONENT_GOAL,
  formatClock,
  formatEventTime,
} from "@/lib/liveTypes";
import Avatar from "@/components/Avatar";
import LiveFeed from "@/components/LiveFeed";

const STAT_LABEL: Record<string, string> = Object.fromEntries(
  STAT_FIELDS.map((f) => [f.id, f.label])
);
STAT_LABEL[OPPONENT_GOAL] = "Mål motståndare";

const PLAYED_TAB = "__played";

function firstName(name: string) {
  return name.replace(/^Exempel:\s*/, "").split(" ")[0];
}

export default function LiveTracker({ code, initial, isCoach = false }: { code: string; initial: LiveState; isCoach?: boolean }) {
  const [live, setLive] = useState<LiveState>(initial);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [, setTick] = useState(0);
  const [pending, setPending] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [activeStat, setActiveStat] = useState<string>("");
  const [flash, setFlash] = useState<number | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reclaimedRef = useRef(false);
  const autoFinishedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`live-stats-${code}`);
      const storedName = localStorage.getItem(`live-name-${code}`) ?? "";
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr) && arr.length > 0) {
          setSelected(arr);
          setMyName(storedName);
          setActiveStat(arr[0]);
          return;
        }
      }
    } catch {}
    setSetupOpen(true);
  }, [code]);

  useEffect(() => {
    if (!live.clockRunning) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live.clockRunning]);

  const applyState = useCallback((state: LiveState) => {
    setLive(state);
    setFetchedAt(Date.now());
  }, []);

  const post = useCallback(
    (action: LiveAction) => {
      setPending((p) => p + 1);
      queue.current = queue.current
        .then(async () => {
          const res = await fetch(`/api/live/${code}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          });
          if (res.ok) applyState((await res.json()) as LiveState);
        })
        .catch(() => {})
        .finally(() => setPending((p) => p - 1));
      return queue.current;
    },
    [code, applyState]
  );

  useEffect(() => {
    const t = setInterval(async () => {
      if (pending > 0 || document.hidden) return;
      try {
        const res = await fetch(`/api/live/${code}`);
        if (res.ok) applyState((await res.json()) as LiveState);
      } catch {}
    }, 10000);
    return () => clearInterval(t);
  }, [code, pending, applyState]);

  const clockNow =
    live.clockSeconds + (live.clockRunning ? (Date.now() - fetchedAt) / 1000 : 0);

  // Auto-avslut: 5 min efter sista periodens sluttid
  useEffect(() => {
    if (live.finished || autoFinishedRef.current) return;
    const autoFinishThreshold = live.periodMinutes * 60 + 300;
    if (live.period >= live.periods && clockNow >= autoFinishThreshold) {
      autoFinishedRef.current = true;
      post({ type: "finish_match" });
    }
  }, [live.finished, live.period, live.periods, live.periodMinutes, clockNow, post]);

  const tap = (playerId: number) => {
    if (!activeStat) return;
    if (activeStat === PLAYED_TAB) {
      setLive((prev) => ({
        ...prev,
        played: prev.played.includes(playerId)
          ? prev.played.filter((id) => id !== playerId)
          : [...prev.played, playerId],
      }));
      post({ type: "toggle_played", playerId });
      return;
    }
    setLive((prev) => ({
      ...prev,
      counts: {
        ...prev.counts,
        [playerId]: {
          ...prev.counts[playerId],
          [activeStat]: (prev.counts[playerId]?.[activeStat] ?? 0) + 1,
        },
      },
      played: prev.played.includes(playerId) ? prev.played : [...prev.played, playerId],
      ourScore: activeStat === "goals" ? prev.ourScore + 1 : prev.ourScore,
    }));
    setFlash(playerId);
    setTimeout(() => setFlash((f) => (f === playerId ? null : f)), 350);
    post({ type: "event", playerId, statId: activeStat });
  };

  useEffect(() => {
    if (reclaimedRef.current || !selected || !myName.trim()) return;
    reclaimedRef.current = true;
    post({ type: "claim_stats", name: myName.trim(), stats: selected });
  }, [selected, myName, post]);

  const saveSelection = (name: string, stats: string[]) => {
    if (stats.length === 0 || !name.trim()) return;
    setMyName(name);
    setSelected(stats);
    setActiveStat((prev) => (stats.includes(prev) ? prev : stats[0]));
    setSetupOpen(false);
    reclaimedRef.current = true;
    try {
      localStorage.setItem(`live-stats-${code}`, JSON.stringify(stats));
      localStorage.setItem(`live-name-${code}`, name);
    } catch {}
    post({ type: "claim_stats", name: name.trim(), stats });
  };

  // --- Avslutad match: visa sammanfattning + flöde ---
  if (live.finished) {
    const reporters: Record<string, string> = {};
    for (const r of live.reporters) {
      for (const s of r.stats) reporters[s] = r.name;
    }
    const totals = STAT_FIELDS.reduce((acc, f) => {
      acc[f.id] = Object.values(live.counts).reduce((s, c) => s + (c[f.id] ?? 0), 0);
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="max-w-md mx-auto pb-10">
        {/* Header */}
        <div className="panel-dark rounded-none sm:rounded-b-3xl px-5 pt-5 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-white/45">
                {live.homeAway === "home" ? "Hemma mot" : "Borta mot"}
              </p>
              <p className="font-semibold text-white truncate text-[1.05rem] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {live.opponent}
              </p>
            </div>
            <div className="text-right">
              <p className="stat-number text-3xl text-white whitespace-nowrap">
                {live.ourScore}<span className="text-white/40 mx-1">–</span>{live.oppScore}
              </p>
              <span className="badge mt-1" style={{ background: "rgba(255,255,255,0.12)", color: "var(--accent)" }}>
                Avslutad
              </span>
            </div>
          </div>
        </div>

        {/* Sammanställning */}
        <div className="px-4 pt-5 space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold mb-3">Matchsammanställning</h2>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {STAT_FIELDS.map((f) => (
                <div key={f.id} className="text-center rounded-xl py-3 px-1" style={{ background: "var(--bg2)" }}>
                  <p className="stat-number text-2xl">{totals[f.id]}</p>
                  <p className="text-[0.7rem] mt-1" style={{ color: "var(--ink-faint)" }}>{f.short}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spelarstatistik */}
          {Object.keys(live.counts).length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
                <h2 className="font-semibold">Spelarstatistik</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Spelare</th>
                      {STAT_FIELDS.map((f) => <th key={f.id} title={f.label}>{f.short}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {live.players.filter((p) => live.played.includes(p.id) || live.counts[p.id]).map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium whitespace-nowrap">{firstName(p.name)}</td>
                        {STAT_FIELDS.map((f) => (
                          <td key={f.id}>{live.counts[p.id]?.[f.id] ?? 0}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matchflöde */}
          <div className="card p-5">
            <h2 className="font-semibold mb-4">Matchhändelser</h2>
            <LiveFeed
              events={[...live.events].reverse()}
              opponent={live.opponent}
              reporters={reporters}
              emptyText="Inga händelser registrerade."
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Pågående match ---
  const lastEvent = live.events[0];

  return (
    <div className="max-w-md mx-auto pb-32">
      {/* Klocka och ställning */}
      <div className="panel-dark rounded-none sm:rounded-b-3xl px-5 pt-5 pb-6 sticky top-0 z-20" style={{ borderTop: "none" }}>
        <div className="flex items-center justify-between gap-3 relative">
          <div className="min-w-0">
            <p className="eyebrow text-white/45">
              {live.homeAway === "home" ? "Hemma mot" : "Borta mot"}
            </p>
            <p
              className="font-semibold text-white truncate text-[1.05rem] leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {live.opponent}
            </p>
          </div>
          <p className="stat-number text-3xl text-white whitespace-nowrap">
            {live.ourScore}
            <span className="text-white/40 mx-1">–</span>
            {live.oppScore}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3 relative">
          <div>
            <span
              className="badge mb-1"
              style={{ background: "rgba(255,255,255,0.12)", color: "var(--accent)" }}
            >
              Period {live.period} av {live.periods} · {live.periodMinutes} min
            </span>
            <p
              className="stat-number text-[2.7rem] leading-none tabular-nums"
              style={{ color: "var(--accent)" }}
              aria-label="Matchklocka"
            >
              {formatClock(clockNow)}
            </p>
          </div>
          <div className="flex-1" />
          {isCoach && (
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => post({ type: "clock", op: live.clockRunning ? "pause" : "start" })}
                className="btn-accent px-5 py-2.5"
              >
                {live.clockRunning
                  ? "Pausa"
                  : clockNow > 0 || live.period > 1
                    ? "Fortsätt"
                    : "Starta period 1"}
              </button>
              {live.period < live.periods && (clockNow > 0 || live.clockRunning) && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Avsluta period ${live.period} och starta period ${live.period + 1}?`))
                      post({ type: "clock", op: "next_period" });
                  }}
                  className="text-xs font-semibold rounded-full px-3.5 py-1.5"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "var(--ink)",
                  }}
                >
                  Starta period {live.period + 1} →
                </button>
              )}
            </div>
          )}
        </div>
        {isCoach && (
          <div className="mt-3 flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Nollställa matchklockan till period 1, 00:00?"))
                    post({ type: "clock", op: "reset" });
                }}
                className="text-[0.7rem] uppercase tracking-[0.1em] text-white/35 hover:text-white/70"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Nollställ klocka
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Avsluta matchen? Rapportering stängs för alla."))
                    post({ type: "finish_match" });
                }}
                className="text-[0.7rem] uppercase tracking-[0.1em] text-white/35 hover:text-white/70"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Avsluta match
              </button>
            </div>
            <button
              type="button"
              onClick={() => post({ type: "opponent_goal" })}
              className="text-xs font-semibold rounded-full px-3.5 py-1.5"
              style={{
                fontFamily: "var(--font-display)",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "var(--ink)",
              }}
            >
              +1 Mål motståndare
            </button>
          </div>
        )}
      </div>

      {(setupOpen || !selected) && (
        <SetupCard
          initial={selected ?? []}
          initialName={myName}
          reporters={live.reporters}
          onSave={saveSelection}
          onCancel={selected ? () => setSetupOpen(false) : undefined}
        />
      )}

      {selected && !setupOpen && (
        <>
          {myName && (
            <p className="px-4 pt-3 text-xs" style={{ color: "var(--ink-faint)" }}>
              Loggar som{" "}
              <span className="font-semibold" style={{ color: "var(--ink-soft)" }}>{myName}</span>
            </p>
          )}
          <div className="px-4 pt-4 flex gap-2 overflow-x-auto items-center">
            {[...selected, ...(isCoach ? [PLAYED_TAB] : [])].map((statId) => (
              <button
                key={statId}
                type="button"
                onClick={() => setActiveStat(statId)}
                className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  fontFamily: "var(--font-display)",
                  background: activeStat === statId ? "var(--primary)" : "var(--bg2)",
                  color: activeStat === statId ? "var(--primary-deep)" : "var(--ink-soft)",
                  border: "1px solid " + (activeStat === statId ? "var(--primary)" : "var(--line-strong)"),
                }}
              >
                {statId === PLAYED_TAB ? "Spelade" : STAT_LABEL[statId]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                background: "transparent",
                color: "var(--ink-faint)",
                border: "1px dashed var(--line-strong)",
              }}
            >
              Ändra
            </button>
          </div>

          <p className="px-4 pt-3 pb-1 text-xs" style={{ color: "var(--ink-faint)" }}>
            {activeStat === PLAYED_TAB
              ? "Bocka av alla som var med i matchen."
              : "Tryck på spelaren när det händer – varje tryck sparas direkt med matchtid."}
          </p>

          <div className="px-4 pt-2 grid grid-cols-2 gap-2.5">
            {live.players.map((p) => {
              const isPlayedTab = activeStat === PLAYED_TAB;
              const playedOn = live.played.includes(p.id);
              const count = live.counts[p.id]?.[activeStat] ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tap(p.id)}
                  className="card card-hover relative flex items-center gap-2 p-2.5 text-left active:scale-[0.97] transition-transform"
                  style={
                    flash === p.id
                      ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--primary), transparent 75%)" }
                      : undefined
                  }
                >
                  <Avatar name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[0.85rem] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                      {firstName(p.name)}
                    </span>
                    <span className="block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                      {p.jersey_number != null ? `#${p.jersey_number}` : " "}
                    </span>
                  </span>
                  <span
                    className="stat-number text-base min-w-8 h-8 px-1 rounded-lg flex items-center justify-center"
                    style={{
                      background: (isPlayedTab ? playedOn : count > 0)
                        ? "var(--primary)"
                        : "var(--primary-ghost)",
                      color: (isPlayedTab ? playedOn : count > 0) ? "var(--primary-deep)" : "var(--ink-faint)",
                    }}
                  >
                    {isPlayedTab ? (playedOn ? "✓" : "–") : count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="px-4 pt-6">
            <p className="eyebrow mb-3 text-center">Matchhändelser</p>
            <LiveFeed
              events={[...live.events].reverse()}
              opponent={live.opponent}
              emptyText="Flödet fylls på när ni börjar räkna – mål visas med ställning."
            />
          </div>
        </>
      )}

      {lastEvent && (
        <div className="fixed bottom-0 inset-x-0 z-30">
          <div className="max-w-md mx-auto m-3 card flex items-center gap-3 p-3 shadow-lg" style={{ boxShadow: "var(--shadow-lift)" }}>
            <span className="text-xs flex-1 truncate" style={{ color: "var(--ink-soft)" }}>
              Senast:{" "}
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {lastEvent.player_name ? firstName(lastEvent.player_name) : "Motståndaren"} ·{" "}
                {STAT_LABEL[lastEvent.stat_id] ?? lastEvent.stat_id}
                {lastEvent.match_second != null &&
                  ` · ${formatEventTime(lastEvent.period, lastEvent.match_second)}`}
              </span>
            </span>
            <span
              className="text-[0.65rem] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-display)", color: pending > 0 ? "var(--warn)" : "var(--ok)" }}
            >
              {pending > 0 ? "Sparar…" : "Sparat"}
            </span>
            <button type="button" onClick={() => post({ type: "undo" })} className="btn-secondary py-1.5 px-3.5 text-sm">
              Ångra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SetupCard({
  initial,
  initialName,
  reporters,
  onSave,
  onCancel,
}: {
  initial: string[];
  initialName: string;
  reporters: Reporter[];
  onSave: (name: string, stats: string[]) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [picked, setPicked] = useState<string[]>(initial);

  const toggle = (id: string) => {
    const takenByOther = reporters.find(
      (r) => r.name.toLowerCase() !== name.trim().toLowerCase() && r.stats.includes(id)
    );
    if (takenByOther) return;
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="px-4 pt-5">
      <div className="card p-5">
        <p className="eyebrow mb-1" style={{ color: "var(--primary)" }}>Innan du börjar</p>
        <h2 className="font-semibold text-lg">Vem rapporterar?</h2>
        <p className="text-sm mt-1 mb-4" style={{ color: "var(--ink-soft)" }}>
          Ange ditt namn och välj vad du räknar. Dela upp er – en räknar passningar, en annan
          brytningar.
        </p>

        <label className="eyebrow block mb-1.5">Ditt namn</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="T.ex. Annas mamma"
          className="w-full px-3 py-2.5 rounded-lg text-sm mb-5"
          style={{
            background: "var(--bg2)",
            border: "1.5px solid var(--line-strong)",
            color: "var(--ink)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />

        <label className="eyebrow block mb-2">Välj statistik</label>
        <div className="flex flex-wrap gap-2">
          {STAT_FIELDS.map((f) => {
            const on = picked.includes(f.id);
            const takenBy = reporters.find(
              (r) => r.name.toLowerCase() !== name.trim().toLowerCase() && r.stats.includes(f.id)
            );
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                disabled={!!takenBy}
                title={takenBy ? `Bokad av ${takenBy.name}` : undefined}
                className="rounded-full px-4 py-2.5 text-sm font-semibold transition-all"
                style={{
                  fontFamily: "var(--font-display)",
                  background: takenBy ? "var(--bg2)" : on ? "var(--primary)" : "var(--bg2)",
                  color: takenBy ? "var(--ink-faint)" : on ? "var(--primary-deep)" : "var(--ink-soft)",
                  border: "1.5px solid " + (takenBy ? "var(--line)" : on ? "var(--primary)" : "var(--line-strong)"),
                  opacity: takenBy ? 0.55 : 1,
                  cursor: takenBy ? "not-allowed" : "pointer",
                }}
              >
                {f.label}{f.hint ? ` (${f.hint})` : ""}
                {takenBy && <span className="ml-1 text-[0.7em]">· {takenBy.name}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={() => onSave(name.trim(), picked)}
            disabled={picked.length === 0 || !name.trim()}
            className="btn-primary flex-1 py-3 disabled:opacity-50"
          >
            Börja räkna
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary py-3">
              Avbryt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
