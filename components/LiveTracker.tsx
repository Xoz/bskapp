"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STAT_FIELDS, CARD_FIELDS, CARD_IDS } from "@/lib/stats";
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
  [...STAT_FIELDS, ...CARD_FIELDS].map((f) => [f.id, f.label])
);
STAT_LABEL[OPPONENT_GOAL] = "Mål motståndare";

const PLAYED_TAB = "__played";

function topByStat(counts: LiveState["counts"], players: LiveState["players"], stat: string) {
  const ranked = players
    .map((p) => ({ name: p.name.replace(/^Exempel:\s*/, "").split(" ")[0], n: counts[p.id]?.[stat] ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  return ranked;
}

function firstName(name: string) {
  return name.replace(/^Exempel:\s*/, "").split(" ")[0];
}

// Klientgenererad idempotensnyckel per mutation. Gör att en offline-replay
// (servern spara → svaret tappas → skickas igen) inte räknar samma händelse
// dubbelt: servern skippar dubbletter via unikt index på idempotency_key.
function newIdempotencyKey(): string {
  try {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {}
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function LiveTracker({ code, initial, isCoach = false, coachName = "", reporterToken }: { code: string; initial: LiveState; isCoach?: boolean; coachName?: string; reporterToken?: string }) {
  const [live, setLive] = useState<LiveState>(initial);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [, setTick] = useState(0);
  const [pending, setPending] = useState(0);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [activeStat, setActiveStat] = useState<string>("");
  const [flash, setFlash] = useState<number | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [subOff, setSubOff] = useState<number | "">("");
  const [subOn, setSubOn] = useState<number | "">("");
  const [showHalftime, setShowHalftime] = useState(false);
  const prevPeriodRef = useRef(initial.period);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const offlineQueue = useRef<LiveAction[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const reclaimedRef = useRef(false);
  const reporterIdRef = useRef("");
  // Sortering "mest aktiva först" – frusen medan man trycker så knapparna inte hoppar
  const lastTapRef = useRef(0);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => {
    try {
      let id = localStorage.getItem("live-reporter-id") ?? "";
      if (!id) {
        id = typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `reporter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("live-reporter-id", id);
      }
      reporterIdRef.current = id;
    } catch {
      reporterIdRef.current = `reporter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  const computeOrder = useCallback((stat: string, state: LiveState): number[] => {
    const ps = [...state.players];
    if (stat === PLAYED_TAB || !stat) {
      return ps.sort((a, b) => a.name.localeCompare(b.name, "sv")).map((p) => p.id);
    }
    return ps
      .sort((a, b) => {
        const cb = state.counts[b.id]?.[stat] ?? 0;
        const ca = state.counts[a.id]?.[stat] ?? 0;
        if (cb !== ca) return cb - ca;
        const pb = state.played.includes(b.id) ? 1 : 0;
        const pa = state.played.includes(a.id) ? 1 : 0;
        if (pb !== pa) return pb - pa;
        return a.name.localeCompare(b.name, "sv");
      })
      .map((p) => p.id);
  }, []);

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
    // Tränaren rapporterar oftast allt själv – förifyll namnet från inloggningen
    // och alla kategorier, så hen kommer direkt till klockan utan "Vem rapporterar?".
    if (isCoach) {
      const allStats = STAT_FIELDS.map((f) => f.id);
      setSelected(allStats);
      setMyName(coachName || "Tränare");
      setActiveStat(allStats[0]);
      return;
    }
    setSetupOpen(true);
  }, [code, isCoach, coachName]);

  useEffect(() => {
    if (!live.clockRunning) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live.clockRunning]);

  const applyState = useCallback((state: LiveState) => {
    setLive(state);
    setFetchedAt(Date.now());
  }, []);

  const saveOfflineQueue = useCallback(
    (actions: LiveAction[]) => {
      offlineQueue.current = actions;
      setQueuedCount(actions.length);
      try {
        if (actions.length > 0) {
          localStorage.setItem(`live-offline-${code}`, JSON.stringify(actions));
        } else {
          localStorage.removeItem(`live-offline-${code}`);
        }
      } catch {}
    },
    [code]
  );

  const post = useCallback(
    (action: LiveAction) => {
      // Fäst en idempotensnyckel på räknande mutationer. Samma nyckel följer med
      // om actionen hamnar i offline-kön och spelas om — servern skippar då
      // dubbletten så målet/bytet inte räknas två gånger.
      let a = action;
      if (action.type === "event" || action.type === "opponent_goal" || action.type === "sub") {
        if (!action.idempotencyKey) {
          a = { ...action, idempotencyKey: newIdempotencyKey() };
        }
      }
      setPending((p) => p + 1);
      queue.current = queue.current
        .then(async () => {
          const tokenQuery = reporterToken ? `?token=${encodeURIComponent(reporterToken)}` : "";
          const res = await fetch(`/api/live/${code}${tokenQuery}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(a),
          });
          if (res.ok) applyState((await res.json()) as LiveState);
        })
        .catch((err: unknown) => {
          // Nätverksfel (TypeError: Failed to fetch) → lägg i offline-kö.
          // `a` (med nyckel) köas, så replayen bär samma idempotensnyckel.
          if (err instanceof TypeError) {
            saveOfflineQueue([...offlineQueue.current, a]);
          }
        })
        .finally(() => setPending((p) => p - 1));
      return queue.current;
    },
    [code, reporterToken, applyState, saveOfflineQueue]
  );

  const flushOfflineQueue = useCallback(() => {
    const q = [...offlineQueue.current];
    if (q.length === 0) return;
    saveOfflineQueue([]);
    q.forEach((action) => post(action));
  }, [post, saveOfflineQueue]);

  // Läs in offline-kö från föregående session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`live-offline-${code}`);
      if (raw) {
        const q = JSON.parse(raw) as LiveAction[];
        if (Array.isArray(q) && q.length > 0) {
          offlineQueue.current = q;
          setQueuedCount(q.length);
        }
      }
    } catch {}
    setIsOnline(navigator.onLine);
  }, [code]);

  // Flusha offline-kön vid uppstart om vi redan har signal
  useEffect(() => {
    if (navigator.onLine) flushOfflineQueue();
  }, [flushOfflineQueue]);

  // Lyssna på online/offline-händelser
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushOfflineQueue]);

  useEffect(() => {
    const t = setInterval(async () => {
      if (pending > 0 || document.hidden) return;
      try {
        const tokenQuery = reporterToken ? `&token=${encodeURIComponent(reporterToken)}` : "";
        const res = await fetch(`/api/live/${code}?reporter=1${tokenQuery}`);
        if (res.ok) applyState((await res.json()) as LiveState);
      } catch {}
    }, 10000);
    return () => clearInterval(t);
  }, [code, reporterToken, pending, applyState]);

  const clockNow =
    live.clockSeconds + (live.clockRunning ? (Date.now() - fetchedAt) / 1000 : 0);

  // Statistikkategorier som ingen rapportör (inkl. jag själv) ännu täcker.
  const coveredStats = new Set<string>();
  for (const r of live.reporters) for (const s of r.stats) coveredStats.add(s);
  if (selected) for (const s of selected) coveredStats.add(s);
  const uncoveredFields = STAT_FIELDS.filter((f) => !coveredStats.has(f.id));
  // Matchen har inte startat ännu (period 1, klockan orörd och stillastående).
  const isMatchStart = !live.clockRunning && live.clockSeconds === 0 && live.period === 1;

  // Automatisk halvtid/periodpaus-sammanfattning när perioden ökar
  useEffect(() => {
    if (live.period > prevPeriodRef.current && live.period > 1 && !live.finished) {
      setShowHalftime(true);
    }
    prevPeriodRef.current = live.period;
  }, [live.period, live.finished]);

  // Sortera om direkt när man byter kategori (man trycker inte just då)
  useEffect(() => {
    if (activeStat) setOrder(computeOrder(activeStat, liveRef.current));
  }, [activeStat, computeOrder]);

  // Sortera om med jämna mellanrum – men aldrig precis efter ett tryck
  useEffect(() => {
    const t = setInterval(() => {
      if (!activeStat || Date.now() - lastTapRef.current < 3000) return;
      setOrder(computeOrder(activeStat, liveRef.current));
    }, 6000);
    return () => clearInterval(t);
  }, [activeStat, computeOrder]);

  const tap = (playerId: number) => {
    if (!activeStat) return;
    lastTapRef.current = Date.now();
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
    post({
      type: "event",
      playerId,
      statId: activeStat,
      reporter: myName || undefined,
      reporterId: reporterIdRef.current,
    });
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
    const finMinutes = Object.entries(live.minutes)
      .map(([id, m]) => ({ id: Number(id), m, name: firstName(live.players.find((p) => p.id === Number(id))?.name ?? "") }))
      .sort((a, b) => b.m - a.m);
    const finMaxMin = finMinutes.reduce((mx, r) => Math.max(mx, r.m), 0) || 1;

    return (
      <div className="max-w-md mx-auto pb-10">
        {/* Header */}
        <div
          className="surface-dark rounded-none sm:rounded-b-3xl px-5 pt-5 pb-6"
          style={{ paddingTop: "max(1.25rem, calc(env(safe-area-inset-top) + 0.6rem))" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-white/45">
                {live.homeAway === "home" ? "Hemma mot" : "Borta mot"}
              </p>
              <p className="font-semibold text-white truncate text-[18px] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
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
                <div key={f.id} className="text-center rounded-xl py-3 px-1" style={{ background: "var(--surface)" }}>
                  <p className="stat-number text-2xl">{totals[f.id]}</p>
                  <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>{f.short}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spelarstatistik */}
          {Object.keys(live.counts).length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
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

          {/* Spelade minuter */}
          {live.hasLineup && finMinutes.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-1">Spelade minuter</h2>
              <p className="caption mb-4" style={{ color: "var(--ink-muted)" }}>
                {live.subs.length} {live.subs.length === 1 ? "byte" : "byten"} registrerade
              </p>
              <div className="space-y-2">
                {finMinutes.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5">
                    <span className="body-small w-20 truncate" style={{ color: "var(--ink-secondary)" }}>{r.name}</span>
                    <span className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
                      <span className="block h-full" style={{ width: `${Math.round((r.m / finMaxMin) * 100)}%`, background: "var(--primary)" }} />
                    </span>
                    <span className="stat-number text-sm w-14 text-right" style={{ color: "var(--ink-secondary)" }}>{r.m} min</span>
                  </div>
                ))}
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

  // Spelarlista i "mest aktiva först"-ordning (med nya spelare sist)
  const pById = new Map(live.players.map((p) => [p.id, p]));
  const orderedPlayers = [
    ...order.map((id) => pById.get(id)).filter((p): p is LiveState["players"][number] => !!p),
    ...live.players.filter((p) => !order.includes(p.id)),
  ];

  // Byten
  const onIds = live.hasLineup ? live.onField : live.played;
  const offCandidates = live.players.filter((p) => onIds.includes(p.id));
  const onCandidates = live.players.filter((p) => !onIds.includes(p.id));
  const lastSub = live.subs[live.subs.length - 1];
  const logSub = () => {
    if (subOff === "" || subOn === "") return;
    post({ type: "sub", offId: Number(subOff), onId: Number(subOn) });
    setSubOff("");
    setSubOn("");
  };
  // Speltid
  const minutesList = Object.entries(live.minutes)
    .map(([id, m]) => ({ id: Number(id), m, name: firstName(live.players.find((p) => p.id === Number(id))?.name ?? "") }))
    .sort((a, b) => b.m - a.m);
  const maxMin = minutesList.reduce((mx, r) => Math.max(mx, r.m), 0) || 1;
  const goalLeaders = topByStat(live.counts, live.players, "goals");
  const assistLeaders = topByStat(live.counts, live.players, "assists");

  return (
    <div className="max-w-md mx-auto pb-32">
      {/* Klocka och ställning */}
      <div
        className="surface-dark rounded-none sm:rounded-b-3xl px-5 pt-5 pb-6 sticky top-0 z-20"
        style={{ borderTop: "none", paddingTop: "max(1.25rem, calc(env(safe-area-inset-top) + 0.6rem))" }}
      >
        <div className="flex items-center justify-between gap-3 relative">
          <div className="min-w-0">
            <p className="eyebrow text-white/45">
              {live.homeAway === "home" ? "Hemma mot" : "Borta mot"}
            </p>
            <p
              className="font-semibold text-white truncate text-[18px] leading-tight"
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
          {isCoach && <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => {
                // Varna om någon statistikkategori saknar rapportör vid matchstart
                if (isMatchStart && uncoveredFields.length > 0) {
                  const list = uncoveredFields.map((f) => f.label).join(", ");
                  if (
                    !confirm(
                      `Ingen för statistik på: ${list}.\n\nDe här kategorierna registreras inte under matchen. Starta ändå?`
                    )
                  )
                    return;
                }
                post({ type: "clock", op: live.clockRunning ? "pause" : "start" });
              }}
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
                className="body-small font-semibold rounded-full px-4 py-2.5 min-h-[44px]"
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
          </div>}
        </div>
        <div className="mt-3 flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            {isCoach && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Nollställa matchklockan till period 1, 00:00?"))
                    post({ type: "clock", op: "reset" });
                }}
                className="caption uppercase tracking-[0.1em] text-white/35 hover:text-white/70"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Nollställ klocka
              </button>
            )}
            {/* Avsluta stänger rapporteringen för alla och är tränarlåst. */}
            {isCoach && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Avsluta matchen? Rapportering stängs för alla."))
                    post({ type: "finish_match" });
                }}
                className="caption uppercase tracking-[0.1em] text-white/35 hover:text-white/70"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Avsluta match
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => post({
              type: "opponent_goal",
              reporter: myName || undefined,
              reporterId: reporterIdRef.current,
            })}
            className="body-small font-semibold rounded-full px-4 py-2.5 min-h-[44px]"
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

        {!isOnline && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-xs text-center"
            style={{ background: "rgba(248,113,113,0.18)", color: "var(--danger)" }}
          >
            Ingen signal
            {queuedCount > 0
              ? ` · ${queuedCount} händelse${queuedCount === 1 ? "" : "r"} i kö – skickas automatiskt`
              : " – händelser sparas och skickas när du är online igen"}
          </div>
        )}

        {isMatchStart && uncoveredFields.length > 0 && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-xs"
            style={{ background: "rgba(255,180,0,0.16)", color: "#ffd23f" }}
          >
            ⚠️ Ingen för statistik på{" "}
            <span className="font-semibold">{uncoveredFields.map((f) => f.label).join(", ")}</span>.
            Lägg till fler rapportörer eller utöka ditt eget urval innan matchen startar.
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
            <p className="px-4 pt-3 text-xs" style={{ color: "var(--ink-muted)" }}>
              Loggar som{" "}
              <span className="font-semibold" style={{ color: "var(--ink-secondary)" }}>{myName}</span>
            </p>
          )}
          <div className="px-4 pt-4 flex gap-2 overflow-x-auto items-center no-scrollbar">
            {[...selected, ...(isCoach ? [...CARD_IDS, PLAYED_TAB] : [])].map((statId) => (
              <button
                key={statId}
                type="button"
                onClick={() => setActiveStat(statId)}
                className="shrink-0 inline-flex items-center rounded-full px-4 py-2.5 min-h-[44px] text-[0.95rem] font-semibold transition-all"
                style={{
                  fontFamily: "var(--font-display)",
                  background: activeStat === statId ? "var(--primary)" : "var(--surface)",
                  color: activeStat === statId ? "var(--primary-deep)" : "var(--ink-secondary)",
                  border: "1px solid " + (activeStat === statId ? "var(--primary)" : "var(--border)"),
                }}
              >
                {statId === PLAYED_TAB ? "Spelade" : STAT_LABEL[statId]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="shrink-0 inline-flex items-center rounded-full px-4 py-2.5 min-h-[44px] text-[0.95rem] font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                background: "transparent",
                color: "var(--ink-muted)",
                border: "1px dashed var(--border)",
              }}
            >
              Ändra
            </button>
          </div>

          <p className="px-4 pt-3 pb-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            {activeStat === PLAYED_TAB
              ? "Bocka av alla som var med i matchen."
              : "Tryck på spelaren när det händer – varje tryck sparas direkt med matchtid."}
          </p>

          <div className="px-4 pt-2 grid grid-cols-2 gap-2.5">
            {orderedPlayers.map((p) => {
              const isPlayedTab = activeStat === PLAYED_TAB;
              const playedOn = live.played.includes(p.id);
              const count = live.counts[p.id]?.[activeStat] ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tap(p.id)}
                  className="card card-hover relative flex items-center gap-2.5 p-3 min-h-[68px] text-left active:scale-[0.97] transition-transform"
                  style={
                    flash === p.id
                      ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--primary), transparent 75%)" }
                      : undefined
                  }
                >
                  <Avatar name={p.name} jersey={p.jersey_number} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[0.95rem] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                      {firstName(p.name)}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
                      {p.jersey_number != null ? `#${p.jersey_number}` : " "}
                    </span>
                  </span>
                  <span
                    className="stat-number text-lg min-w-11 h-11 px-1 rounded-xl flex items-center justify-center"
                    style={{
                      background: (isPlayedTab ? playedOn : count > 0)
                        ? "var(--primary)"
                        : "var(--primary-ghost)",
                      color: (isPlayedTab ? playedOn : count > 0) ? "var(--primary-deep)" : "var(--ink-muted)",
                    }}
                  >
                    {isPlayedTab ? (playedOn ? "✓" : "–") : count}
                  </span>
                </button>
              );
            })}
          </div>

          {isCoach && (
            <div className="px-4 pt-6">
              <button
                type="button"
                onClick={() => setSubOpen((o) => !o)}
                className="w-full flex items-center justify-between card p-3.5"
              >
                <span className="font-semibold text-sm">Byte</span>
                <span className="caption" style={{ color: "var(--ink-muted)" }}>
                  {live.subs.length > 0 ? `${live.subs.length} gjorda · ` : ""}{subOpen ? "dölj" : "logga byte"}
                </span>
              </button>
              {subOpen && (
                <div className="card p-4 mt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <select className="input" value={subOff} onChange={(e) => setSubOff(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Spelare ut</option>
                      {offCandidates.map((p) => (
                        <option key={p.id} value={p.id}>{firstName(p.name)}{p.jersey_number != null ? ` #${p.jersey_number}` : ""}</option>
                      ))}
                    </select>
                    <select className="input" value={subOn} onChange={(e) => setSubOn(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Spelare in</option>
                      {onCandidates.map((p) => (
                        <option key={p.id} value={p.id}>{firstName(p.name)}{p.jersey_number != null ? ` #${p.jersey_number}` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={logSub} disabled={subOff === "" || subOn === ""} className="btn-primary w-full disabled:opacity-50">
                    Logga byte vid {formatClock(clockNow)}
                  </button>
                  {lastSub && (
                    <div className="flex items-center justify-between text-xs" style={{ color: "var(--ink-secondary)" }}>
                      <span>Senaste: <strong>{lastSub.onName}</strong> in · {lastSub.offName} ut</span>
                      <button type="button" onClick={() => post({ type: "undo_sub" })} className="underline" style={{ color: "var(--danger)" }}>Ångra</button>
                    </div>
                  )}
                  {!live.hasLineup && (
                    <p className="caption" style={{ color: "var(--ink-muted)" }}>
                      Tips: sätt startelvan i laguttagningen så blir speltiden exakt.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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

      {showHalftime && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="card w-full max-w-sm p-6 max-h-[85vh] overflow-y-auto">
            <p className="eyebrow text-center" style={{ color: "var(--primary)" }}>
              {live.period > 2 ? `Paus före period ${live.period}` : "Halvtid"}
            </p>
            <p className="stat-number text-4xl text-center my-1.5">{live.ourScore}–{live.oppScore}</p>
            <p className="text-center text-sm mb-4" style={{ color: "var(--ink-secondary)" }}>
              {live.homeAway === "home" ? "Hemma mot" : "Borta mot"} {live.opponent}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl p-3" style={{ background: "var(--surface)" }}>
                <p className="caption mb-1" style={{ color: "var(--ink-muted)" }}>Mål</p>
                <p className="body-small">{goalLeaders.length ? goalLeaders.slice(0, 3).map((r) => `${r.name} ${r.n}`).join(" · ") : "–"}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: "var(--surface)" }}>
                <p className="caption mb-1" style={{ color: "var(--ink-muted)" }}>Assist</p>
                <p className="body-small">{assistLeaders.length ? assistLeaders.slice(0, 3).map((r) => `${r.name} ${r.n}`).join(" · ") : "–"}</p>
              </div>
            </div>

            <p className="caption mb-2" style={{ color: "var(--ink-muted)" }}>Spelade minuter</p>
            {live.hasLineup && minutesList.length > 0 ? (
              <div className="space-y-1.5 mb-4">
                {minutesList.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="caption w-16 truncate" style={{ color: "var(--ink-secondary)" }}>{r.name}</span>
                    <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
                      <span className="block h-full" style={{ width: `${Math.round((r.m / maxMin) * 100)}%`, background: "var(--primary)" }} />
                    </span>
                    <span className="stat-number text-xs w-12 text-right" style={{ color: "var(--ink-muted)" }}>{r.m} min</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="caption mb-4" style={{ color: "var(--ink-muted)" }}>
                Sätt startelvan i laguttagningen så räknas spelade minuter per spelare.
              </p>
            )}

            <button type="button" onClick={() => setShowHalftime(false)} className="btn-primary w-full">
              Fortsätt
            </button>
          </div>
        </div>
      )}

      {lastEvent && (
        <div className="fixed bottom-0 inset-x-0 z-30" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="max-w-md mx-auto m-3 card flex items-center gap-3 p-3 shadow-lg" style={{ boxShadow: "var(--shadow-lift)" }}>
            <span className="text-[0.8rem] flex-1 truncate" style={{ color: "var(--ink-secondary)" }}>
              Senast:{" "}
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {lastEvent.player_name ? firstName(lastEvent.player_name) : "Motståndaren"} ·{" "}
                {STAT_LABEL[lastEvent.stat_id] ?? lastEvent.stat_id}
                {lastEvent.match_second != null &&
                  ` · ${formatEventTime(lastEvent.period, lastEvent.match_second)}`}
              </span>
            </span>
            <span
              className="caption uppercase tracking-wider"
              style={{
                fontFamily: "var(--font-display)",
                color: !isOnline ? "var(--danger)" : pending > 0 ? "var(--warning)" : "var(--success)",
              }}
            >
              {!isOnline
                ? queuedCount > 0
                  ? `Offline · ${queuedCount} i kö`
                  : "Offline"
                : pending > 0
                  ? "Sparar…"
                  : "Sparat"}
            </span>
            <button
              type="button"
              onClick={() => post({ type: "undo", reporterId: reporterIdRef.current })}
              className="btn-secondary px-5 text-sm shrink-0"
            >
              {isCoach ? "Ångra" : "Ångra min"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(lastSeen: number | null): string | null {
  if (!lastSeen) return null;
  const mins = Math.floor((Date.now() / 1000 - lastSeen) / 60);
  if (mins < 1) return "nyss aktiv";
  if (mins < 60) return `aktiv ${mins} min sen`;
  return null;
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

  const myNameLower = name.trim().toLowerCase();
  const otherReporters = reporters.filter((r) => r.name.toLowerCase() !== myNameLower);

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="px-4 pt-5">
      <div className="card p-5">
        <p className="eyebrow mb-1" style={{ color: "var(--primary)" }}>Innan du börjar</p>
        <h2 className="font-semibold text-lg">Vem rapporterar?</h2>
        <p className="body-small mt-1 mb-4" style={{ color: "var(--ink-secondary)" }}>
          Ange ditt namn och välj vad du räknar. Dela upp er – en räknar passningar, en annan
          brytningar.
        </p>

        <label className="eyebrow block mb-1.5">Ditt namn</label>

        {/* Snabbval – klicka på en aktiv reporter för att återta ditt namn */}
        {reporters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {reporters.map((r) => {
              const ago = timeAgo(r.lastSeen);
              return (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setName(r.name)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                  style={{
                    background: name === r.name ? "var(--primary)" : "var(--surface)",
                    color: name === r.name ? "var(--primary-deep)" : "var(--ink-secondary)",
                    border: "1px solid " + (name === r.name ? "var(--primary)" : "var(--border)"),
                  }}
                >
                  {r.name}{ago ? <span className="opacity-60"> · {ago}</span> : null}
                </button>
              );
            })}
          </div>
        )}

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="T.ex. Annas mamma"
          className="w-full px-3.5 py-3 rounded-lg mb-5"
          style={{
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            color: "var(--ink)",
            outline: "none",
            fontFamily: "inherit",
            fontSize: "16px",
          }}
        />

        <label className="eyebrow block mb-2">Välj statistik</label>
        <div className="flex flex-wrap gap-2">
          {STAT_FIELDS.map((f) => {
            const on = picked.includes(f.id);
            const takenBy = otherReporters.filter((r) => r.stats.includes(f.id));
            const hasConflict = takenBy.length > 0;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className="rounded-full px-4 py-2.5 text-sm font-semibold transition-all"
                style={{
                  fontFamily: "var(--font-display)",
                  background: on ? "var(--primary)" : "var(--surface)",
                  color: on ? "var(--primary-deep)" : hasConflict ? "var(--warning)" : "var(--ink-secondary)",
                  border: "1.5px solid " + (on ? "var(--primary)" : hasConflict ? "var(--warning)" : "var(--border)"),
                }}
              >
                {f.label}{f.hint ? ` (${f.hint})` : ""}
                {hasConflict && !on && (
                  <span className="ml-1 caption opacity-80">· {takenBy.map(r => r.name.split(" ")[0]).join(", ")} räknar</span>
                )}
              </button>
            );
          })}
        </div>

        {picked.some((id) => otherReporters.some((r) => r.stats.includes(id))) && (
          <p className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: "var(--warn-bg, rgba(234,179,8,0.1))", color: "var(--warning)" }}>
            Du har valt samma statistik som någon annan. Händelser loggas ändå bara en gång tack vare duplikatskydd – men koordinera gärna med de andra.
          </p>
        )}

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
