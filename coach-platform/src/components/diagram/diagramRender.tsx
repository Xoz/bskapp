import type { ArrowEndpoint, ArrowKind, DiagramObject, Team } from "@/domain/diagram";

// Delad rendering-logik för diagram (används av ExerciseEditor + DiagramView).
// Ren, server-säker — ingen state, inga handlers.

export const TEAM_COLOR: Record<Team, string> = { att: "#3278b7", def: "#d89521", gk: "#20a56b" };
export const ARROW_COLOR: Record<ArrowKind, string> = { pass: "#ffe066", run: "#ffffff", dribble: "#7ee7f2" };
export const ARROW_DASH: Record<ArrowKind, string | undefined> = { pass: "2.5 1.8", run: undefined, dribble: undefined };

export const H = (ratio: number) => 100 * ratio;

// Endpoint → punkt i SVG-userenheter (100 × H)
export function resolve(ep: ArrowEndpoint, objects: DiagramObject[], h: number): [number, number] {
  if (ep.objectId) {
    const o = objects.find((o) => o.id === ep.objectId);
    if (o) return [o.x * 100, o.y * h];
  }
  if (ep.point) return [ep.point[0] * 100, ep.point[1] * h];
  return [50, h / 2];
}

export function arrowPath(kind: ArrowKind, from: [number, number], to: [number, number]) {
  if (kind !== "dribble") return `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const points = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    const offset = index === 0 || index === 8 ? 0 : (index % 2 ? 0.9 : -0.9);
    return `${from[0] + dx * t + nx * offset} ${from[1] + dy * t + ny * offset}`;
  });
  return `M ${points.join(" L ")}`;
}

export function pitchMarkings(h: number) {
  const kind = h >= 95 ? "square" : h >= 78 ? "half" : h >= 70 ? "area" : "full";
  if (kind === "area" || kind === "square") {
    return (
      <g>
        <rect width={100} height={h} fill="#438b61" />
        <g stroke="#ffffff22" strokeWidth={0.25}>
          {Array.from({ length: 9 }, (_, index) => <line key={`v-${index}`} x1={(index + 1) * 10} y1={0} x2={(index + 1) * 10} y2={h} />)}
          {Array.from({ length: Math.floor(h / 10) - 1 }, (_, index) => <line key={`h-${index}`} x1={0} y1={(index + 1) * 10} x2={100} y2={(index + 1) * 10} />)}
        </g>
        <rect x={0.4} y={0.4} width={99.2} height={h - 0.8} rx={0.8} fill="none" stroke="#ffffff99" strokeWidth={0.5} />
      </g>
    );
  }
  if (kind === "half") {
    return (
      <g stroke="#ffffff88" strokeWidth={0.45} fill="none">
        <rect width={100} height={h} fill="#438b61" stroke="none" />
        <rect x={0.4} y={0.4} width={99.2} height={h - 0.8} />
        <line x1={0} y1={h - 0.5} x2={100} y2={h - 0.5} />
        <path d={`M 38 ${h} A 12 12 0 0 1 62 ${h}`} />
        <rect x={24} y={0} width={52} height={18} />
        <rect x={38} y={0} width={24} height={7} />
        <circle cx={50} cy={12} r={0.8} fill="#ffffffaa" stroke="none" />
      </g>
    );
  }
  return (
    <g stroke="#ffffff88" strokeWidth={0.4} fill="none">
      <rect width={100} height={h} fill="#438b61" stroke="none" />
      <rect x={0} y={0} width={100} height={h} />
      <line x1={50} y1={0} x2={50} y2={h} />
      <circle cx={50} cy={h / 2} r={h * 0.12} />
      <rect x={0} y={h * 0.25} width={16} height={h * 0.5} />
      <rect x={84} y={h * 0.25} width={16} height={h * 0.5} />
      <rect x={0} y={h * 0.37} width={6} height={h * 0.26} />
      <rect x={94} y={h * 0.37} width={6} height={h * 0.26} />
    </g>
  );
}

export function arrowMarkers() {
  return (["pass", "run", "dribble"] as ArrowKind[]).map((k) => (
    <marker key={k} id={`ah-${k}`} markerWidth={5} markerHeight={5} refX={4.5} refY={2.5} orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill={ARROW_COLOR[k]} />
    </marker>
  ));
}
