import bank from "./bank.json";
export type ObjectType =
  "player" | "ball" | "cone" | "goal" | "text" | "pass" | "run" | "dribble";
export type DrawingObject = {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  color: string;
  label: string;
  size: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
};
export type Diagram = {
  version: 1;
  title: string;
  notes: string;
  objects: DrawingObject[];
};
export type Block = { id: string; minutes: number; diagram: Diagram };
export type TrainingPlan = {
  version: 1;
  title: string;
  date: string;
  blocks: Block[];
};
export const BANK = bank as {
  id: string;
  category: string;
  players: string;
  area: string;
  time: string;
  focus: string;
  model: Diagram;
}[];
export const isArrow = (o: DrawingObject) =>
  ["pass", "run", "dribble"].includes(o.type);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;
export function validDiagram(value: unknown): value is Diagram {
  if (
    !record(value) ||
    value.version !== 1 ||
    !text(value.title, 70) ||
    !text(value.notes, 1200) ||
    !Array.isArray(value.objects) ||
    value.objects.length > 500
  )
    return false;
  const ids = new Set();
  return value.objects.every((o) => {
    if (
      !record(o) ||
      typeof o.id !== "string" ||
      !/^[a-zA-Z0-9]{1,80}$/.test(o.id) ||
      ids.has(o.id)
    )
      return false;
    ids.add(o.id);
    return (
      [
        "player",
        "ball",
        "cone",
        "goal",
        "text",
        "pass",
        "run",
        "dribble",
      ].includes(String(o.type)) &&
      text(o.label, 40) &&
      typeof o.color === "string" &&
      /^#[a-f0-9]{6}$/i.test(o.color) &&
      [
        "x",
        "y",
        "size",
        ...(["pass", "run", "dribble"].includes(String(o.type))
          ? ["x2", "y2", "cx", "cy"]
          : []),
      ].every(
        (k) =>
          typeof o[k] === "number" &&
          Number.isFinite(o[k]) &&
          Math.abs(o[k] as number) <= 5000,
      ) &&
      (o.size as number) >= 0.5 &&
      (o.size as number) <= 2
    );
  });
}
export function validPlan(value: unknown): value is TrainingPlan {
  if (
    !record(value) ||
    value.version !== 1 ||
    !text(value.title, 100) ||
    !(value.title as string).trim() ||
    !text(value.date, 10) ||
    !Array.isArray(value.blocks) ||
    value.blocks.length > 30
  )
    return false;
  if (
    value.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value.date as string) ||
      !Number.isFinite(Date.parse(value.date as string)) ||
      new Date(value.date as string).toISOString().slice(0, 10) !== value.date)
  )
    return false;
  const ids = new Set();
  return value.blocks.every((b) => {
    if (
      !record(b) ||
      typeof b.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(b.id) ||
      ids.has(b.id)
    )
      return false;
    ids.add(b.id);
    return (
      Number.isInteger(b.minutes) &&
      (b.minutes as number) >= 1 &&
      (b.minutes as number) <= 180 &&
      validDiagram(b.diagram)
    );
  });
}
export const emptyDiagram = (): Diagram => ({
  version: 1,
  title: "Ny övning",
  notes: "",
  objects: [],
});
