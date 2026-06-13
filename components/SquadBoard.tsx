"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { saveLineup } from "@/lib/actions";
import { FORMATIONS, formation as getFormation, positionRole } from "@/lib/formations";
import { fit, level as levelInfo } from "@/lib/levels";
import { positionLabel } from "@/lib/positions";

export interface BoardPlayer {
  id: number;
  name: string;
  jersey_number: number | null;
  position: string;
  level: string;
}

const JERSEY_PATH =
  "M28,22 L40,22 L50,31 L60,22 L72,22 L90,34 L80,47 L70,41 L70,84 Q70,86 68,86 L32,86 Q30,86 30,84 L30,41 L20,47 L10,34 Z";

function Jersey({ num, gk, size }: { num: number | null; gk: boolean; size: number }) {
  const fill = gk ? "#1f9d57" : "#ffd23f";
  const ink = gk ? "#ffffff" : "#14130f";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }} aria-hidden>
      <path d={JERSEY_PATH} fill={fill} stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} strokeLinejoin="round" />
      <text x="50" y="64" textAnchor="middle" dominantBaseline="middle" fontSize="40" fontWeight={700} fontFamily="var(--font-display)" fill={ink}>
        {num ?? ""}
      </text>
    </svg>
  );
}

function firstName(name: string) {
  return name.replace(/^Exempel:\s*/, "").split(" ")[0];
}

export default function SquadBoard({
  matchId,
  matchLevel,
  players,
  initialSquad,
  initialFormation,
  initialPositions,
  cupSize,
  cupName,
}: {
  matchId: number;
  matchLevel: string;
  players: BoardPlayer[];
  initialSquad: number[];
  initialFormation: string;
  initialPositions: { player_id: number; x: number; y: number }[];
  cupSize: number;
  cupName: string;
}) {
  const [squad, setSquad] = useState<Set<number>>(() => new Set(initialSquad));
  const [formationId, setFormationId] = useState(initialFormation || FORMATIONS[0].id);
  const [pos, setPos] = useState<Record<number, { x: number; y: number }>>(() =>
    Object.fromEntries(initialPositions.map((p) => [p.player_id, { x: p.x, y: p.y }]))
  );
  const [applyCup, setApplyCup] = useState(true);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const benchRef = useRef<HTMLDivElement>(null);

  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const placedIds = Object.keys(pos).map(Number).filter((id) => squad.has(id));
  const benchIds = [...squad].filter((id) => !pos[id]);
  const fm = getFormation(formationId);

  const toggleSquad = useCallback((id: number) => {
    setSquad((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        setPos((p) => {
          const c = { ...p };
          delete c[id];
          return c;
        });
      } else {
        n.add(id);
      }
      return n;
    });
  }, []);

  const autoPlace = useCallback(() => {
    const squadArr = players.filter((p) => squad.has(p.id));
    const used = new Set<number>();
    const next: Record<number, { x: number; y: number }> = {};
    for (const slot of fm.slots) {
      let pick = squadArr.find((p) => !used.has(p.id) && positionRole(p.position) === slot.role);
      if (!pick) pick = squadArr.find((p) => !used.has(p.id));
      if (pick) {
        used.add(pick.id);
        next[pick.id] = { x: slot.x, y: slot.y };
      }
    }
    setPos(next);
  }, [players, squad, fm]);

  // Pekardragning (fungerar med både mus och touch)
  const onPointerDownToken = (e: React.PointerEvent, id: number) => {
    e.preventDefault();
    const r = wrapRef.current!.getBoundingClientRect();
    setDrag({ id, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const r = wrapRef.current!.getBoundingClientRect();
      setDrag((d) => (d ? { ...d, x: e.clientX - r.left, y: e.clientY - r.top } : d));
    };
    const up = (e: PointerEvent) => {
      const id = drag.id;
      const pitch = pitchRef.current?.getBoundingClientRect();
      const bench = benchRef.current?.getBoundingClientRect();
      const inside = (rect?: DOMRect) =>
        rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (inside(pitch)) {
        const clamp = (v: number) => Math.min(0.95, Math.max(0.05, v));
        const nx = clamp((e.clientX - pitch!.left) / pitch!.width);
        const ny = clamp((e.clientY - pitch!.top) / pitch!.height);
        setPos((p) => ({ ...p, [id]: { x: nx, y: ny } }));
      } else if (inside(bench)) {
        setPos((p) => {
          const c = { ...p };
          delete c[id];
          return c;
        });
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag]);

  const TOKEN = 46;

  return (
    <div ref={wrapRef} className="relative space-y-4">
      {/* Verktygsrad: formation + auto */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Formation:</span>
        {FORMATIONS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormationId(f.id)}
            className="badge cursor-pointer"
            style={
              f.id === formationId
                ? { background: "var(--primary)", color: "var(--primary-deep)" }
                : { background: "var(--bg2)", color: "var(--ink-soft)" }
            }
          >
            {f.label}
          </button>
        ))}
        <button type="button" onClick={autoPlace} className="badge cursor-pointer ml-auto" style={{ background: "var(--bg2)", color: "var(--ink-soft)" }}>
          Autoplacera
        </button>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          Startelva {placedIds.length}/7
        </span>
      </div>

      {/* Planen */}
      <div
        ref={pitchRef}
        className="relative mx-auto rounded-2xl overflow-hidden select-none"
        style={{ maxWidth: 440, aspectRatio: "360 / 520", touchAction: "none" }}
      >
        <svg viewBox="0 0 360 520" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
          <rect x="0" y="0" width="360" height="520" fill="#2f7a3f" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="0" y={i * 104} width="360" height="52" fill="rgba(255,255,255,0.03)" />
          ))}
          <g fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <rect x="10" y="10" width="340" height="500" rx="3" />
            <line x1="10" y1="260" x2="350" y2="260" />
            <circle cx="180" cy="260" r="44" />
            <rect x="100" y="10" width="160" height="54" />
            <rect x="100" y="456" width="160" height="54" />
          </g>
          <circle cx="180" cy="260" r="3" fill="#fff" />
        </svg>

        {/* Formationsguide – tomma platser */}
        {fm.slots.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              width: TOKEN,
              height: TOKEN,
              transform: "translate(-50%,-50%)",
              border: "2px dashed rgba(255,255,255,0.35)",
            }}
          />
        ))}

        {/* Utplacerade spelare */}
        {placedIds.map((id) => {
          const p = byId[id];
          if (!p) return null;
          const isDragging = drag?.id === id;
          return (
            <div
              key={id}
              onPointerDown={(e) => onPointerDownToken(e, id)}
              className="absolute flex flex-col items-center"
              style={{
                left: `${pos[id].x * 100}%`,
                top: `${pos[id].y * 100}%`,
                transform: "translate(-50%,-50%)",
                touchAction: "none",
                cursor: "grab",
                opacity: isDragging ? 0.3 : 1,
                zIndex: isDragging ? 0 : 2,
              }}
            >
              <Jersey num={p.jersey_number} gk={p.position === "malvakt" || p.jersey_number === 1} size={TOKEN} />
              <span
                className="mt-0.5 px-1.5 rounded text-[0.65rem] font-semibold whitespace-nowrap"
                style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}
              >
                {firstName(p.name)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bänken (avbytare = kallade utan plats) – släpp här för att ta ner */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>Bänk</span>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>dra upp på planen för att starta</span>
        </div>
        <div
          ref={benchRef}
          className="rounded-2xl p-3 flex flex-wrap gap-2 min-h-16"
          style={{ background: "var(--bg2)", border: "1px dashed var(--line-strong)" }}
        >
          {benchIds.length === 0 && (
            <span className="text-xs self-center" style={{ color: "var(--ink-faint)" }}>
              Alla kallade står på planen.
            </span>
          )}
          {benchIds.map((id) => {
            const p = byId[id];
            if (!p) return null;
            const isDragging = drag?.id === id;
            return (
              <div
                key={id}
                onPointerDown={(e) => onPointerDownToken(e, id)}
                className="flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1"
                style={{ background: "var(--bg3)", touchAction: "none", cursor: "grab", opacity: isDragging ? 0.3 : 1 }}
              >
                <Jersey num={p.jersey_number} gk={p.position === "malvakt" || p.jersey_number === 1} size={30} />
                <span className="text-sm font-medium">{firstName(p.name)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trupp – kalla in spelare (färg efter hur de passar matchens nivå) */}
      <div>
        <span className="text-sm font-semibold block mb-2" style={{ color: "var(--ink-soft)" }}>
          Kalla trupp <span className="font-normal text-xs" style={{ color: "var(--ink-faint)" }}>· {squad.size} uttagna</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const inSquad = squad.has(p.id);
            const f = fit(p.level, matchLevel);
            const pl = levelInfo(p.level);
            const tone =
              f.tone === "ok" ? "var(--ok)" : f.tone === "warn" ? "var(--warn)" : f.tone === "danger" ? "var(--danger)" : "var(--ink-faint)";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleSquad(p.id)}
                title={`${positionLabel(p.position) ?? "Position ej satt"} · ${f.label}`}
                className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5 text-sm transition-colors"
                style={{
                  background: inSquad ? "var(--primary-soft)" : "var(--bg2)",
                  border: `1px solid ${inSquad ? "var(--primary)" : "var(--line)"}`,
                  color: inSquad ? "var(--primary)" : "var(--ink-soft)",
                  borderLeft: `4px solid ${tone}`,
                }}
              >
                <span className="stat-number text-xs" style={{ minWidth: 16, textAlign: "center", color: "var(--ink-faint)" }}>
                  {p.jersey_number ?? "–"}
                </span>
                {firstName(p.name)}
                {pl && <span className="text-[0.6rem]" style={{ color: tone }}>{pl.short}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spara */}
      <form action={saveLineup} className="space-y-3 pt-1">
        <input type="hidden" name="match_id" value={matchId} />
        <input type="hidden" name="formation" value={formationId} />
        <input type="hidden" name="positions" value={JSON.stringify(placedIds.map((id) => ({ id, x: pos[id].x, y: pos[id].y })))} />
        {[...squad].map((id) => (
          <input key={id} type="hidden" name="player_id" value={id} />
        ))}
        {cupSize > 1 && (
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={applyCup} onChange={(e) => setApplyCup(e.target.checked)} name="apply_cup" className="h-4 w-4 rounded accent-[var(--primary)]" />
            Använd samma trupp för hela {cupName} ({cupSize} matcher)
          </label>
        )}
        <button type="submit" className="btn-primary px-6">Spara laguttagning</button>
      </form>

      {/* Ghost som följer fingret/musen */}
      {drag && byId[drag.id] && (
        <div
          className="absolute pointer-events-none"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%,-50%)", zIndex: 50 }}
        >
          <Jersey
            num={byId[drag.id].jersey_number}
            gk={byId[drag.id].position === "malvakt" || byId[drag.id].jersey_number === 1}
            size={TOKEN}
          />
        </div>
      )}
    </div>
  );
}
