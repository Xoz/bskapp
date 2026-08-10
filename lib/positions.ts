// Spelarpositioner – valfritt fält för planering och visning på spelarsidan.

export interface Position {
  id: string;
  label: string;
}

export const POSITIONS: Position[] = [
  { id: "malvakt", label: "Målvakt" },
  { id: "forsvar", label: "Försvar" },
  { id: "mittfalt", label: "Mittfält" },
  { id: "anfall", label: "Anfall" },
];

export function positionLabel(id: string | null | undefined): string | null {
  return POSITIONS.find((p) => p.id === id)?.label ?? null;
}
