import type { ArrowEndpoint, ArrowKind, DiagramObject, Team } from "@/domain/diagram";

// Delad rendering-logik för diagram (används av ExerciseEditor + DiagramView).
// Ren, server-säker — ingen state, inga handlers.

export const TEAM_COLOR: Record<Team, string> = { att: "#3278b7", def: "#d89521", gk: "#20a56b" };
export const ARROW_COLOR: Record<ArrowKind, string> = { pass: "#ffd54a", run: "#ffffff", dribble: "#ff7f7f" };
export const ARROW_DASH: Record<ArrowKind, string | undefined> = { pass: undefined, run: "5 4", dribble: "1 4" };

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

export function interpolate(from: [number, number], to: [number, number], progress: number): [number, number] {
  const t = Math.min(1, Math.max(0, progress));
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

export function pitchMarkings(h: number) {
  return (
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
}

export function arrowMarkers() {
  return (["pass", "run", "dribble"] as ArrowKind[]).map((k) => (
    <marker key={k} id={`ah-${k}`} markerWidth={5} markerHeight={5} refX={4.5} refY={2.5} orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill={ARROW_COLOR[k]} />
    </marker>
  ));
}
