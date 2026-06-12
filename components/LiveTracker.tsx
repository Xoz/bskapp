"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STAT_FIELDS } from "@/lib/stats";
import { LiveState, LiveAction, OPPONENT_GOAL } from "@/lib/liveTypes";
import Avatar from "@/components/Avatar";

const STAT_LABEL: Record<string, string> = Object.fromEntries(
  STAT_FIELDS.map((f) => [f.id, f.label])
);
STAT_LABEL[OPPONENT_GOAL] = "Mål motståndare";

// Specialflik för att bocka av vilka som spelade
const PLAYED_TAB = "__played";

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function firstName(name: string) {
  return name.replace(/^Exempel:\s*/, "").split(" ")[0];
}

export default function LiveTracker({ code, initial }: { code: string; initial: LiveState }) {
  const [live, setLive] = useState<LiveState>(initial);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [, setTick] = useState(0);
  const [pending, setPending] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [activeStat, setActiveStat] = useState<string>("");
  const [eventsOpen, setEventsOpen] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Läs förälderns val av statistik från localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`live-stats-${code}`);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr) && arr.length > 0) {
          setSelected(arr);
          setActiveStat(arr[0]);
          return;
        }
      }
    } catch {}
    setSetupOpen(true);
  }, [code]);

  // Klockan tickar lokalt mellan serversvaren
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

  // Synka från servern var tionde sekund (andra föräldrar rapporterar samtidigt)
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
    // Optimistisk uppdatering så knappen svarar direkt
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

  const saveSelection = (stats: string[]) => {
    if (stats.length === 0) return;
    setSelected(stats);
    setActiveStat((prev) => (stats.includes(prev) ? prev : stats[0]));
    setSetupOpen(false);
    try {
      localStorage.setItem(`live-stats-${code}`, JSON.stringify(stats));
    } catch {}
  };

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
          <p
            className="stat-number text-[2.7rem] leading-none tabular-nums"
            style={{ color: "var(--accent)" }}
            aria-label="Matchklocka"
          >
            {formatTime(clockNow)}
          </p>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => post({ type: "clock", op: live.clockRunning ? "pause" : "start" })}
            className="btn-accent px-5 py-2.5"
          >
            {live.clockRunning ? "Pausa" : clockNow > 0 ? "Fortsätt" : "Starta match"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between relative">
          <button
            type="button"
            onClick={() => {
              if (confirm("Nollställa matchklockan?")) post({ type: "clock", op: "reset" });
            }}
            className="text-[0.7rem] uppercase tracking-[0.1em] text-white/35 hover:text-white/70"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Nollställ klocka
          </button>
          <button
            type="button"
            onClick={() => post({ type: "opponent_goal" })}
            className="text-xs font-semibold rounded-full px-3.5 py-1.5"
            style={{
              fontFamily: "var(--font-display)",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#fff",
            }}
          >
            +1 Mål motståndare
          </button>
        </div>
      </div>

      {/* Välj statistik */}
      {(setupOpen || !selected) && (
        <SetupCard
          initial={selected ?? []}
          onSave={saveSelection}
          onCancel={selected ? () => setSetupOpen(false) : undefined}
        />
      )}

      {selected && !setupOpen && (
        <>
          {/* Statistikflikar */}
          <div className="px-4 pt-4 flex gap-2 overflow-x-auto items-center">
            {[...selected, PLAYED_TAB].map((statId) => (
              <button
                key={statId}
                type="button"
                onClick={() => setActiveStat(statId)}
                className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  fontFamily: "var(--font-display)",
                  background: activeStat === statId ? "var(--primary)" : "#fff",
                  color: activeStat === statId ? "#fff" : "var(--ink-soft)",
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

          {/* Spelarknappar */}
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
                  className="card card-hover relative flex items-center gap-3 p-3.5 text-left active:scale-[0.97] transition-transform"
                  style={
                    flash === p.id
                      ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--primary), transparent 75%)" }
                      : undefined
                  }
                >
                  <Avatar name={p.name} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[0.95rem]" style={{ fontFamily: "var(--font-display)" }}>
                      {firstName(p.name)}
                    </span>
                    <span className="block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                      {p.jersey_number != null ? `#${p.jersey_number}` : " "}
                    </span>
                  </span>
                  <span
                    className="stat-number text-xl min-w-9 h-9 px-1.5 rounded-xl flex items-center justify-center"
                    style={{
                      background: (isPlayedTab ? playedOn : count > 0)
                        ? "var(--primary)"
                        : "var(--primary-ghost)",
                      color: (isPlayedTab ? playedOn : count > 0) ? "#fff" : "var(--ink-faint)",
                    }}
                  >
                    {isPlayedTab ? (playedOn ? "✓" : "–") : count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Händelselogg */}
          <div className="px-4 pt-5">
            <button
              type="button"
              onClick={() => setEventsOpen((o) => !o)}
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-display)", color: "var(--primary)" }}
            >
              {eventsOpen ? "Dölj händelser" : `Visa händelser (${live.events.length})`}
            </button>
            {eventsOpen && (
              <ul className="mt-3 card divide-y" style={{ borderColor: "var(--line)" }}>
                {live.events.length === 0 && (
                  <li className="px-4 py-3 text-sm" style={{ color: "var(--ink-faint)" }}>
                    Inga händelser ännu.
                  </li>
                )}
                {live.events.map((e) => (
                  <li key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span className="stat-number text-xs w-12" style={{ color: "var(--ink-faint)" }}>
                      {e.match_second != null ? formatTime(e.match_second) : "–"}
                    </span>
                    <span className="flex-1 truncate">
                      {e.player_name ? firstName(e.player_name) : "Motståndaren"}
                    </span>
                    <span className="font-medium" style={{ color: "var(--ink-soft)" }}>
                      {STAT_LABEL[e.stat_id] ?? e.stat_id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Ångra-rad */}
      {lastEvent && (
        <div className="fixed bottom-0 inset-x-0 z-30">
          <div className="max-w-md mx-auto m-3 card flex items-center gap-3 p-3 shadow-lg" style={{ boxShadow: "var(--shadow-lift)" }}>
            <span className="text-xs flex-1 truncate" style={{ color: "var(--ink-soft)" }}>
              Senast:{" "}
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {lastEvent.player_name ? firstName(lastEvent.player_name) : "Motståndaren"} ·{" "}
                {STAT_LABEL[lastEvent.stat_id] ?? lastEvent.stat_id}
                {lastEvent.match_second != null && ` · ${formatTime(lastEvent.match_second)}`}
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
  onSave,
  onCancel,
}: {
  initial: string[];
  onSave: (stats: string[]) => void;
  onCancel?: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="px-4 pt-5">
      <div className="card p-5">
        <p className="eyebrow mb-1" style={{ color: "var(--primary)" }}>Innan du börjar</p>
        <h2 className="font-semibold text-lg">Vad räknar du i dag?</h2>
        <p className="text-sm mt-1 mb-4" style={{ color: "var(--ink-soft)" }}>
          Välj en eller flera. Dela gärna upp er – en förälder räknar passningar, en annan
          brytningar.
        </p>
        <div className="flex flex-wrap gap-2">
          {STAT_FIELDS.map((f) => {
            const on = picked.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className="rounded-full px-4 py-2.5 text-sm font-semibold transition-all"
                style={{
                  fontFamily: "var(--font-display)",
                  background: on ? "var(--primary)" : "#fff",
                  color: on ? "#fff" : "var(--ink-soft)",
                  border: "1.5px solid " + (on ? "var(--primary)" : "var(--line-strong)"),
                }}
              >
                {f.label}
                {f.hint ? ` (${f.hint})` : ""}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={() => onSave(picked)}
            disabled={picked.length === 0}
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
