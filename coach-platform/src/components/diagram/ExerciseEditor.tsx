"use client";

import { useEffect, useRef, useState } from "react";
import type { Arrow, ArrowEndpoint, ArrowKind, Diagram, DiagramObject, ObjectType, Team } from "@/domain/diagram";
import { serialize } from "@/domain/diagram";
import { saveExerciseDiagram } from "@/app/actions";
import { arrowsSorted, useDiagram } from "./diagramStore";

type Tool = "select" | "erase" | `place:${ObjectType}` | `arrow:${ArrowKind}`;

const TEAM_COLOR: Record<Team, string> = { att: "#3278b7", def: "#d89521", gk: "#20a56b" };
const ARROW_COLOR: Record<ArrowKind, string> = { pass: "#ffd54a", run: "#ffffff", dribble: "#ff7f7f" };
const ARROW_DASH: Record<ArrowKind, string | undefined> = { pass: undefined, run: "5 4", dribble: "1 4" };

const H = (ratio: number) => 100 * ratio;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Endpoint → punkt i SVG-userenheter (100 × H)
function resolve(ep: ArrowEndpoint, objects: DiagramObject[], H: number): [number, number] {
  if (ep.objectId) {
    const o = objects.find((o) => o.id === ep.objectId);
    if (o) return [o.x * 100, o.y * H];
  }
  if (ep.point) return [ep.point[0] * 100, ep.point[1] * H];
  return [50, H / 2];
}

export function ExerciseEditor({ exerciseId, name, initialDiagram }: { exerciseId: string; name: string; initialDiagram: Diagram }) {
  const present = useDiagram((s) => s.present);
  const past = useDiagram((s) => s.past);
  const future = useDiagram((s) => s.future);
  const selectedId = useDiagram((s) => s.selectedId);
  const seqIndex = useDiagram((s) => s.seqIndex);
  const load = useDiagram((s) => s.load);
  const addObject = useDiagram((s) => s.addObject);
  const moveObjectLive = useDiagram((s) => s.moveObjectLive);
  const deleteObject = useDiagram((s) => s.deleteObject);
  const addArrow = useDiagram((s) => s.addArrow);
  const deleteArrow = useDiagram((s) => s.deleteArrow);
  const setWidth = useDiagram((s) => s.setWidth);
  const select = useDiagram((s) => s.select);
  const snapshot = useDiagram((s) => s.snapshot);
  const undo = useDiagram((s) => s.undo);
  const redo = useDiagram((s) => s.redo);
  const setSeq = useDiagram((s) => s.setSeq);
  const stepSeq = useDiagram((s) => s.stepSeq);

  const [tool, setTool] = useState<Tool>("select");
  const [pending, setPending] = useState<ArrowEndpoint | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => load(initialDiagram), []); // eslint-disable-line react-hooks/exhaustive-deps

  const h = H(present.widthRatio);
  const sorted = arrowsSorted(present);
  const ballOverride = (() => {
    if (seqIndex < 0) return null;
    const a = sorted[seqIndex];
    if (!a) return null;
    return resolve(a.to, present.objects, h);
  })();

  // --- pointer / coords ---
  const toUnit = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };

  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (dragId.current) return;
    const [nx, ny] = toUnit(e);
    const isArrow = tool.startsWith("arrow:");
    if (isArrow) {
      const ep: ArrowEndpoint = { point: [nx, ny] };
      if (pending) {
        addArrow(tool.split(":")[1] as ArrowKind, pending, ep);
        setPending(null);
      } else {
        setPending(ep);
      }
      return;
    }
    if (tool.startsWith("place:")) {
      const type = tool.split(":")[1] as ObjectType;
      addObject(type, nx, ny, type === "player" ? "att" : undefined);
      return;
    }
    if (tool === "select") select(null);
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const p = toUnit(e);
    if (tool.startsWith("arrow:") && pending) setCursor(p);
    if (dragId.current) moveObjectLive(dragId.current, p[0], p[1]);
  };

  const onSvgPointerUp = () => {
    if (dragId.current) dragId.current = null; // pointer capture släpps auto vid pointerup
  };

  const onObjectDown = (e: React.PointerEvent, obj: DiagramObject) => {
    e.stopPropagation();
    const [nx, ny] = toUnit(e);
    if (tool === "select") {
      snapshot();
      dragId.current = obj.id;
      select(obj.id);
      svgRef.current?.setPointerCapture?.(e.pointerId);
    } else if (tool === "erase") {
      deleteObject(obj.id);
    } else if (tool.startsWith("arrow:")) {
      const ep: ArrowEndpoint = { objectId: obj.id };
      if (pending) {
        addArrow(tool.split(":")[1] as ArrowKind, pending, ep);
        setPending(null);
      } else setPending(ep);
    } else if (tool.startsWith("place:")) {
      addObject(tool.split(":")[1] as ObjectType, nx, ny, tool === "place:player" ? "att" : undefined);
    }
  };

  const onArrowDown = (e: React.PointerEvent, arrow: Arrow) => {
    e.stopPropagation();
    if (tool === "erase") deleteArrow(arrow.id);
  };

  // --- playback ---
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = useDiagram.getState();
      if (s.seqIndex >= s.present.arrows.length - 1) {
        setPlaying(false);
        return;
      }
      s.stepSeq(1);
    }, 800);
    return () => clearInterval(id);
  }, [playing]);

  const play = () => {
    if (!sorted.length) return;
    if (seqIndex >= sorted.length - 1) setSeq(-1);
    setPlaying(true);
  };

  // --- export ---
  const download = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  };

  const exportSVG = () => {
    const svg = svgRef.current!;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    download(URL.createObjectURL(blob), `${name || "ovning"}.svg`);
  };

  const exportPNG = () => {
    const svg = svgRef.current!;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = Math.round(w * present.widthRatio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      download(canvas.toDataURL("image/png"), `${name || "ovning"}.png`);
    };
    img.src = url;
  };

  // --- save ---
  const onSave = async () => {
    setStatus("Sparar…");
    try {
      await saveExerciseDiagram(exerciseId, serialize(present) as Diagram);
      setStatus("Sparat ✓");
      setTimeout(() => setStatus(""), 2500);
    } catch (err) {
      setStatus("Kunde inte spara: " + (err as Error).message);
    }
  };

  // --- render helpers ---
  const pitchMarkings = (
    <g stroke="#ffffff55" strokeWidth={0.4} fill="none">
      <rect x={0} y={0} width={100} height={h} />
      <line x1={50} y1={0} x2={50} y2={h} />
      <circle cx={50} cy={h / 2} r={h * 0.12} />
      <rect x={0} y={h * 0.25} width={16} height={h * 0.5} />
      <rect x={84} y={h * 0.25} width={16} height={h * 0.5} />
      <rect x={0} y={h * 0.37} width={6} height={h * 0.26} />
      <rect x={94} y={h * 0.37} width={6} height={h * 0.26} />
    </g>
  );

  const renderObject = (obj: DiagramObject) => {
    const x = obj.type === "ball" && ballOverride ? ballOverride[0] : obj.x * 100;
    const y = obj.type === "ball" && ballOverride ? ballOverride[1] : obj.y * h;
    const selected = obj.id === selectedId;
    const common = { onPointerDown: (e: React.PointerEvent) => onObjectDown(e, obj) };
    if (obj.type === "player") {
      const fill = TEAM_COLOR[obj.team ?? "att"];
      return (
        <g key={obj.id} {...common} style={{ cursor: tool === "select" ? "grab" : "pointer" }}>
          <circle cx={x} cy={y} r={4} fill="transparent" />
          <circle cx={x} cy={y} r={2.1} fill={fill} stroke="#fff" strokeWidth={0.6} />
          {obj.label && <text x={x} y={y + 0.8} fontSize={2.1} textAnchor="middle" fill="#fff" fontWeight={800}>{obj.label}</text>}
          {selected && <circle cx={x} cy={y} r={2.8} fill="none" stroke="#fff" strokeWidth={0.4} />}
        </g>
      );
    }
    if (obj.type === "ball") {
      return (
        <g key={obj.id} {...common} style={{ cursor: tool === "select" ? "grab" : "pointer" }}>
          <circle cx={x} cy={y} r={3.5} fill="transparent" />
          <circle cx={x} cy={y} r={1.1} fill="#fff" stroke="#111" strokeWidth={0.3} />
        </g>
      );
    }
    if (obj.type === "cone") {
      return (
        <g key={obj.id} {...common} style={{ cursor: tool === "select" ? "grab" : "pointer" }}>
          <circle cx={x} cy={y} r={3.5} fill="transparent" />
          <polygon points={`${x},${y - 1.3} ${x + 1.2},${y + 0.9} ${x - 1.2},${y + 0.9}`} fill="#ee8c22" stroke="#a85e10" strokeWidth={0.25} />
        </g>
      );
    }
    // goal
    return (
      <g key={obj.id} {...common} style={{ cursor: tool === "select" ? "grab" : "pointer" }}>
        <circle cx={x} cy={y} r={3.5} fill="transparent" />
        <rect x={x - 1.4} y={y - 0.9} width={2.8} height={1.8} fill="#fff" stroke="#444" strokeWidth={0.25} />
      </g>
    );
  };

  const renderArrow = (arrow: Arrow, idx: number) => {
    const [fx, fy] = resolve(arrow.from, present.objects, h);
    const [tx, ty] = resolve(arrow.to, present.objects, h);
    const active = idx === seqIndex;
    const shown = idx <= seqIndex;
    const color = ARROW_COLOR[arrow.kind];
    const key = `arrow-${arrow.id}`;
    return (
      <g key={key} onPointerDown={(e) => onArrowDown(e, arrow)} style={{ cursor: tool === "erase" ? "pointer" : "default" }}>
        <line x1={fx} y1={fy} x2={tx} y2={ty} stroke={color} strokeWidth={active ? 1.0 : 0.7} strokeDasharray={ARROW_DASH[arrow.kind]} opacity={shown || seqIndex < 0 ? 0.95 : 0.35} markerEnd={`url(#ah-${arrow.kind})`} />
        <circle cx={fx} cy={fy} r={1.0} fill={color} opacity={shown || seqIndex < 0 ? 0.95 : 0.35} />
      </g>
    );
  };

  const pendingPreview = pending && cursor ? (
    <line x1={resolve(pending, present.objects, h)[0]} y1={resolve(pending, present.objects, h)[1]} x2={cursor[0] * 100} y2={cursor[1] * h} stroke="#ffd54a" strokeWidth={1} strokeDasharray="2 3" opacity={0.8} />
  ) : null;

  const tools: { t: Tool; label: string }[] = [
    { t: "select", label: "Flytta" },
    { t: "place:player", label: "Spelare" },
    { t: "place:ball", label: "Boll" },
    { t: "place:cone", label: "Möss" },
    { t: "place:goal", label: "Mål" },
    { t: "arrow:pass", label: "Pass" },
    { t: "arrow:run", label: "Löpning" },
    { t: "arrow:dribble", label: "Dribbling" },
    { t: "erase", label: "Radera" },
  ];

  return (
    <div className="editor">
      <div className="editor-bar">
        <div className="editor-toolbar">
          {tools.map((x) => (
            <button key={x.t} className={`button ${tool === x.t ? "active" : ""}`} onClick={() => { setTool(x.t); setPending(null); }}>{x.label}</button>
          ))}
        </div>
        <div className="editor-toolbar">
          <button className="button" disabled={!past.length} onClick={undo}>↺ Ångra</button>
          <button className="button" disabled={!future.length} onClick={redo}>↻ Gör om</button>
          <button className="button" onClick={exportSVG}>SVG</button>
          <button className="button" onClick={exportPNG}>PNG</button>
          <button className="button primary" onClick={onSave}>Spara</button>
        </div>
      </div>

      <div className="editor-stage">
        <svg ref={svgRef} viewBox={`0 0 100 ${h}`} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `1 / ${present.widthRatio}` }} onPointerDown={onSvgPointerDown} onPointerMove={onSvgPointerMove} onPointerUp={onSvgPointerUp} onPointerLeave={onSvgPointerUp}>
          <defs>
            {(["pass", "run", "dribble"] as ArrowKind[]).map((k) => (
              <marker key={k} id={`ah-${k}`} markerWidth={4} markerHeight={4} refX={3} refY={2} orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L4,2 L0,4 Z" fill={ARROW_COLOR[k]} />
              </marker>
            ))}
          </defs>
          {pitchMarkings}
          {sorted.map(renderArrow)}
          {present.objects.map(renderObject)}
          {pendingPreview}
        </svg>
      </div>

      <div className="editor-bar">
        <div className="seq">
          <strong>Sekvens</strong>
          <button className="button" onClick={() => { setPlaying(false); setSeq(-1); }}>⏮</button>
          <button className="button" onClick={() => { setPlaying(false); stepSeq(-1); }}>◀</button>
          <button className="button primary" onClick={playing ? () => setPlaying(false) : play}>{playing ? "⏸" : "▶"}</button>
          <button className="button" onClick={() => { setPlaying(false); stepSeq(1); }}>▶</button>
          <small className="editor-help">{seqIndex < 0 ? "Startläge" : `${seqIndex + 1}/${sorted.length}`}</small>
        </div>
        <div className="editor-help">
          <label>Planbredd: </label>
          <input type="range" min={0.5} max={0.85} step={0.01} value={present.widthRatio} onChange={(e) => setWidth(Number(e.target.value))} />
        </div>
        <span className="editor-saving">{status}</span>
      </div>
      <p className="editor-help">
        {tool === "select" ? "Dra objekt för att flytta." : tool.startsWith("arrow:") ? (pending ? "Klicka pilens mål." : "Klicka pilens start.") : tool === "erase" ? "Klicka ett objekt eller en pil för att radera." : "Klicka på planen för att placera."}
      </p>
    </div>
  );
}