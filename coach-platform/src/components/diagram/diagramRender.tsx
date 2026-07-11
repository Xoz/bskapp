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
    <marker key={k} id={`ah-${k}`} markerWidth={4} markerHeight={4} refX={3} refY={2} orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L4,2 L0,4 Z" fill={ARROW_COLOR[k]} />
    </marker>
  ));
}