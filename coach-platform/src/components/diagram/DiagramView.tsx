import type { Arrow, Diagram, DiagramObject } from "@/domain/diagram";
import { arrowsSorted } from "./diagramStore";
import { ARROW_COLOR, ARROW_DASH, H, TEAM_COLOR, arrowMarkers, arrowPath, pitchMarkings, resolve } from "./diagramRender";

function StaticObject({ object, h }: { object: DiagramObject; h: number }) {
  const x = object.x * 100;
  const y = object.y * h;
  const rotation = object.rotation ?? 0;
  if (object.type === "zone") {
    const width = (object.width ?? 0.24) * 100;
    const height = (object.height ?? 0.22) * h;
    return <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx={1} fill="#f7d15422" stroke="#ffe066" strokeWidth={0.45} strokeDasharray="2 1.5" />;
  }
  if (object.type === "text") return <text x={x} y={y} textAnchor="middle" fill="#fff" fontSize={3.1} fontWeight={800} paintOrder="stroke" stroke="#173b2a" strokeWidth={0.8}>{object.label || "Text"}</text>;
  if (object.type === "player") return <><circle cx={x} cy={y} r={2.4} fill={TEAM_COLOR[object.team ?? "att"]} stroke="#fff" strokeWidth={0.65} />{object.label && <text x={x} y={y + 0.85} fontSize={2.2} textAnchor="middle" fill="#fff" fontWeight={900}>{object.label}</text>}</>;
  if (object.type === "ball") return <><circle cx={x} cy={y} r={1.25} fill="#fff" stroke="#17211d" strokeWidth={0.35} /><path d={`M ${x - 0.5} ${y} l 0.5 -0.45 0.5 0.45 -0.2 0.55 -0.6 0 z`} fill="#17211d" /></>;
  if (object.type === "cone") return <polygon points={`${x},${y - 1.5} ${x + 1.35},${y + 1} ${x - 1.35},${y + 1}`} fill="#ff8b32" stroke="#9a4510" strokeWidth={0.3} />;
  if (object.type === "pole") return <g transform={`rotate(${rotation} ${x} ${y})`}><line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#ffd84d" strokeWidth={1.1} /><line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#e44" strokeWidth={0.35} strokeDasharray="1.5 1.5" /></g>;
  const width = object.type === "goal" ? 10 : 6;
  const depth = object.type === "goal" ? 3 : 2.5;
  return <g transform={`rotate(${rotation} ${x} ${y})`} stroke="#fff" strokeWidth={0.55} fill="#ffffff18"><path d={`M ${x - width / 2} ${y + depth / 2} V ${y - depth / 2} H ${x + width / 2} V ${y + depth / 2}`} /><path d={`M ${x - width / 2} ${y - depth / 2} l 1.3 ${depth} h ${width - 2.6} l 1.3 -${depth}`} opacity={0.7} /></g>;
}

export function DiagramView({ diagram, className, style }: { diagram: Diagram; className?: string; style?: React.CSSProperties }) {
  const h = H(diagram.widthRatio);
  const renderArrow = (arrow: Arrow) => {
    const from = resolve(arrow.from, diagram.objects, h);
    const to = resolve(arrow.to, diagram.objects, h);
    return <path key={arrow.id} d={arrowPath(arrow.kind, from, to)} fill="none" stroke={ARROW_COLOR[arrow.kind]} strokeWidth={0.75} strokeDasharray={ARROW_DASH[arrow.kind]} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#ah-${arrow.kind})`} />;
  };
  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `1 / ${diagram.widthRatio}`, display: "block", width: "100%", touchAction: "none", ...style }} className={className}>
      <defs>{arrowMarkers()}</defs>
      {pitchMarkings(h)}
      {diagram.objects.filter((object) => object.type === "zone").map((object) => <StaticObject key={object.id} object={object} h={h} />)}
      {arrowsSorted(diagram).map(renderArrow)}
      {diagram.objects.filter((object) => object.type !== "zone").map((object) => <StaticObject key={object.id} object={object} h={h} />)}
    </svg>
  );
}
