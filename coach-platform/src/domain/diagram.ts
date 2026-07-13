import { z } from "zod";

// Serialiserbart övningsdiagram. Positioner normaliserade 0–1 (se docs/exercise-format.md).
// Ren domän — får inte importera Next.js (leveransprincip i IMPLEMENTATION_PLAN.md).

export type ObjectType = "player" | "ball" | "cone" | "pole" | "goal" | "miniGoal" | "zone" | "text";
export type Team = "att" | "def" | "gk";
export type ArrowKind = "pass" | "run" | "dribble";

export interface DiagramObject {
  id: string;
  type: ObjectType;
  x: number; // 0..1
  y: number; // 0..1
  label?: string;
  team?: Team; // endast för player
  width?: number; // normaliserad bredd, endast zon
  height?: number; // normaliserad höjd, endast zon
  rotation?: number; // grader, utrustning
}

export interface ArrowEndpoint {
  objectId?: string; // refererar DiagramObject.id, el. fri punkt nedan
  point?: [number, number];
}

export interface Arrow {
  id: string;
  kind: ArrowKind;
  from: ArrowEndpoint;
  to: ArrowEndpoint;
  order: number; // sekvensordning för uppspelning
}

export interface Diagram {
  widthRatio: number; // planens breddförhållande (0.65 ≈ 7v7)
  objects: DiagramObject[];
  arrows: Arrow[];
}

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const endpoint = z
  .object({ objectId: z.string().optional(), point: point.optional() })
  .refine((e) => e.objectId !== undefined || e.point !== undefined, { message: "endpoint behöver objectId eller point" });

export const diagramSchema = z.object({
  widthRatio: z.number().min(0.3).max(1),
  objects: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["player", "ball", "cone", "pole", "goal", "miniGoal", "zone", "text"]),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      label: z.string().optional(),
      team: z.enum(["att", "def", "gk"]).optional(),
      width: z.number().min(0.02).max(1).optional(),
      height: z.number().min(0.02).max(1).optional(),
      rotation: z.number().optional(),
    }),
  ),
  arrows: z.array(
    z.object({ id: z.string(), kind: z.enum(["pass", "run", "dribble"]), from: endpoint, to: endpoint, order: z.number().int() }),
  ),
});

export const emptyDiagram = (): Diagram => ({ widthRatio: 0.72, objects: [], arrows: [] });

export const serialize = (d: Diagram): unknown => diagramSchema.parse(d);
export const parse = (input: unknown): Diagram => diagramSchema.parse(input) as Diagram;
