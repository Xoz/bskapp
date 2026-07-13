"use client";

import { useEffect, useRef, useState } from "react";
import type { Arrow, ArrowEndpoint, ArrowKind, Diagram, DiagramObject, ObjectType, Team } from "@/domain/diagram";
import { serialize } from "@/domain/diagram";
import { saveExerciseDiagram } from "@/app/actions";
import { arrowsSorted, useDiagram } from "./diagramStore";
import { ARROW_COLOR, ARROW_DASH, H, TEAM_COLOR, arrowMarkers, arrowPath, pitchMarkings, resolve } from "./diagramRender";

type Tool = "select" | "erase" | `place:${ObjectType}` | `arrow:${ArrowKind}`;
type PitchPreset = { label: string; ratio: number };

const clamp01 = (number: number) => Math.min(1, Math.max(0, number));
const pitchPresets: PitchPreset[] = [
  { label: "Träningsyta", ratio: 0.72 },
  { label: "Kvadrat", ratio: 1 },
  { label: "Halvplan", ratio: 0.8 },
  { label: "Helplan", ratio: 0.65 },
];
const objectTools: { type: ObjectType; icon: string; label: string }[] = [
  { type: "player", icon: "●", label: "Spelare" },
  { type: "ball", icon: "⚽", label: "Boll" },
  { type: "cone", icon: "▲", label: "Kon" },
  { type: "pole", icon: "┃", label: "Pinne" },
  { type: "miniGoal", icon: "▱", label: "Minimål" },
  { type: "goal", icon: "▭", label: "Stort mål" },
  { type: "zone", icon: "▧", label: "Zon" },
  { type: "text", icon: "T", label: "Text" },
];
const arrowTools: { kind: ArrowKind; icon: string; label: string }[] = [
  { kind: "pass", icon: "⇢", label: "Passning" },
  { kind: "run", icon: "→", label: "Löpning" },
  { kind: "dribble", icon: "〰", label: "Dribbling" },
];

function ObjectShape({ object, h, selected = false }: { object: DiagramObject; h: number; selected?: boolean }) {
  const x = object.x * 100;
  const y = object.y * h;
  const rotation = object.rotation ?? 0;
  if (object.type === "zone") {
    const width = (object.width ?? 0.24) * 100;
    const height = (object.height ?? 0.22) * h;
    return <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx={1} fill="#f7d15422" stroke={selected ? "#fff" : "#ffe066"} strokeWidth={selected ? 0.8 : 0.45} strokeDasharray="2 1.5" />;
  }
  if (object.type === "text") return <text x={x} y={y} textAnchor="middle" fill="#fff" fontSize={3.1} fontWeight={800} paintOrder="stroke" stroke="#173b2a" strokeWidth={0.8}>{object.label || "Text"}</text>;
  if (object.type === "player") {
    const fill = TEAM_COLOR[object.team ?? "att"];
    return <><circle cx={x} cy={y} r={2.4} fill={fill} stroke="#fff" strokeWidth={0.65} />{object.label && <text x={x} y={y + 0.85} fontSize={2.2} textAnchor="middle" fill="#fff" fontWeight={900}>{object.label}</text>}</>;
  }
  if (object.type === "ball") return <><circle cx={x} cy={y} r={1.25} fill="#fff" stroke="#17211d" strokeWidth={0.35} /><path d={`M ${x - 0.5} ${y} l 0.5 -0.45 0.5 0.45 -0.2 0.55 -0.6 0 z`} fill="#17211d" /></>;
  if (object.type === "cone") return <polygon points={`${x},${y - 1.5} ${x + 1.35},${y + 1} ${x - 1.35},${y + 1}`} fill="#ff8b32" stroke="#9a4510" strokeWidth={0.3} />;
  if (object.type === "pole") return <g transform={`rotate(${rotation} ${x} ${y})`}><line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#ffd84d" strokeWidth={1.1} /><line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#e44" strokeWidth={0.35} strokeDasharray="1.5 1.5" /></g>;
  const width = object.type === "goal" ? 10 : 6;
  const depth = object.type === "goal" ? 3 : 2.5;
  return <g transform={`rotate(${rotation} ${x} ${y})`} stroke="#fff" strokeWidth={0.55} fill="#ffffff18"><path d={`M ${x - width / 2} ${y + depth / 2} V ${y - depth / 2} H ${x + width / 2} V ${y + depth / 2}`} /><path d={`M ${x - width / 2} ${y - depth / 2} l 1.3 ${depth} h ${width - 2.6} l 1.3 -${depth}`} opacity={0.7} /></g>;
}

export function ExerciseEditor({ exerciseId, name, initialDiagram }: { exerciseId: string; name: string; initialDiagram: Diagram }) {
  const present = useDiagram((state) => state.present);
  const past = useDiagram((state) => state.past);
  const future = useDiagram((state) => state.future);
  const selectedId = useDiagram((state) => state.selectedId);
  const { load, addObject, moveObjectLive, deleteObject, addArrow, deleteArrow, setWidth, select, setObjectTeam, updateObject, duplicateObject, snapshot, undo, redo } = useDiagram.getState();
  const [tool, setTool] = useState<Tool>("select");
  const [playerTeam, setPlayerTeam] = useState<Team>("att");
  const [arrowStart, setArrowStart] = useState<ArrowEndpoint | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => load(initialDiagram), [initialDiagram, load]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedId) { event.preventDefault(); deleteObject(selectedId); select(null); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteObject, redo, select, selectedId, undo]);

  const h = H(present.widthRatio);
  const selected = present.objects.find((object) => object.id === selectedId) ?? null;
  const sorted = arrowsSorted(present);
  const toUnit = (event: React.PointerEvent): [number, number] => {
    const bounds = svgRef.current!.getBoundingClientRect();
    return [clamp01((event.clientX - bounds.left) / bounds.width), clamp01((event.clientY - bounds.top) / bounds.height)];
  };
  const endpointAt = (point: [number, number]): ArrowEndpoint => {
    const nearby = present.objects.find((object) => object.type !== "zone" && object.type !== "text" && Math.hypot(object.x * 100 - point[0] * 100, object.y * h - point[1] * h) < 3.5);
    return nearby ? { objectId: nearby.id } : { point };
  };
  const beginArrow = (event: React.PointerEvent, endpoint: ArrowEndpoint) => {
    svgRef.current?.setPointerCapture?.(event.pointerId);
    setArrowStart(endpoint);
    setCursor(toUnit(event));
  };
  const chooseTool = (next: Tool) => { setTool(next); setArrowStart(null); setCursor(null); };

  const onSvgPointerDown = (event: React.PointerEvent) => {
    const point = toUnit(event);
    if (tool.startsWith("arrow:")) return beginArrow(event, endpointAt(point));
    if (tool.startsWith("place:")) {
      const type = tool.slice(6) as ObjectType;
      addObject(type, point[0], point[1], type === "player" ? playerTeam : undefined);
      return;
    }
    select(null);
  };
  const onSvgPointerMove = (event: React.PointerEvent) => {
    const point = toUnit(event);
    if (tool.startsWith("arrow:") && arrowStart) setCursor(point);
    if (dragId.current) moveObjectLive(dragId.current, point[0], point[1]);
  };
  const onSvgPointerUp = (event: React.PointerEvent) => {
    if (tool.startsWith("arrow:") && arrowStart) {
      const end = toUnit(event);
      const start = resolve(arrowStart, present.objects, h);
      if (Math.hypot(end[0] * 100 - start[0], end[1] * h - start[1]) > 1.5) addArrow(tool.slice(6) as ArrowKind, arrowStart, endpointAt(end));
      setArrowStart(null);
      setCursor(null);
    }
    dragId.current = null;
  };
  const onObjectDown = (event: React.PointerEvent, object: DiagramObject) => {
    event.stopPropagation();
    if (tool === "erase") return deleteObject(object.id);
    if (tool.startsWith("arrow:")) return beginArrow(event, { objectId: object.id });
    if (tool === "place:player" && object.type === "player") return setObjectTeam(object.id, playerTeam);
    if (tool !== "select") return;
    snapshot();
    dragId.current = object.id;
    select(object.id);
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };
  const onArrowDown = (event: React.PointerEvent, arrow: Arrow) => { event.stopPropagation(); if (tool === "erase") deleteArrow(arrow.id); };

  const download = (href: string, filename: string) => { const anchor = document.createElement("a"); anchor.href = href; anchor.download = filename; anchor.click(); };
  const svgBlob = () => {
    const clone = svgRef.current!.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
  };
  const exportSVG = () => download(URL.createObjectURL(svgBlob()), `${name || "ovning"}.svg`);
  const exportPNG = () => {
    const url = URL.createObjectURL(svgBlob());
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = Math.round(1400 * present.widthRatio);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      download(canvas.toDataURL("image/png"), `${name || "ovning"}.png`);
    };
    image.src = url;
  };
  const onSave = async () => {
    setStatus("Sparar…");
    try {
      await saveExerciseDiagram(exerciseId, serialize(present) as Diagram);
      setStatus("Sparat ✓");
      setTimeout(() => setStatus(""), 2500);
    } catch (error) { setStatus("Kunde inte spara: " + (error as Error).message); }
  };

  const renderArrow = (arrow: Arrow) => {
    const from = resolve(arrow.from, present.objects, h);
    const to = resolve(arrow.to, present.objects, h);
    return <path key={arrow.id} d={arrowPath(arrow.kind, from, to)} fill="none" stroke={ARROW_COLOR[arrow.kind]} strokeWidth={0.75} strokeDasharray={ARROW_DASH[arrow.kind]} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#ah-${arrow.kind})`} onPointerDown={(event) => onArrowDown(event, arrow)} style={{ cursor: tool === "erase" ? "pointer" : "default" }} />;
  };
  const preview = arrowStart && cursor ? <path d={arrowPath(tool.slice(6) as ArrowKind, resolve(arrowStart, present.objects, h), [cursor[0] * 100, cursor[1] * h])} fill="none" stroke={ARROW_COLOR[tool.slice(6) as ArrowKind]} strokeWidth={0.8} strokeDasharray={ARROW_DASH[tool.slice(6) as ArrowKind]} markerEnd={`url(#ah-${tool.slice(6)})`} opacity={0.85} /> : null;

  return (
    <div className="editor">
      <section className="editor-topbar" aria-label="Ritarens huvudverktyg">
        <div className="pitch-presets">
          <span className="editor-kicker">Plan</span>
          {pitchPresets.map((preset) => <button key={preset.label} className={`editor-chip ${present.widthRatio === preset.ratio ? "active" : ""}`} onClick={() => setWidth(preset.ratio)}>{preset.label}</button>)}
        </div>
        <div className="editor-actions">
          <button className="button" disabled={!past.length} onClick={undo} title="⌘Z">↶ Ångra</button>
          <button className="button" disabled={!future.length} onClick={redo} title="⇧⌘Z">↷ Gör om</button>
          <button className="button" onClick={exportPNG}>Exportera PNG</button>
          <button className="button primary" onClick={onSave}>Spara</button>
        </div>
      </section>

      <div className="editor-workspace">
        <aside className="editor-palette" aria-label="Objekt och linjer">
          <div>
            <span className="editor-kicker">Redigera</span>
            <button className={`editor-tool ${tool === "select" ? "active" : ""}`} onClick={() => chooseTool("select")}><b>↖</b><span>Markera / flytta</span></button>
          </div>
          <div>
            <span className="editor-kicker">Objekt</span>
            <div className="editor-tool-grid">
              {objectTools.map(({ type, icon, label }) => <button key={type} className={`editor-tool ${tool === `place:${type}` ? "active" : ""}`} onClick={() => chooseTool(`place:${type}`)}><b>{icon}</b><span>{label}</span></button>)}
            </div>
            {tool === "place:player" && <div className="palette-team-picker" aria-label="Färg för nya spelare">{(["att", "def", "gk"] as Team[]).map((team) => <button key={team} className={playerTeam === team ? "active" : ""} style={{ "--team": TEAM_COLOR[team] } as React.CSSProperties} onClick={() => setPlayerTeam(team)}>{team === "att" ? "Anfall" : team === "def" ? "Försvar" : "MV"}</button>)}</div>}
          </div>
          <div>
            <span className="editor-kicker">Rörelse</span>
            {arrowTools.map(({ kind, icon, label }) => <button key={kind} className={`editor-tool arrow-${kind} ${tool === `arrow:${kind}` ? "active" : ""}`} onClick={() => chooseTool(`arrow:${kind}`)}><b>{icon}</b><span>{label}</span></button>)}
          </div>
          <button className={`editor-tool danger ${tool === "erase" ? "active" : ""}`} onClick={() => chooseTool("erase")}><b>⌫</b><span>Radera</span></button>
        </aside>

        <div className="editor-canvas-column">
          <div className="editor-stage">
            <svg ref={svgRef} viewBox={`0 0 100 ${h}`} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `1 / ${present.widthRatio}` }} onPointerDown={onSvgPointerDown} onPointerMove={onSvgPointerMove} onPointerUp={onSvgPointerUp} onPointerLeave={onSvgPointerUp} aria-label="Övningsyta">
              <defs>{arrowMarkers()}</defs>
              {pitchMarkings(h)}
              {present.objects.filter((object) => object.type === "zone").map((object) => <g key={object.id} onPointerDown={(event) => onObjectDown(event, object)} style={{ cursor: tool === "select" ? "grab" : "pointer" }}><ObjectShape object={object} h={h} selected={object.id === selectedId} /></g>)}
              {sorted.map(renderArrow)}
              {present.objects.filter((object) => object.type !== "zone").map((object) => <g key={object.id} onPointerDown={(event) => onObjectDown(event, object)} style={{ cursor: tool === "select" ? "grab" : "pointer" }}><circle cx={object.x * 100} cy={object.y * h} r={object.type === "text" ? 5 : 3.8} fill="transparent" /><ObjectShape object={object} h={h} selected={object.id === selectedId} />{object.id === selectedId && <circle cx={object.x * 100} cy={object.y * h} r={4} fill="none" stroke="#fff" strokeWidth={0.4} strokeDasharray="1 1" />}</g>)}
              {preview}
            </svg>
          </div>
          <div className="editor-legend"><span><i className="pass" /> Passning</span><span><i className="run" /> Löpning</span><span><i className="dribble" /> Dribbling</span><small>{tool === "select" ? "Dra ett objekt för att flytta det." : tool.startsWith("arrow:") ? "Dra från start till mål. Linjen följer objekt som flyttas." : tool === "erase" ? "Klicka på det som ska bort." : "Klicka på planen för att placera."}</small></div>
        </div>

        <aside className="editor-properties">
          <span className="editor-kicker">Egenskaper</span>
          {!selected && <p className="editor-empty">Markera ett objekt på planen för att ändra det.</p>}
          {selected && <>
            <strong>{objectTools.find((item) => item.type === selected.type)?.label ?? "Objekt"}</strong>
            {(selected.type === "player" || selected.type === "text") && <label>Etikett<input value={selected.label ?? ""} maxLength={16} placeholder={selected.type === "player" ? "T.ex. 8 eller A" : "Skriv text"} onChange={(event) => updateObject(selected.id, { label: event.target.value })} /></label>}
            {selected.type === "player" && <div><label>Lag / roll</label><div className="team-picker">{(["att", "def", "gk"] as Team[]).map((team) => <button key={team} className={selected.team === team ? "active" : ""} style={{ "--team": TEAM_COLOR[team] } as React.CSSProperties} onClick={() => updateObject(selected.id, { team })}>{team === "att" ? "Anfall" : team === "def" ? "Försvar" : "Målvakt"}</button>)}</div></div>}
            {selected.type === "zone" && <><label>Bredd<input type="range" min={0.08} max={0.8} step={0.02} value={selected.width ?? 0.24} onChange={(event) => updateObject(selected.id, { width: Number(event.target.value) })} /></label><label>Höjd<input type="range" min={0.08} max={0.8} step={0.02} value={selected.height ?? 0.22} onChange={(event) => updateObject(selected.id, { height: Number(event.target.value) })} /></label></>}
            {["goal", "miniGoal", "pole"].includes(selected.type) && <button className="button" onClick={() => updateObject(selected.id, { rotation: (selected.rotation ?? 0) + 45 })}>↻ Rotera 45°</button>}
            <div className="property-actions"><button className="button" onClick={() => duplicateObject(selected.id)}>Duplicera</button><button className="button danger" onClick={() => { deleteObject(selected.id); select(null); }}>Ta bort</button></div>
          </>}
          <div className="editor-export"><span className="editor-kicker">Export</span><button className="button" onClick={exportSVG}>Ladda ner SVG</button><span className="editor-saving">{status}</span></div>
        </aside>
      </div>
    </div>
  );
}
