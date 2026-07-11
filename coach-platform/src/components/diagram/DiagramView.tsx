import type { Arrow, Diagram, DiagramObject } from "@/domain/diagram";
import { arrowsSorted } from "./diagramStore";
import { ARROW_COLOR, ARROW_DASH, H, arrowMarkers, pitchMarkings, resolve, TEAM_COLOR } from "./diagramRender";

// Läs-bara rendering av ett Diagram — stor, statisk SVG för träningsläget.
// Ingen "use client" — serverkomponent. seqIndex/ballOverride valfritt för framtida uppspelning.

export function DiagramView({ diagram, seqIndex = -1, className, style }: { diagram: Diagram; seqIndex?: number; className?: string; style?: React.CSSProperties }) {
  const h = H(diagram.widthRatio);
  const sorted = arrowsSorted(diagram);
  const ballOverride = (() => {
    if (seqIndex < 0) return null;
    const a = sorted[seqIndex];
    if (!a) return null;
    return resolve(a.to, diagram.objects, h);
  })();

  const renderObject = (obj: DiagramObject) => {
    const x = obj.type === "ball" && ballOverride ? ballOverride[0] : obj.x * 100;
    const y = obj.type === "ball" && ballOverride ? ballOverride[1] : obj.y * h;
    if (obj.type === "player") {
      const fill = TEAM_COLOR[obj.team ?? "att"];
      return (
        <g key={obj.id}>
          <circle cx={x} cy={y} r={2.1} fill={fill} stroke="#fff" strokeWidth={0.6} />
          {obj.label && <text x={x} y={y + 0.8} fontSize={2.1} textAnchor="middle" fill="#fff" fontWeight={800}>{obj.label}</text>}
        </g>
      );
    }
    if (obj.type === "ball") {
      return <circle key={obj.id} cx={x} cy={y} r={1.1} fill="#fff" stroke="#111" strokeWidth={0.3} />;
    }
    if (obj.type === "cone") {
      return <polygon key={obj.id} points={`${x},${y - 1.3} ${x + 1.2},${y + 0.9} ${x - 1.2},${y + 0.9}`} fill="#ee8c22" stroke="#a85e10" strokeWidth={0.25} />;
    }
    return <rect key={obj.id} x={x - 1.4} y={y - 0.9} width={2.8} height={1.8} fill="#fff" stroke="#444" strokeWidth={0.25} />;
  };

  const renderArrow = (arrow: Arrow, idx: number) => {
    const [fx, fy] = resolve(arrow.from, diagram.objects, h);
    const [tx, ty] = resolve(arrow.to, diagram.objects, h);
    const shown = idx <= seqIndex;
    const color = ARROW_COLOR[arrow.kind];
    return (
      <g key={`arrow-${arrow.id}`}>
        <line x1={fx} y1={fy} x2={tx} y2={ty} stroke={color} strokeWidth={0.7} strokeDasharray={ARROW_DASH[arrow.kind]} opacity={shown || seqIndex < 0 ? 0.95 : 0.4} markerEnd={`url(#ah-${arrow.kind})`} />
        <circle cx={fx} cy={fy} r={1.0} fill={color} opacity={shown || seqIndex < 0 ? 0.95 : 0.4} />
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `1 / ${diagram.widthRatio}`, display: "block", width: "100%", touchAction: "none", ...style }} className={className}>
      <defs>{arrowMarkers()}</defs>
      {pitchMarkings(h)}
      {sorted.map(renderArrow)}
      {diagram.objects.map(renderObject)}
    </svg>
  );
}